import {
	ALL_FORMATS,
	AdtsOutputFormat,
	BlobSource,
	BufferTarget,
	Conversion,
	FlacOutputFormat,
	Input,
	Mp3OutputFormat,
	Mp4OutputFormat,
	OggOutputFormat,
	Output,
	Quality,
	WavOutputFormat,
	WebMOutputFormat,
	canEncodeAudio,
	getFirstEncodableAudioCodec,
	getFirstEncodableVideoCodec,
	type ConversionAudioOptions,
	type ConversionVideoOptions,
	type OutputFormat
} from 'mediabunny';
import { ConvertError, type Adapter, type FileData, type Options } from '../../registry/types';
import { parseTime, splitName } from './time';

/**
 * Audio and video in the browser with Mediabunny: it reads MP4/MOV/WebM/MKV/MP3/WAV/OGG/FLAC/AAC
 * and encodes with the browser's own WebCodecs (hardware where there is some). MP3 and AAC
 * encoders (WASM) are added only when the browser has none. Streams are copied, not re-encoded,
 * whenever nothing about them changes (mute, trim, rotate, MKV → MP4...).
 */

export type MediaOut = 'mp4' | 'webm' | 'mp3' | 'm4a' | 'wav' | 'ogg' | 'flac' | 'aac';
const AUDIO_ONLY = new Set<MediaOut>(['mp3', 'm4a', 'wav', 'ogg', 'flac', 'aac']);

const MIME: Record<MediaOut, string> = {
	mp4: 'video/mp4',
	webm: 'video/webm',
	mp3: 'audio/mpeg',
	m4a: 'audio/mp4',
	wav: 'audio/wav',
	ogg: 'audio/ogg',
	flac: 'audio/flac',
	aac: 'audio/aac'
};

function format(to: MediaOut): OutputFormat {
	switch (to) {
		case 'mp4':
		case 'm4a':
			return new Mp4OutputFormat({ fastStart: 'in-memory' });
		case 'webm':
			return new WebMOutputFormat();
		case 'mp3':
			return new Mp3OutputFormat();
		case 'wav':
			return new WavOutputFormat();
		case 'ogg':
			return new OggOutputFormat();
		case 'flac':
			return new FlacOutputFormat();
		case 'aac':
			return new AdtsOutputFormat();
	}
}

let extraEncoders: Promise<void> | undefined;
/** LAME (MP3) and FFmpeg's AAC encoder as WASM, only for browsers without their own. */
function encoders() {
	extraEncoders ??= (async () => {
		if (!(await canEncodeAudio('mp3'))) (await import('@mediabunny/mp3-encoder')).registerMp3Encoder();
		if (!(await canEncodeAudio('aac'))) (await import('@mediabunny/aac-encoder')).registerAacEncoder();
	})();
	return extraEncoders;
}

export function openInput(file: FileData) {
	return new Input({ source: new BlobSource(new Blob([file.bytes as BlobPart])), formats: ALL_FORMATS });
}

type Level = 'high' | 'medium' | 'low' | 'very-low';
const QUALITY: Record<Level, Quality> = { high: new Quality('high'), medium: new Quality('medium'), low: new Quality('low'), 'very-low': new Quality('very-low') };

/** What each tool asks of the conversion (from its fixed params and the user's options). */
export type Plan = {
	to: MediaOut | 'same';
	/** Re-encode even if the codec stays the same (compress). */
	quality?: Level;
	/** Longest allowed height in pixels (keeps the ratio); 0 = as is. */
	height?: number;
	mute?: boolean;
	rotate?: 0 | 90 | 180 | 270;
	start?: number;
	end?: number;
	/** Audio bitrate in kbit/s for audio outputs; 0 = encoder default. */
	kbps?: number;
};

export function planFrom(o: Options): Plan {
	const time = (key: string) => {
		const v = parseTime(String(o[key] ?? ''));
		if (v !== null && !Number.isFinite(v)) throw new ConvertError('options', `bad ${key}`);
		return v ?? undefined;
	};
	const start = time('start');
	const end = time('end');
	if (start !== undefined && end !== undefined && end <= start) throw new ConvertError('options', 'end ≤ start');
	return {
		to: (String(o.to ?? 'same') as Plan['to']),
		quality: o.quality ? (String(o.quality) as Level) : undefined,
		height: Number(o.height) || 0,
		mute: o.mute === true,
		rotate: (Number(o.rotate) || 0) as Plan['rotate'],
		start,
		end,
		kbps: Number(o.kbps) || 0
	};
}

/** The output format when the tool keeps the input's: MP4/MOV/M4V → mp4, WebM/MKV → webm, audio by extension. */
function sameAs(ext: string, hasVideo: boolean): MediaOut {
	if (hasVideo) return ext === 'webm' || ext === 'mkv' ? 'webm' : 'mp4';
	const map: Record<string, MediaOut> = { mp3: 'mp3', wav: 'wav', ogg: 'ogg', oga: 'ogg', opus: 'ogg', flac: 'flac', aac: 'aac', m4a: 'm4a' };
	return map[ext] ?? 'm4a';
}

export async function run(file: FileData, plan: Plan, onProgress?: (r: number) => void): Promise<FileData> {
	const [stem, ext] = splitName(file.name);
	const input = openInput(file);
	try {
		let video;
		let audio;
		try {
			video = await input.getPrimaryVideoTrack();
			audio = await input.getPrimaryAudioTrack();
		} catch {
			throw new ConvertError('wrong-type');
		}
		if (!video && !audio) throw new ConvertError('wrong-type');
		const to = plan.to === 'same' ? sameAs(ext, !!video) : plan.to;
		const audioOnly = AUDIO_ONLY.has(to);
		if (audioOnly && !audio) throw new ConvertError('nothing', 'no audio track');
		if (!audioOnly && !video) throw new ConvertError('wrong-type', 'no video track');
		if (plan.mute && !audio) throw new ConvertError('nothing', 'already silent');
		const duration = await input.computeDuration();
		if (plan.start !== undefined && plan.start >= duration) throw new ConvertError('options', 'start after the end');
		if (audioOnly || to === 'mp3' || to === 'wav' || to === 'ogg' || to === 'm4a' || to === 'aac') await encoders();
		else if (audio && !plan.mute) await encoders();

		const out = new Output({ format: format(to), target: new BufferTarget() });
		const recode = !!plan.quality;
		const videoOpts: ConversionVideoOptions = { discard: audioOnly };
		if (!audioOnly && video) {
			const w = await video.getDisplayWidth();
			const h = await video.getDisplayHeight();
			const short = Math.min(w, h);
			// "720p" means the short side, so portrait phone videos shrink the same way.
			if (plan.height && short > plan.height) {
				const k = plan.height / short;
				videoOpts.width = Math.round((w * k) / 2) * 2;
				videoOpts.height = Math.round((h * k) / 2) * 2;
			}
			if (plan.rotate) {
				videoOpts.rotate = plan.rotate;
				videoOpts.allowTransformationMetadata = true;
			}
			const codecs = out.format.getSupportedVideoCodecs();
			const codec = await getFirstEncodableVideoCodec(
				// MP4: H.264 first, it plays everywhere (WhatsApp, old TVs, PowerPoint).
				to === 'mp4' ? ['avc', ...codecs.filter((c) => c !== 'avc')] : codecs,
				{ width: videoOpts.width ?? w, height: videoOpts.height ?? h }
			);
			if (!codec) throw new ConvertError('codec', 'no video encoder');
			videoOpts.codec = codec;
			if (recode) {
				videoOpts.quality = QUALITY[plan.quality!];
				videoOpts.forceTranscode = true;
			}
		}
		const audioOpts: ConversionAudioOptions = { discard: plan.mute || !audio };
		if (audio && !plan.mute) {
			const codecs = out.format.getSupportedAudioCodecs();
			const preferred = to === 'mp4' || to === 'm4a' ? ['aac' as const, ...codecs.filter((c) => c !== 'aac')] : to === 'wav' ? ['pcm-s16' as const] : codecs;
			const codec = await getFirstEncodableAudioCodec(preferred);
			if (!codec) throw new ConvertError('codec', 'no audio encoder');
			audioOpts.codec = codec;
			const kbps = plan.kbps || (recode ? (plan.quality === 'high' ? 128 : plan.quality === 'medium' ? 96 : 64) : 0);
			if (kbps) audioOpts.quality = new Quality({ bitrate: kbps * 1000 });
		}

		const conversion = await Conversion.init({
			input,
			output: out,
			video: videoOpts,
			audio: audioOpts,
			trim: plan.start !== undefined || plan.end !== undefined ? { start: plan.start ?? 0, end: Math.min(plan.end ?? duration, duration) } : undefined,
			showWarnings: false
		});
		if (!conversion.isValid) {
			const reasons = conversion.discardedTracks.map((d) => d.reason);
			throw new ConvertError(reasons.some((r) => r === 'undecodable_source_codec' || r === 'unknown_source_codec') ? 'codec' : 'corrupted', reasons.join(', '));
		}
		if (onProgress) conversion.onProgress = (p) => onProgress(Math.min(0.99, p));
		await conversion.execute();
		const bytes = new Uint8Array(out.target.buffer!);
		return { name: `${stem}.${to}`, type: MIME[to], bytes };
	} finally {
		input.dispose();
	}
}

const adapter: Adapter = {
	async convert(input, options, onProgress) {
		const plan = planFrom(options);
		if (options.trim && plan.start === undefined && plan.end === undefined) throw new ConvertError('options', 'no start or end');
		const out = await run(input, plan, onProgress);
		// Compressing must not make it bigger.
		if (plan.quality && !plan.mute && out.bytes.length >= input.bytes.length && splitName(out.name)[1] === splitName(input.name)[1])
			return [{ ...input, note: 'kept-original' }];
		if (plan.start !== undefined || plan.end !== undefined) {
			const [stem, ext] = splitName(out.name);
			out.name = `${stem}-cut.${ext}`;
		}
		return [out];
	}
};

export default adapter;
