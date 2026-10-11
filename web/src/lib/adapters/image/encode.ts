import type { OutFormat } from './formats';
import { writeIco } from './ico';
import { flatten, hasAlpha, square } from './pixels';

const u8 = (b: ArrayBuffer | Uint8Array) => (b instanceof Uint8Array ? b : new Uint8Array(b));

/** PNG with oxipng's lossless squeeze (level 2 is a good speed/size balance). */
export async function encodePng(img: ImageData, optimise = true): Promise<Uint8Array> {
	const png = await (await import('@jsquash/png/encode.js')).default(img);
	if (!optimise) return u8(png);
	const opt = (await import('@jsquash/oxipng/optimise.js')).default;
	return u8(await opt(png, { level: 2 }));
}

/** Encodes pixels; `quality` is 0–1 and only matters for lossy formats. */
export async function encodeImage(img: ImageData, format: OutFormat, quality = 0.82): Promise<Uint8Array> {
	const q = Math.round(Math.max(0.01, Math.min(1, quality)) * 100);
	switch (format) {
		case 'jpg': {
			const enc = (await import('@jsquash/jpeg/encode.js')).default;
			return u8(await enc(flatten(img), { quality: q }));
		}
		case 'png':
			return encodePng(img);
		case 'webp': {
			const enc = (await import('@jsquash/webp/encode.js')).default;
			return u8(await enc(img, { quality: q }));
		}
		case 'avif': {
			const enc = (await import('@jsquash/avif/encode.js')).default;
			// speed 8 keeps phones responsive; quality maps 1:1 to the encoder's 0–100 scale.
			return u8(await enc(img, { quality: q, speed: 8 }));
		}
		case 'ico': {
			const max = Math.min(256, Math.max(img.width, img.height));
			const sizes = [16, 24, 32, 48, 64, 128, 256].filter((s) => s <= max);
			if (!sizes.length) sizes.push(16);
			const entries = [];
			for (const size of sizes) entries.push({ size, png: await encodePng(await square(img, size, 'pad'), false) });
			return writeIco(entries);
		}
		case 'pdf':
			return imagesToPdf([img], quality);
	}
}

/** One page per image, page = image size at 96 dpi; JPEG inside unless the image has transparency. */
export async function imagesToPdf(images: ImageData[], quality = 0.9): Promise<Uint8Array> {
	const { PDFDocument } = await import('@cantoo/pdf-lib');
	const doc = await PDFDocument.create();
	for (const img of images) {
		const embedded = hasAlpha(img)
			? await doc.embedPng(await encodePng(img, false))
			: await doc.embedJpg(await encodeImage(img, 'jpg', quality));
		const w = (img.width * 72) / 96;
		const h = (img.height * 72) / 96;
		doc.addPage([w, h]).drawImage(embedded, { x: 0, y: 0, width: w, height: h });
	}
	doc.setProducer('Office Lab');
	doc.setCreator('Office Lab');
	return doc.save();
}
