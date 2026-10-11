import { ConvertError, type Adapter, type FileData } from '../../registry/types';
import { MAX_PIXELS } from '../image/decode';
import { encodeImage } from '../image/encode';
import { MIME, type OutFormat } from '../image/formats';
import { withSuffix } from './lib';
import { parsePages } from './pages';
import { openPdf } from './pdfjs';

/** Draws one page to RGBA pixels on a white background. */
export async function renderPage(doc: Awaited<ReturnType<typeof openPdf>>, n: number, scale: number) {
	const page = await doc.getPage(n);
	const viewport = page.getViewport({ scale });
	const w = Math.ceil(viewport.width);
	const h = Math.ceil(viewport.height);
	if (w * h > MAX_PIXELS) throw new ConvertError('too-big', 'page too large at this DPI');
	const canvas = new OffscreenCanvas(w, h);
	const ctx = canvas.getContext('2d')!;
	ctx.fillStyle = '#ffffff';
	ctx.fillRect(0, 0, w, h);
	await page.render({
		canvasContext: ctx as unknown as CanvasRenderingContext2D,
		canvas: canvas as unknown as HTMLCanvasElement,
		viewport
	}).promise;
	page.cleanup();
	return ctx.getImageData(0, 0, w, h);
}

/** PDF pages → JPG / PNG / WebP at a chosen DPI. */
const adapter: Adapter = {
	async convert(input, options, progress) {
		const doc = await openPdf(input);
		const format = String(options.format ?? 'jpg') as OutFormat;
		const scale = (Number(options.dpi) || 150) / 72;
		let list: number[];
		try {
			list = parsePages(String(options.pages ?? ''), doc.numPages);
		} catch {
			throw new ConvertError('pages');
		}
		const out: FileData[] = [];
		for (const [k, i] of list.entries()) {
			const pixels = await renderPage(doc, i + 1, scale);
			const bytes = await encodeImage(pixels, format, 0.9);
			out.push({ name: withSuffix(input.name, `-p${i + 1}`, format), type: MIME[format], bytes });
			progress?.((k + 1) / list.length);
		}
		await doc.loadingTask.destroy();
		return out;
	}
};

export default adapter;
