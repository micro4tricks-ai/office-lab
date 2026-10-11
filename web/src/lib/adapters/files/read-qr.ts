import { ConvertError, type Adapter } from '../../registry/types';
import { decodeImage } from '../image/decode';
import { resize } from '../image/pixels';

/** Finds and reads a QR code in a photo or screenshot; the text comes out as a .txt file. */
const adapter: Adapter = {
	async convert(input) {
		const jsQR = (await import('jsqr')).default;
		let { image } = await decodeImage(input);
		// Big photos: scan a smaller copy first (faster, and jsQR copes better).
		const tries = [1600, 900, Infinity];
		for (const max of tries) {
			const s = Math.min(1, max / Math.max(image.width, image.height));
			const img = s < 1 ? await resize(image, image.width * s, image.height * s) : image;
			const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });
			if (code?.data) {
				const name = input.name.replace(/\.[^.]+$/, '') + '-qr.txt';
				return [{ name, type: 'text/plain;charset=utf-8', bytes: new TextEncoder().encode(code.data + '\n') }];
			}
		}
		throw new ConvertError('nothing');
	}
};

export default adapter;
