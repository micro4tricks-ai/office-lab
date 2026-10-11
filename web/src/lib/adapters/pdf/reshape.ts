import type { PDFDocument, PDFPage } from '@cantoo/pdf-lib';
import { ConvertError, type Adapter, type FileData, type Placement } from '../../registry/types';
import { decodeImage } from '../image/decode';
import { encodeImage, encodePng } from '../image/encode';
import { hasAlpha } from '../image/pixels';
import { loadPdf, pdfLib, pdfOut, savePdf, withSuffix } from './lib';
import { toUser, visualSize } from './place';

const MM = 72 / 25.4;
export const PAPER: Record<string, [number, number]> = {
	a4: [210 * MM, 297 * MM],
	a3: [297 * MM, 420 * MM],
	a5: [148 * MM, 210 * MM],
	letter: [612, 792],
	legal: [612, 1008]
};

/** Pages drawn as pictures (redaction, flatten to image). `paint` may draw on a page's pixels first. */
async function rasterize(
	input: FileData,
	dpi: number,
	which: (n: number) => boolean,
	paint: (img: ImageData, n: number) => void,
	progress?: (r: number) => void
) {
	const { PDFDocument } = await pdfLib();
	const { openPdf } = await import('./pdfjs');
	const { renderPage } = await import('./render');
	const src = await loadPdf(input);
	const view = await openPdf(input);
	const out = await PDFDocument.create();
	const scale = dpi / 72;
	try {
		for (let n = 0; n < src.getPageCount(); n++) {
			if (!which(n)) {
				const [copy] = await out.copyPages(src, [n]);
				out.addPage(copy);
			} else {
				const img = await renderPage(view, n + 1, scale);
				paint(img, n);
				const jpg = await out.embedJpg(await encodeImage(img, 'jpg', 0.88));
				const w = img.width / scale;
				const h = img.height / scale;
				out.addPage([w, h]).drawImage(jpg, { x: 0, y: 0, width: w, height: h });
			}
			progress?.((n + 1) / src.getPageCount());
		}
	} finally {
		await view.loadingTask.destroy();
	}
	return out;
}

/** Black boxes over what must go; those pages become pictures, so the hidden text is really gone. */
async function redact(input: FileData, items: Placement[], dpi: number, progress?: (r: number) => void) {
	if (!items.length) throw new ConvertError('nothing');
	const onPage = (n: number) => items.filter((i) => i.page === n || i.page === -1);
	const doc = await rasterize(
		input,
		dpi,
		(n) => onPage(n).length > 0,
		(img, n) => {
			const W = img.width;
			const d = img.data;
			for (const b of onPage(n)) {
				const x0 = Math.max(0, Math.floor(b.x * W));
				const x1 = Math.min(W, Math.ceil((b.x + b.w) * W));
				const y0 = Math.max(0, Math.floor(b.y * img.height));
				const y1 = Math.min(img.height, Math.ceil((b.y + b.h) * img.height));
				for (let y = y0; y < y1; y++)
					for (let x = x0; x < x1; x++) {
						const i = (y * W + x) * 4;
						d[i] = d[i + 1] = d[i + 2] = 0;
					}
			}
		},
		progress
	);
	return pdfOut(withSuffix(input.name, '-redacted'), await savePdf(doc));
}

/** Every page onto a new sheet size, scaled to fit inside the margins and centred. */
async function pageSize(input: FileData, size: string, orientation: string, margin: number) {
	const { PDFDocument } = await pdfLib();
	const src = await loadPdf(input);
	const out = await PDFDocument.create();
	const [a, b] = PAPER[size] ?? PAPER.a4;
	for (const page of src.getPages()) {
		const { w: vw, h: vh, rot } = visualSize(page);
		const landscape = orientation === 'landscape' || (orientation === 'auto' && vw > vh);
		const [W, H] = landscape ? [b, a] : [a, b];
		const emb = await out.embedPage(page);
		// The embedded page is unrotated: fit its *visual* size, then turn it like the original.
		const s = Math.min((W - 2 * margin) / vw, (H - 2 * margin) / vh);
		const sheet = out.addPage([W, H]);
		const w = vw * s;
		const h = vh * s;
		const x = (W - w) / 2;
		const y = (H - h) / 2;
		drawTurned(sheet, emb, rot, x, y, w, h);
	}
	return pdfOut(withSuffix(input.name, `-${size}`), await savePdf(out));
}

/** Draws an embedded (unrotated) page so it looks the way /Rotate showed it, in the box x,y,w,h. */
function drawTurned(sheet: PDFPage, emb: Awaited<ReturnType<PDFDocument['embedPage']>>, rot: number, x: number, y: number, w: number, h: number) {
	// pdf-lib rotates around the bottom-left corner, counter-clockwise; /Rotate turns clockwise.
	const { degrees } = pdfLibSync!;
	if (rot === 90) sheet.drawPage(emb, { x, y: y + h, width: h, height: w, rotate: degrees(-90) });
	else if (rot === 180) sheet.drawPage(emb, { x: x + w, y: y + h, width: w, height: h, rotate: degrees(180) });
	else if (rot === 270) sheet.drawPage(emb, { x: x + w, y, width: h, height: w, rotate: degrees(90) });
	else sheet.drawPage(emb, { x, y, width: w, height: h });
}
let pdfLibSync: Awaited<ReturnType<typeof pdfLib>> | null = null;

/** Each page cut into two (a scanned book spread → two pages). Right-to-left books start with the right half. */
async function halve(input: FileData, direction: string, rtl: boolean) {
	const { PDFDocument } = await pdfLib();
	const src = await loadPdf(input);
	const out = await PDFDocument.create();
	for (const page of src.getPages()) {
		const { w: W, h: H } = visualSize(page);
		// Halves in what the reader sees (origin bottom-left).
		const halves: [number, number, number, number][] =
			direction === 'horizontal'
				? [
						[0, H / 2, W, H], // top first
						[0, 0, W, H / 2]
					]
				: rtl
					? [
							[W / 2, 0, W, H],
							[0, 0, W / 2, H]
						]
					: [
							[0, 0, W / 2, H],
							[W / 2, 0, W, H]
						];
		for (const [vx0, vy0, vx1, vy1] of halves) {
			const p = toUser(page, vx0, vy0);
			const q = toUser(page, vx1, vy1);
			const box = { left: Math.min(p.x, q.x), bottom: Math.min(p.y, q.y), right: Math.max(p.x, q.x), top: Math.max(p.y, q.y) };
			const emb = await out.embedPage(page, box);
			const sheet = out.addPage([box.right - box.left, box.top - box.bottom]);
			sheet.drawPage(emb, { x: 0, y: 0 });
			sheet.setRotation(page.getRotation());
		}
	}
	return pdfOut(withSuffix(input.name, '-halves'), await savePdf(out));
}

/**
 * Letterhead / stamp: a PDF page or an image drawn on the pages, under the content (letterhead
 * paper) or over it (a stamp), on every page or the first only.
 */
async function overlay(input: FileData, layer: FileData | null, under: boolean, firstOnly: boolean) {
	if (!layer) throw new ConvertError('nothing');
	const doc = await loadPdf(input);
	const isPdf = layer.bytes[0] === 0x25 && layer.bytes[1] === 0x50;
	let draw: (page: PDFPage) => void;
	if (isPdf) {
		const lh = await loadPdf(layer);
		const [emb] = await doc.embedPdf(lh, [0]);
		draw = (page) => {
			const { w, h, rot } = visualSize(page);
			const box = page.getCropBox();
			drawTurned(page, emb, rot, box.x, box.y, rot % 180 ? h : w, rot % 180 ? w : h);
		};
	} else {
		const { image } = await decodeImage(layer);
		const img = hasAlpha(image) ? await doc.embedPng(await encodePng(image, false)) : await doc.embedJpg(await encodeImage(image, 'jpg', 0.9));
		draw = (page) => {
			const box = page.getCropBox();
			page.drawImage(img, { x: box.x, y: box.y, width: box.width, height: box.height });
		};
	}
	const { PDFArray } = pdfLibSync!;
	const pages = doc.getPages();
	for (const page of firstOnly ? pages.slice(0, 1) : pages) {
		const before = contentCount(page, PDFArray);
		draw(page);
		if (under) {
			// What we drew went to the end of the page's content: move it to the front, under the text.
			const contents = page.node.Contents();
			if (contents instanceof PDFArray && contents.size() > before) {
				const added = contents.get(contents.size() - 1);
				contents.remove(contents.size() - 1);
				contents.insert(0, added);
			}
		}
	}
	return pdfOut(withSuffix(input.name, '-letterhead'), await savePdf(doc));
}

function contentCount(page: PDFPage, PDFArray: typeof import('@cantoo/pdf-lib').PDFArray) {
	// pdf-lib turns a single content stream into an array the first time it draws; count after that.
	page.node.normalize();
	const c = page.node.Contents();
	return c instanceof PDFArray ? c.size() : c ? 1 : 0;
}

/** Forms (keep the text) or everything (fields, comments, layers burned into pictures). */
async function flatten(input: FileData, mode: string, dpi: number, progress?: (r: number) => void) {
	if (mode === 'image') {
		const doc = await rasterize(input, dpi, () => true, () => {}, progress);
		return pdfOut(withSuffix(input.name, '-flat'), await savePdf(doc));
	}
	const doc = await loadPdf(input);
	const form = doc.getForm();
	if (!form.getFields().length) return { ...input, note: 'no-form' as const };
	form.flatten({ updateFieldAppearances: false });
	return pdfOut(withSuffix(input.name, '-flat'), await savePdf(doc));
}

/** params.action: redact | page-size | halve | overlay | flatten. */
const adapter: Adapter = {
	async convert(input, options, progress) {
		pdfLibSync ??= await pdfLib();
		const dpi = Math.min(300, Math.max(72, Number(options.dpi) || 200));
		switch (options.action) {
			case 'redact':
				return [await redact(input, (options.items ?? []) as Placement[], dpi, progress)];
			case 'page-size':
				return [await pageSize(input, String(options.size ?? 'a4'), String(options.orientation ?? 'auto'), Math.max(0, Number(options.margin) || 0) * MM)];
			case 'halve':
				return [await halve(input, String(options.direction ?? 'vertical'), options.order !== 'ltr')];
			case 'overlay':
				return [await overlay(input, (options.layer as FileData | null) ?? null, options.position !== 'over', options.pages === 'first')];
			case 'flatten':
				return [await flatten(input, String(options.mode ?? 'forms'), dpi, progress)];
			default:
				throw new ConvertError('unknown', `action ${String(options.action)}`);
		}
	}
};

export default adapter;
