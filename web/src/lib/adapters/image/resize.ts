import type { Adapter } from '../../registry/types';
import { decodeImage } from './decode';
import { encodeImage } from './encode';
import { sameFormat, type OutFormat } from './formats';
import { output, quality } from './output';
import { resize } from './pixels';
import { fitToSize } from './target-size';

/** Resize by pixels, by percent, or to a target file size in KB. */
const adapter: Adapter = {
	async convert(input, options, progress) {
		const { image, kind } = await decodeImage(input);
		progress?.(0.3);
		const wanted = String(options.format ?? 'same');
		const format: OutFormat = wanted === 'same' ? sameFormat(kind) : (wanted as OutFormat);
		const mode = String(options.mode ?? 'px');

		if (mode === 'kb') {
			const target = Math.max(1, Number(options.targetKB) || 100) * 1024;
			const res = await fitToSize(
				async (q, scale) => encodeImage(await resize(image, image.width * scale, image.height * scale), format, q),
				target,
				format === 'png' ? { steps: 1 } : {}
			);
			return [output(input.name, format, res.bytes, res.fits ? undefined : 'target-missed')];
		}

		let w: number;
		let h: number;
		if (mode === 'percent') {
			const p = Math.max(1, Number(options.percent) || 50) / 100;
			w = image.width * p;
			h = image.height * p;
		} else {
			const ow = Number(options.width) || 0;
			const oh = Number(options.height) || 0;
			const ratio = image.width / image.height;
			if (options.keepRatio !== false) {
				// Fit inside the box; an empty side follows the other.
				if (ow && oh) {
					const s = Math.min(ow / image.width, oh / image.height);
					w = image.width * s;
					h = image.height * s;
				} else if (ow) [w, h] = [ow, ow / ratio];
				else if (oh) [w, h] = [oh * ratio, oh];
				else [w, h] = [image.width, image.height];
			} else [w, h] = [ow || image.width, oh || image.height];
		}
		const resized = await resize(image, w, h);
		progress?.(0.7);
		return [output(input.name, format, await encodeImage(resized, format, quality(options.quality, 85)))];
	}
};

export default adapter;
