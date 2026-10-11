import { ConvertError, type Adapter, type FileData } from '../../registry/types';
import { encodeImage } from '../image/encode';
import { MIME, type OutFormat } from '../image/formats';
import { withSuffix } from './lib';
import { openPdf, pdfjs } from './pdfjs';

type PdfImage = { width: number; height: number; bitmap?: ImageBitmap; data?: Uint8ClampedArray; kind?: number };

/** pdf.js image object → RGBA ImageData. */
function toImageData(img: PdfImage, kinds: { GRAYSCALE_1BPP: number; RGB_24BPP: number }): ImageData | null {
	const { width: w, height: h } = img;
	if (img.bitmap) {
		const ctx = new OffscreenCanvas(w, h).getContext('2d')!;
		ctx.drawImage(img.bitmap, 0, 0);
		return ctx.getImageData(0, 0, w, h);
	}
	if (!img.data) return null;
	const out = new ImageData(w, h);
	const d = out.data;
	const src = img.data;
	if (img.kind === kinds.RGB_24BPP) {
		for (let i = 0, j = 0; j < d.length; i += 3, j += 4) {
			d[j] = src[i];
			d[j + 1] = src[i + 1];
			d[j + 2] = src[i + 2];
			d[j + 3] = 255;
		}
	} else if (img.kind === kinds.GRAYSCALE_1BPP) {
		const row = (w + 7) >> 3;
		for (let y = 0; y < h; y++)
			for (let x = 0; x < w; x++) {
				const v = (src[y * row + (x >> 3)] >> (7 - (x & 7))) & 1 ? 255 : 0;
				d.set([v, v, v, 255], (y * w + x) * 4);
			}
	} else d.set(src.subarray(0, d.length));
	return out;
}

/** Every embedded picture, once each (a logo repeated on every page is saved once). */
const adapter: Adapter = {
	async convert(input, options, progress) {
		const { OPS, ImageKind } = await pdfjs();
		const doc = await openPdf(input);
		const format = String(options.format ?? 'png') as OutFormat;
		const seen = new Set<string>();
		const out: FileData[] = [];
		for (let n = 1; n <= doc.numPages; n++) {
			const page = await doc.getPage(n);
			const ops = await page.getOperatorList();
			for (let k = 0; k < ops.fnArray.length; k++) {
				if (ops.fnArray[k] !== OPS.paintImageXObject) continue;
				const id = ops.argsArray[k][0] as string;
				if (seen.has(id)) continue;
				seen.add(id);
				const store = id.startsWith('g_') ? page.commonObjs : page.objs;
				const img = await new Promise<PdfImage>((resolve) => store.get(id, resolve as (d: unknown) => void));
				if (!img || img.width < 16 || img.height < 16) continue;
				const data = toImageData(img, ImageKind);
				if (!data) continue;
				out.push({
					name: withSuffix(input.name, `-p${n}-${out.length + 1}`, format),
					type: MIME[format],
					bytes: await encodeImage(data, format, 0.92)
				});
			}
			page.cleanup();
			progress?.(n / doc.numPages);
		}
		await doc.loadingTask.destroy();
		if (!out.length) throw new ConvertError('nothing');
		return out;
	}
};

export default adapter;
