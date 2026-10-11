import type { Adapter } from '../../registry/types';
import { decodeImage } from './decode';
import { encodeImage } from './encode';
import { sameFormat, sniff, type OutFormat } from './formats';
import { output, quality } from './output';

/** Smaller files at a chosen quality; never returns something bigger than the original. */
const adapter: Adapter = {
	async convert(input, options, progress) {
		const kind = sniff(input.bytes);
		const wanted = String(options.format ?? 'same');
		const format: OutFormat = wanted === 'same' ? sameFormat(kind) : (wanted as OutFormat);
		let bytes: Uint8Array;
		if (kind === 'png' && format === 'png') {
			// Lossless: oxipng re-packs the original PNG without touching pixels.
			const opt = (await import('@jsquash/oxipng/optimise.js')).default;
			bytes = new Uint8Array(await opt(input.bytes.slice().buffer, { level: 3 }));
		} else {
			const { image } = await decodeImage(input);
			progress?.(0.4);
			bytes = await encodeImage(image, format, quality(options.quality, 75));
		}
		if (kind === format && bytes.length >= input.bytes.length) {
			return [output(input.name, format, input.bytes, 'kept-original')];
		}
		return [output(input.name, format, bytes)];
	}
};

export default adapter;
