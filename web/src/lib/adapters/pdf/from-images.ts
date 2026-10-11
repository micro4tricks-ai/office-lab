import type { Adapter } from '../../registry/types';
import { decodeImage } from '../image/decode';
import { encodeImage, encodePng } from '../image/encode';
import { hasAlpha } from '../image/pixels';
import { scanLook } from '../ocr/prepare';
import { pdfLib, pdfOut, savePdf, withSuffix } from './lib';

const MM = 72 / 25.4;
const SIZES: Record<string, [number, number]> = { a4: [210 * MM, 297 * MM], letter: [612, 792] };

/** Images → one PDF, in the given order; page size, orientation and margins are options. */
const adapter: Adapter = {
	async convert(input, options, progress) {
		return adapter.combine!([input], options, progress);
	},
	async combine(inputs, options, progress) {
		const { PDFDocument } = await pdfLib();
		const doc = await PDFDocument.create();
		const size = String(options.pageSize ?? 'fit');
		const margin = Math.max(0, Number(options.margin) || 0) * MM;
		const quality = (Number(options.quality) || 90) / 100;
		for (const [i, file] of inputs.entries()) {
			const decoded = (await decodeImage(file)).image;
			const image = options.enhance === 'scan' ? scanLook(decoded) : decoded;
			const embedded = hasAlpha(image)
				? await doc.embedPng(await encodePng(image, false))
				: await doc.embedJpg(await encodeImage(image, 'jpg', quality));
			const iw = (image.width * 72) / 96;
			const ih = (image.height * 72) / 96;
			let pw: number;
			let ph: number;
			if (size === 'fit') [pw, ph] = [iw + 2 * margin, ih + 2 * margin];
			else {
				const [a, b] = SIZES[size] ?? SIZES.a4;
				const o = String(options.orientation ?? 'auto');
				const landscape = o === 'landscape' || (o === 'auto' && iw > ih);
				[pw, ph] = landscape ? [b, a] : [a, b];
			}
			// Fit inside the margins, never enlarge past 100% on a fixed page size.
			const s = Math.min((pw - 2 * margin) / iw, (ph - 2 * margin) / ih, size === 'fit' ? Infinity : 1);
			const w = iw * Math.min(s, size === 'fit' ? 1 : s);
			const h = ih * Math.min(s, size === 'fit' ? 1 : s);
			doc.addPage([pw, ph]).drawImage(embedded, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
			progress?.((i + 1) / inputs.length);
		}
		const name = inputs.length === 1 ? inputs[0].name : withSuffix(inputs[0].name, '-images');
		return [pdfOut(name.replace(/\.[^.]+$/, '.pdf'), await savePdf(doc))];
	}
};

export default adapter;
