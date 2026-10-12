import { inWorker } from '../workers/proxy';
import type { OptionSpec, Tool } from './types';

/** What the browser can open (Mediabunny + WebCodecs). AVI, WMV, FLV, 3GP, AMR... go to the server tool. */
export const VIDEO_INPUTS = ['mp4', 'm4v', 'mov', 'webm', 'mkv', 'video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'];
export const AUDIO_INPUTS = [
	'mp3', 'wav', 'ogg', 'oga', 'opus', 'm4a', 'aac', 'flac',
	'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/opus', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/flac'
];

/** Video in the browser: kept in memory while it is converted, so not too big for a phone. */
const MAX_MB = 500;

const media = (t: Omit<Tool, 'category' | 'runtime' | 'engine' | 'load' | 'maxMB' | 'batch'> & { engine?: string }): Tool => {
	const engine = t.engine ?? 'media';
	return { category: 'media', runtime: 'browser', engine, load: inWorker(engine), maxMB: MAX_MB, batch: true, ...t };
};

const height = (def: number): OptionSpec => ({
	id: 'height',
	type: 'select',
	label: { ar: 'الدقة', en: 'Resolution' },
	default: String(def),
	choices: [
		{ value: '0', label: { ar: 'كما هي', en: 'As it is' } },
		{ value: '1080', label: { ar: '1080p (Full HD)', en: '1080p (Full HD)' } },
		{ value: '720', label: { ar: '720p (HD)', en: '720p (HD)' } },
		{ value: '480', label: { ar: '480p (أصغر حجمًا)', en: '480p (smaller)' } },
		{ value: '360', label: { ar: '360p (الأصغر)', en: '360p (smallest)' } }
	]
});

export const MEDIA_QUALITY: OptionSpec = {
	id: 'quality',
	type: 'select',
	label: { ar: 'مستوى الضغط', en: 'Compression' },
	default: 'medium',
	choices: [
		{ value: 'high', label: { ar: 'خفيف — جودة عالية', en: 'Light — high quality' } },
		{ value: 'medium', label: { ar: 'متوسط — موصى به', en: 'Medium — recommended' } },
		{ value: 'low', label: { ar: 'قوي — حجم صغير', en: 'Strong — small file' } },
		{ value: 'very-low', label: { ar: 'أقصى ضغط', en: 'Maximum' } }
	]
};

/** For the server tool: as it is by default. */
export const MEDIA_HEIGHT: OptionSpec = height(0);

const AUDIO_OUT = [
	{ value: 'mp3', label: { ar: 'MP3 (يعمل في كل مكان)', en: 'MP3 (plays everywhere)' } },
	{ value: 'm4a', label: { ar: 'M4A (AAC)', en: 'M4A (AAC)' } },
	{ value: 'wav', label: { ar: 'WAV (بدون ضغط)', en: 'WAV (uncompressed)' } },
	{ value: 'ogg', label: { ar: 'OGG (Opus)', en: 'OGG (Opus)' } },
	{ value: 'flac', label: { ar: 'FLAC (بدون فقد)', en: 'FLAC (lossless)' } }
];

export const MEDIA_KBPS: OptionSpec = {
	id: 'kbps',
	type: 'select',
	label: { ar: 'جودة الصوت', en: 'Audio quality' },
	default: '128',
	choices: [
		{ value: '64', label: { ar: '64 كيلوبت — للكلام', en: '64 kbps — speech' } },
		{ value: '128', label: { ar: '128 كيلوبت — جيدة', en: '128 kbps — good' } },
		{ value: '192', label: { ar: '192 كيلوبت — عالية', en: '192 kbps — high' } },
		{ value: '320', label: { ar: '320 كيلوبت — الأعلى', en: '320 kbps — highest' } }
	]
};
const kbps: OptionSpec = { ...MEDIA_KBPS, when: { id: 'to', in: ['mp3', 'm4a', 'ogg'] } };

const time = (id: 'start' | 'end' | 'length', ar: string, en: string, ph: string): OptionSpec => ({
	id,
	type: 'text',
	label: { ar, en },
	default: '',
	placeholder: { ar: ph, en: ph }
});

export const mediaTools: Tool[] = [
	media({
		id: 'video-to-mp4',
		from: VIDEO_INPUTS,
		to: ['mp4'],
		params: { to: 'mp4' },
		options: [height(0)],
		i18n: {
			ar: { title: 'تحويل الفيديو إلى MP4', desc: 'حوّل فيديو MOV من الآيفون أو WebM أو MKV إلى MP4 يعمل على أي جهاز وفي واتساب — على جهازك بدون رفع.', keywords: ['mp4', 'mov إلى mp4', 'تحويل فيديو', 'webm إلى mp4', 'mkv'] },
			en: { title: 'Convert video to MP4', desc: 'Turn iPhone MOV, WebM or MKV into MP4 that plays on any device and in WhatsApp — on your device, no upload.', keywords: ['mp4', 'mov to mp4', 'video converter', 'webm to mp4', 'mkv to mp4'] }
		}
	}),
	media({
		id: 'video-to-webm',
		from: VIDEO_INPUTS,
		to: ['webm'],
		params: { to: 'webm' },
		options: [height(0)],
		i18n: {
			ar: { title: 'تحويل الفيديو إلى WebM', desc: 'WebM صيغة مفتوحة وخفيفة لمواقع الإنترنت (VP9 أو AV1 مع Opus).', keywords: ['webm', 'mp4 إلى webm', 'فيديو للموقع'] },
			en: { title: 'Convert video to WebM', desc: 'WebM is an open, light format for websites (VP9 or AV1 with Opus).', keywords: ['webm', 'mp4 to webm', 'web video'] }
		}
	}),
	media({
		id: 'compress-video',
		from: VIDEO_INPUTS,
		to: [],
		params: { to: 'same' },
		options: [
			MEDIA_QUALITY,
			height(720),
			{ id: 'mute', type: 'checkbox', label: { ar: 'حذف الصوت', en: 'Remove the sound' }, default: false }
		],
		i18n: {
			ar: { title: 'ضغط الفيديو', desc: 'صغّر حجم الفيديو لإرساله على واتساب أو البريد، بتقليل الدقة ومعدل البت. الأصل يبقى إن لم يصغر.', keywords: ['ضغط فيديو', 'تصغير حجم الفيديو', 'compress video', 'فيديو واتساب'] },
			en: { title: 'Compress video', desc: 'Shrink a video for WhatsApp or email by lowering resolution and bitrate. The original is kept if it would not get smaller.', keywords: ['compress video', 'reduce video size', 'video compressor'] }
		}
	}),
	media({
		id: 'video-to-mp3',
		from: VIDEO_INPUTS,
		to: ['mp3', 'm4a', 'wav', 'ogg', 'flac'],
		options: [{ id: 'to', type: 'select', label: { ar: 'صيغة الصوت', en: 'Audio format' }, default: 'mp3', choices: AUDIO_OUT }, kbps],
		i18n: {
			ar: { title: 'استخراج الصوت من الفيديو', desc: 'احفظ صوت أي فيديو كملف MP3 أو M4A أو WAV — محاضرة، اجتماع، أو مقطع.', keywords: ['فيديو إلى mp3', 'استخراج الصوت', 'mp4 إلى mp3', 'video to mp3'] },
			en: { title: 'Extract audio from video', desc: 'Save the sound of any video as MP3, M4A or WAV — a lecture, a meeting or a clip.', keywords: ['video to mp3', 'extract audio', 'mp4 to mp3'] }
		}
	}),
	media({
		id: 'convert-audio',
		from: AUDIO_INPUTS,
		to: ['mp3', 'm4a', 'wav', 'ogg', 'flac'],
		options: [{ id: 'to', type: 'select', label: { ar: 'إلى صيغة', en: 'To format' }, default: 'mp3', choices: AUDIO_OUT }, kbps],
		i18n: {
			ar: { title: 'تحويل الصوت (MP3، WAV، M4A...)', desc: 'حوّل الملفات الصوتية بين MP3 وWAV وM4A وOGG وFLAC، ومنها رسائل واتساب الصوتية (OPUS).', keywords: ['تحويل صوت', 'mp3', 'wav إلى mp3', 'opus إلى mp3', 'فويس واتساب', 'm4a'] },
			en: { title: 'Convert audio (MP3, WAV, M4A...)', desc: 'Convert between MP3, WAV, M4A, OGG and FLAC — WhatsApp voice notes (OPUS) included.', keywords: ['audio converter', 'wav to mp3', 'opus to mp3', 'm4a to mp3', 'voice note'] }
		}
	}),
	media({
		id: 'trim-media',
		from: [...VIDEO_INPUTS, ...AUDIO_INPUTS],
		to: [],
		params: { to: 'same', trim: true },
		options: [time('start', 'من (دقيقة:ثانية)', 'From (min:sec)', '0:00'), time('end', 'إلى (فارغ = للنهاية)', 'To (empty = the end)', '1:30')],
		i18n: {
			ar: { title: 'قص الفيديو أو الصوت', desc: 'احتفظ بجزء من فيديو أو ملف صوتي بتحديد البداية والنهاية، غالبًا بدون إعادة ترميز.', keywords: ['قص فيديو', 'قص صوت', 'تقطيع', 'trim video', 'cut audio'] },
			en: { title: 'Trim video or audio', desc: 'Keep part of a video or audio file by setting a start and an end, usually without re-encoding.', keywords: ['trim video', 'cut video', 'cut audio', 'trim mp3'] }
		}
	}),
	media({
		id: 'mute-video',
		from: VIDEO_INPUTS,
		to: [],
		params: { to: 'same', mute: true },
		i18n: {
			ar: { title: 'إزالة الصوت من الفيديو', desc: 'احذف الصوت من الفيديو دون المساس بالصورة، في ثوانٍ.', keywords: ['حذف الصوت', 'كتم الفيديو', 'mute video', 'فيديو بدون صوت'] },
			en: { title: 'Remove sound from video', desc: 'Take the audio out of a video without touching the picture, in seconds.', keywords: ['mute video', 'remove audio', 'silent video'] }
		}
	}),
	media({
		id: 'rotate-video',
		from: VIDEO_INPUTS,
		to: [],
		params: { to: 'same' },
		options: [
			{
				id: 'rotate',
				type: 'select',
				label: { ar: 'التدوير', en: 'Rotate' },
				default: '90',
				choices: [
					{ value: '90', label: { ar: '90° مع عقارب الساعة', en: '90° clockwise' } },
					{ value: '180', label: { ar: '180°', en: '180°' } },
					{ value: '270', label: { ar: '90° عكس عقارب الساعة', en: '90° anticlockwise' } }
				]
			}
		],
		i18n: {
			ar: { title: 'تدوير الفيديو', desc: 'صحّح فيديو مصوّرًا بالعرض أو مقلوبًا.', keywords: ['تدوير فيديو', 'لف الفيديو', 'rotate video'] },
			en: { title: 'Rotate video', desc: 'Fix a video filmed sideways or upside down.', keywords: ['rotate video', 'flip video', 'turn video'] }
		}
	}),
	media({
		id: 'video-to-gif',
		engine: 'media-gif',
		from: VIDEO_INPUTS,
		to: ['gif'],
		options: [
			time('start', 'من (دقيقة:ثانية)', 'From (min:sec)', '0:00'),
			{ id: 'length', type: 'number', label: { ar: 'المدة (ثوانٍ، حتى 30)', en: 'Length (seconds, up to 30)' }, default: 5, min: 1, max: 30, unit: 's' },
			{ id: 'width', type: 'number', label: { ar: 'العرض', en: 'Width' }, default: 480, min: 80, max: 800, step: 10, unit: 'px' },
			{ id: 'fps', type: 'range', label: { ar: 'الإطارات في الثانية', en: 'Frames per second' }, default: 10, min: 2, max: 20 }
		],
		i18n: {
			ar: { title: 'فيديو إلى GIF', desc: 'اصنع صورة GIF متحركة من مقطع فيديو قصير لتستخدمها في العروض والرسائل.', keywords: ['gif', 'فيديو إلى gif', 'صورة متحركة', 'video to gif'] },
			en: { title: 'Video to GIF', desc: 'Make an animated GIF from a short part of a video, for slides and chats.', keywords: ['video to gif', 'gif maker', 'mp4 to gif'] }
		}
	})
];
