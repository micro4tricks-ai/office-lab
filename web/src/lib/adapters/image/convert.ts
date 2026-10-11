import type { Adapter } from '../../registry/types';
import { decodeImage } from './decode';
import { encodeImage } from './encode';
import type { OutFormat } from './formats';
import { output, quality } from './output';

/** Any supported image → JPG / PNG / WebP / AVIF / ICO / PDF. */
const adapter: Adapter = {
	async convert(input, options, progress) {
		const format = String(options.format) as OutFormat;
		const { image } = await decodeImage(input);
		progress?.(0.4);
		return [output(input.name, format, await encodeImage(image, format, quality(options.quality)))];
	}
};

export default adapter;
