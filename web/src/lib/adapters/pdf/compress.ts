import type { Adapter } from '../../registry/types';
import { encodeImage } from '../image/encode';
import { resize } from '../image/pixels';
import { loadPdf, pdfLib, pdfOut } from './lib';

/** quality (0–1) and longest side kept for photos, per level. */
const LEVELS: Record<string, [number, number]> = {
	light: [0.8, 3000],
	medium: [0.68, 2200],
	strong: [0.55, 1500]
};

/**
 * Basic compression: re-encode embedded JPEG photos (smaller ones replace the originals),
 * shrink oversized ones, and pack objects into streams. Never returns a bigger file.
 */
const adapter: Adapter = {
	async convert(input, options, progress) {
		const { PDFName, PDFRawStream, PDFNumber } = await pdfLib();
		const doc = await loadPdf(input);
		const [quality, maxSide] = LEVELS[String(options.level)] ?? LEVELS.medium;
		const objects = doc.context.enumerateIndirectObjects();
		let done = 0;
		for (const [ref, obj] of objects) {
			done++;
			if (!(obj instanceof PDFRawStream)) continue;
			const dict = obj.dict;
			if (dict.get(PDFName.of('Subtype')) !== PDFName.of('Image')) continue;
			if (dict.get(PDFName.of('Filter')) !== PDFName.of('DCTDecode')) continue; // JPEG only
			const cs = dict.get(PDFName.of('ColorSpace'));
			if (cs !== PDFName.of('DeviceRGB') && cs !== PDFName.of('DeviceGray')) continue; // keep CMYK, ICC, indexed
			if (dict.get(PDFName.of('Decode'))) continue;
			try {
				const bmp = await createImageBitmap(new Blob([obj.contents as Uint8Array<ArrayBuffer>], { type: 'image/jpeg' }));
				const ctx = new OffscreenCanvas(bmp.width, bmp.height).getContext('2d')!;
				ctx.drawImage(bmp, 0, 0);
				bmp.close();
				let img = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
				const s = Math.min(1, maxSide / Math.max(img.width, img.height));
				if (s < 1) img = await resize(img, img.width * s, img.height * s);
				const jpg = await encodeImage(img, 'jpg', quality);
				if (jpg.length >= obj.contents.length * 0.95) continue;
				const next = dict.clone(doc.context);
				next.set(PDFName.of('Width'), PDFNumber.of(img.width));
				next.set(PDFName.of('Height'), PDFNumber.of(img.height));
				next.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'));
				next.set(PDFName.of('BitsPerComponent'), PDFNumber.of(8));
				next.set(PDFName.of('Length'), PDFNumber.of(jpg.length));
				next.delete(PDFName.of('DecodeParms'));
				doc.context.assign(ref, PDFRawStream.of(next, jpg));
			} catch {
				/* an image the browser can't decode stays as it is */
			}
			progress?.(Math.min(0.9, done / objects.length));
		}
		doc.setProducer('Office Lab');
		const bytes = await doc.save({ useObjectStreams: true });
		if (bytes.length >= input.bytes.length) return [{ ...pdfOut(input.name, input.bytes), note: 'kept-original' }];
		return [pdfOut(input.name, bytes)];
	}
};

export default adapter;
