import type { Adapter } from '../../registry/types';
import { decodeImage } from './decode';
import { encodeImage } from './encode';
import { sameFormat } from './formats';
import { output } from './output';
import { centreBox, crop, rotateFlip } from './pixels';

/** Rotate, flip, and crop to an aspect ratio (centred). */
const adapter: Adapter = {
	async convert(input, options, progress) {
		const { image, kind } = await decodeImage(input);
		progress?.(0.4);
		let img = rotateFlip(image, Number(options.rotate) || 0, options.flipH === true, options.flipV === true);
		const aspect = String(options.aspect ?? 'original');
		if (aspect !== 'original') {
			const [rw, rh] = aspect.split(':').map(Number);
			const b = centreBox(img.width, img.height, rw, rh);
			img = crop(img, b.x, b.y, b.w, b.h);
		}
		const format = sameFormat(kind);
		return [output(input.name, format, await encodeImage(img, format, 0.92))];
	}
};

export default adapter;
