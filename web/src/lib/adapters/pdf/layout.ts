import type { PDFDocument, PDFEmbeddedPage } from '@cantoo/pdf-lib';
import { ConvertError, type Adapter } from '../../registry/types';
import { textToPng } from '../text-image';
import { loadPdf, pdfLib, pdfOut, savePdf, withSuffix } from './lib';
import { digits } from './pages';
import { spot, stamp, visualSize } from './place';

const MM = 72 / 25.4;
const A4: [number, number] = [210 * MM, 297 * MM];

/**
 * Saddle-stitch order: for k pages (a multiple of 4), sheet s front = [k-1-2s, 2s],
 * back = [2s+1, k-2-2s] (left, right; 0-based). Right-to-left books swap each pair.
 */
export function bookletOrder(k: number, rtl: boolean): [number, number][] {
	const sides: [number, number][] = [];
	for (let s = 0; s < k / 4; s++) {
		sides.push([k - 1 - 2 * s, 2 * s], [2 * s + 1, k - 2 - 2 * s]);
	}
	return rtl ? sides.map(([l, r]) => [r, l]) : sides;
}

/** Draws embedded pages into a grid on new sheets (n-up and booklet). */
async function grid(out: PDFDocument, cells: (PDFEmbeddedPage | null)[][], sheet: [number, number], cols: number, rows: number, gap: number) {
	for (const group of cells) {
		const page = out.addPage(sheet);
		const cw = (sheet[0] - gap * (cols + 1)) / cols;
		const ch = (sheet[1] - gap * (rows + 1)) / rows;
		group.forEach((emb, i) => {
			if (!emb) return;
			const col = i % cols;
			const row = Math.floor(i / cols);
			const s = Math.min(cw / emb.width, ch / emb.height);
			const w = emb.width * s;
			const h = emb.height * s;
			const x = gap + col * (cw + gap) + (cw - w) / 2;
			const y = sheet[1] - (gap + (row + 1) * ch + row * gap) + (ch - h) / 2;
			page.drawPage(emb, { x, y, width: w, height: h });
		});
	}
}

/** Layout tools on one PDF; params.action: grayscale | nup | blank | booklet | header. */
const adapter: Adapter = {
	async convert(input, options, progress) {
		const action = String(options.action);
		const { PDFDocument } = await pdfLib();

		if (action === 'grayscale') {
			const { openPdf } = await import('./pdfjs');
			const { renderPage } = await import('./render');
			const { encodeImage } = await import('../image/encode');
			const src = await openPdf(input);
			const out = await PDFDocument.create();
			const scale = (Number(options.dpi) || 150) / 72;
			for (let n = 1; n <= src.numPages; n++) {
				const img = await renderPage(src, n, scale);
				const d = img.data;
				for (let i = 0; i < d.length; i += 4) d[i] = d[i + 1] = d[i + 2] = Math.round(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
				const jpg = await out.embedJpg(await encodeImage(img, 'jpg', 0.85));
				const w = img.width / scale;
				const h = img.height / scale;
				out.addPage([w, h]).drawImage(jpg, { x: 0, y: 0, width: w, height: h });
				progress?.(n / src.numPages);
			}
			await src.loadingTask.destroy();
			return [pdfOut(withSuffix(input.name, '-bw'), await savePdf(out))];
		}

		const src = await loadPdf(input);
		const count = src.getPageCount();

		if (action === 'nup') {
			const per = Number(options.per) === 4 ? 4 : 2;
			const out = await PDFDocument.create();
			const embedded = await out.embedPages(src.getPages());
			const order = options.order === 'rtl';
			const groups: (PDFEmbeddedPage | null)[][] = [];
			for (let i = 0; i < count; i += per) {
				const g: (PDFEmbeddedPage | null)[] = embedded.slice(i, i + per);
				while (g.length < per) g.push(null);
				// Right-to-left reading: first page on the right of each row.
				if (order) for (let r = 0; r < per; r += 2) [g[r], g[r + 1]] = [g[r + 1], g[r]];
				groups.push(g);
			}
			const sheet: [number, number] = per === 2 ? [A4[1], A4[0]] : A4;
			await grid(out, groups, sheet, 2, per === 2 ? 1 : 2, 8 * MM);
			return [pdfOut(withSuffix(input.name, `-${per}up`), await savePdf(out))];
		}

		if (action === 'booklet') {
			const out = await PDFDocument.create();
			const embedded = await out.embedPages(src.getPages());
			const k = Math.ceil(count / 4) * 4;
			const sides = bookletOrder(k, options.binding === 'right');
			await grid(out, sides.map(([l, r]) => [embedded[l] ?? null, embedded[r] ?? null]), [A4[1], A4[0]], 2, 1, 6 * MM);
			return [pdfOut(withSuffix(input.name, '-booklet'), await savePdf(out))];
		}

		if (action === 'blank') {
			const out = await PDFDocument.create();
			const pages = await out.copyPages(src, src.getPageIndices());
			const where = String(options.where ?? 'end');
			const after = Math.max(0, Math.min(count, Number(options.after) || 0));
			const blank = (like: { getWidth(): number; getHeight(): number }) => out.addPage([like.getWidth(), like.getHeight()]);
			if (where === 'start') blank(pages[0]);
			pages.forEach((p, i) => {
				out.addPage(p);
				if (where === 'each' || (where === 'after' && i + 1 === after)) blank(p);
			});
			if (where === 'end') blank(pages[count - 1]);
			return [pdfOut(input.name, await savePdf(out))];
		}

		if (action === 'header') {
			const header = String(options.header ?? '').trim();
			const footer = String(options.footer ?? '').trim();
			if (!header && !footer) throw new ConvertError('nothing');
			const ar = options.digits === 'arabic';
			const size = Math.max(6, Number(options.size) || 10);
			const margin = 10 * MM;
			const date = new Intl.DateTimeFormat(ar ? 'ar-EG' : 'en-GB', { dateStyle: 'medium' }).format(new Date());
			const fill = (tpl: string, n: number) =>
				tpl.replace(/\{page\}/g, digits(n, ar)).replace(/\{pages\}/g, digits(count, ar)).replace(/\{date\}/g, date).replace(/\{file\}/g, input.name.replace(/\.[^.]+$/, ''));
			const align = String(options.align ?? 'c');
			const skip = options.skipFirst === true;
			for (const [i, page] of src.getPages().entries()) {
				if (skip && i === 0) continue;
				for (const [tpl, row] of [[header, 't'], [footer, 'b']] as const) {
					if (!tpl) continue;
					const png = await textToPng(fill(tpl, i + 1), { px: size * 4, color: String(options.color || '#444444'), weight: 600 });
					const img = await src.embedPng(png.png);
					const [w, h] = [png.width / 4, png.height / 4];
					const { w: W } = visualSize(page);
					stamp(page, img, { ...spot(page, row + align, Math.min(w, W - 2 * margin), h, margin), w, h });
				}
				progress?.((i + 1) / count);
			}
			return [pdfOut(input.name, await savePdf(src))];
		}

		throw new Error(`unknown action ${action}`);
	}
};

export default adapter;
