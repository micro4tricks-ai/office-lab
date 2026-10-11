import type { Adapter } from '../../registry/types';
import { textToPng } from '../text-image';
import { loadPdf, pdfOut, savePdf } from './lib';
import { digits } from './pages';
import { spot, stamp } from './place';

const MM = 72 / 25.4;
/** Text is drawn at 4× its printed size so it stays sharp when zoomed. */
const SHARP = 4;

function label(format: string, n: number, total: number, ar: boolean) {
	const d = (x: number) => digits(x, ar);
	switch (format) {
		case 'of':
			return `${d(n)} / ${d(total)}`;
		case 'page':
			return ar ? `صفحة ${d(n)} من ${d(total)}` : `Page ${n} of ${total}`;
		case 'dash':
			return `- ${d(n)} -`;
		default:
			return d(n);
	}
}

/** Adds page numbers: position, format, start number, Arabic-Indic digits, skip the cover. */
const adapter: Adapter = {
	async convert(input, options, progress) {
		const doc = await loadPdf(input);
		const pages = doc.getPages();
		const ar = options.digits === 'arabic';
		const size = Math.max(6, Number(options.size) || 11);
		const margin = Math.max(0, Number(options.margin) || 10) * MM;
		const start = Number.isFinite(Number(options.start)) ? Number(options.start) : 1;
		const skip = options.skipFirst === true ? 1 : 0;
		const total = pages.length - skip + start - 1;
		for (const [i, page] of pages.entries()) {
			if (i < skip) continue;
			const text = label(String(options.format ?? 'n'), i - skip + start, total, ar);
			const png = await textToPng(text, { px: size * SHARP, color: String(options.color || '#333333'), weight: 600 });
			const img = await doc.embedPng(png.png);
			const [w, h] = [png.width / SHARP, png.height / SHARP];
			stamp(page, img, { ...spot(page, String(options.position ?? 'bc'), w, h, margin), w, h });
			progress?.((i + 1) / pages.length);
		}
		return [pdfOut(input.name, await savePdf(doc))];
	}
};

export default adapter;
