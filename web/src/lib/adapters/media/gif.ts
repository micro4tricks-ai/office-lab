import { CanvasSink } from 'mediabunny';
import { GIFEncoder, applyPalette, quantize } from 'gifenc';
import { ConvertError, type Adapter } from '../../registry/types';
import { openInput } from './convert';
import { parseTime, splitName } from './time';

/** Longest clip a GIF may hold: GIFs of more than a few seconds get huge. */
export const MAX_GIF_SECONDS = 30;

/** A short clip of a video as an animated GIF (frames from WebCodecs, palette by gifenc). */
const adapter: Adapter = {
	async convert(file, o, onProgress) {
		const fps = Math.min(20, Math.max(2, Number(o.fps) || 10));
		const width = Math.min(800, Math.max(80, Number(o.width) || 480));
		const start = parseTime(String(o.start ?? '')) ?? 0;
		const length = parseTime(String(o.length ?? '')) ?? 5;
		if (!Number.isFinite(start) || !Number.isFinite(length) || length <= 0) throw new ConvertError('options');
		const input = openInput(file);
		try {
			const track = await input.getPrimaryVideoTrack().catch(() => null);
			if (!track) throw new ConvertError('wrong-type');
			if (!(await track.canDecode())) throw new ConvertError('codec');
			const duration = await input.computeDuration();
			if (start >= duration) throw new ConvertError('options', 'start after the end');
			const end = Math.min(duration, start + Math.min(length, MAX_GIF_SECONDS));
			const [dw, dh] = [await track.getDisplayWidth(), await track.getDisplayHeight()];
			const scale = Math.min(1, width / dw);
			const w = Math.max(2, Math.round(dw * scale));
			const h = Math.max(2, Math.round(dh * scale));
			const sink = new CanvasSink(track, { width: w, height: h, fit: 'fill' });
			const times: number[] = [];
			for (let t = start; t < end; t += 1 / fps) times.push(t);
			const gif = GIFEncoder();
			const delay = Math.round(1000 / fps);
			let i = 0;
			for await (const frame of sink.canvasesAtTimestamps(times)) {
				i++;
				if (!frame) continue;
				const ctx = (frame.canvas as OffscreenCanvas).getContext('2d')!;
				const { data } = ctx.getImageData(0, 0, w, h);
				const palette = quantize(data, 256);
				gif.writeFrame(applyPalette(data, palette), w, h, { palette, delay });
				onProgress?.(Math.min(0.99, i / times.length));
			}
			gif.finish();
			const [stem] = splitName(file.name);
			return [{ name: `${stem}.gif`, type: 'image/gif', bytes: gif.bytes() }];
		} finally {
			input.dispose();
		}
	}
};

export default adapter;
