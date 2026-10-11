import amiriArabic from '@fontsource/amiri/files/amiri-arabic-400-normal.woff?url';
import amiriLatin from '@fontsource/amiri/files/amiri-latin-400-normal.woff?url';
import type { PDFDocument, PDFFont, PDFPage } from '@cantoo/pdf-lib';
import { ConvertError, type Adapter, type FileData } from '../../registry/types';
import { decodeImage } from '../image/decode';
import { encodeImage, encodePng } from '../image/encode';
import { sniff } from '../image/formats';
import { loadPdf, pdfLib, savePdf } from '../pdf/lib';
import { toUser, visualSize } from '../pdf/place';
import { openPdf } from '../pdf/pdfjs';
import { renderPage } from '../pdf/render';
import { grayToRgba, prepareForOcr, toOriginal } from './prepare';

/** Scanned PDFs are capped in the browser (each page is a full OCR run). */
export const MAX_PAGES = 20;
/** Pages are rendered at this resolution for recognition. */
const DPI = 300;

type Word = { text: string; x0: number; y0: number; x1: number; y1: number };
type PageResult = { text: string; words: Word[]; width: number; height: number };

/** Where scripts/copy-assets.mjs put Tesseract (same trick as pdf.js: works under /office-lab/). */
function assets() {
	const href = self.location.href;
	const i = href.indexOf('/_app/');
	return (i >= 0 ? href.slice(0, i) : self.location.origin) + '/tesseract/';
}

async function makeWorker(langs: string, progress: (r: number) => void) {
	const { createWorker } = await import('tesseract.js');
	const root = assets();
	return createWorker(langs, 1, {
		workerPath: root + 'worker.min.js',
		corePath: root.slice(0, -1),
		langPath: root + 'lang',
		gzip: true,
		workerBlobURL: false,
		logger: (m: { status: string; progress: number }) => {
			if (m.status === 'recognizing text') progress(m.progress);
		}
	});
}

type TWorker = Awaited<ReturnType<typeof makeWorker>>;

/** Evens the light and straightens the page first (see prepare.ts); word boxes come back in the original's pixels. */
async function recognise(worker: TWorker, image: ImageData): Promise<PageResult> {
	const prep = prepareForOcr(image.data, image.width, image.height);
	const png = await encodePng(new ImageData(grayToRgba(prep.gray), prep.width, prep.height), false);
	const { data } = await worker.recognize(new Blob([png as Uint8Array<ArrayBuffer>], { type: 'image/png' }), {}, { text: true, blocks: true });
	const words: Word[] = [];
	for (const b of data.blocks ?? [])
		for (const p of b.paragraphs)
			for (const l of p.lines)
				for (const w of l.words) if (w.text.trim()) words.push({ text: w.text, ...toOriginal(prep, w.bbox) });
	return { text: data.text.trim(), words, width: image.width, height: image.height };
}

const isArabic = (s: string) => /[؀-ۿ]/.test(s);

/**
 * Invisible text over each recognised word, so the PDF can be searched and copied.
 * (x, y) of a word are pixels of the page as rendered, origin top-left.
 */
async function textLayer(page: PDFPage, r: PageResult, fonts: { ar: PDFFont; en: PDFFont }) {
	const { degrees } = await pdfLib();
	const { w: W, h: H } = visualSize(page);
	const sx = W / r.width;
	const sy = H / r.height;
	for (const word of r.words) {
		const font = isArabic(word.text) ? fonts.ar : fonts.en;
		const h = (word.y1 - word.y0) * sy;
		const w = (word.x1 - word.x0) * sx;
		let size = Math.max(2, h * 0.85);
		const natural = font.widthOfTextAtSize(word.text, size);
		if (natural > 0) size = Math.max(2, Math.min(size * 1.6, size * (w / natural)));
		const { x, y, rot } = toUser(page, word.x0 * sx, H - word.y1 * sy + h * 0.15);
		page.drawText(word.text, { x, y, size, font, opacity: 0, rotate: degrees(rot) });
	}
}

async function embedFonts(doc: PDFDocument) {
	const fontkit = (await import('@pdf-lib/fontkit')).default;
	doc.registerFontkit(fontkit);
	const load = async (url: string) => new Uint8Array(await (await fetch(url)).arrayBuffer());
	// The layer is invisible, so no shaping: one plain glyph per character keeps the
	// ToUnicode map exact (shaped Arabic glyphs extract as garbage).
	const off = Object.fromEntries(
		['init', 'medi', 'fina', 'isol', 'liga', 'rlig', 'calt', 'ccmp', 'mark', 'mkmk', 'curs', 'kern', 'locl'].map((f) => [f, false])
	);
	return {
		// Whole fonts (~160 KB): fontkit's subsetter fails on these WOFF files.
		ar: await doc.embedFont(await load(amiriArabic), { subset: false, features: off }),
		en: await doc.embedFont(await load(amiriLatin), { subset: false, features: off })
	};
}

/** Image or scanned PDF → text (TXT) or a searchable PDF, in Arabic, English or both. */
const adapter: Adapter = {
	async convert(input, options, progress) {
		const langs = String(options.lang || 'ara+eng').replace(/[^a-z+]/g, '') || 'ara+eng';
		const want = options.output === 'pdf' ? 'pdf' : 'txt';
		const isPdf = input.bytes[0] === 0x25 && input.bytes[1] === 0x50; // %P
		const pages: PageResult[] = [];
		let limited = false;

		let done = 0;
		let total = 1;
		const worker = await makeWorker(langs, (r) => progress?.((done + r) / total));
		// 6 = one block of text (letters, invoices, tables: far better on photos); 3 = automatic layout (columns).
		await worker.setParameters({ tessedit_pageseg_mode: (options.layout === 'columns' ? '3' : '6') as never });
		try {
			if (isPdf) {
				const pdf = await openPdf(input);
				total = Math.min(pdf.numPages, MAX_PAGES);
				limited = pdf.numPages > MAX_PAGES;
				for (let n = 1; n <= total; n++) {
					const img = await renderPage(pdf, n, DPI / 72);
					pages.push(await recognise(worker, img));
					done = n;
				}
				await pdf.loadingTask.destroy();
			} else {
				if (!sniff(input.bytes)) throw new ConvertError('wrong-type');
				const { image } = await decodeImage(input);
				pages.push(await recognise(worker, image));
			}
		} finally {
			await worker.terminate();
		}

		const base = input.name.replace(/\.[^.]+$/, '');
		if (!pages.some((p) => p.text)) throw new ConvertError('nothing');

		if (want === 'txt') {
			const text = pages.length > 1 ? pages.map((p, i) => `--- ${i + 1} ---\n${p.text}`).join('\n\n') : pages[0].text;
			const out: FileData = { name: `${base}.txt`, type: 'text/plain;charset=utf-8', bytes: new TextEncoder().encode(text + '\n') };
			return [limited ? { ...out, note: 'ocr-limit' } : out];
		}

		let doc: PDFDocument;
		if (isPdf) {
			doc = await loadPdf(input);
			const fonts = await embedFonts(doc);
			for (const [i, r] of pages.entries()) await textLayer(doc.getPage(i), r, fonts);
		} else {
			const { PDFDocument } = await pdfLib();
			doc = await PDFDocument.create();
			const fonts = await embedFonts(doc);
			const { image } = await decodeImage(input);
			const jpg = await doc.embedJpg(await encodeImage(image, 'jpg', 0.85));
			const page = doc.addPage([(image.width * 72) / 96, (image.height * 72) / 96]);
			page.drawImage(jpg, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
			await textLayer(page, pages[0], fonts);
		}
		const out: FileData = { name: `${base}${isPdf ? '-ocr' : ''}.pdf`, type: 'application/pdf', bytes: await savePdf(doc) };
		return [limited ? { ...out, note: 'ocr-limit' } : out];
	}
};

export default adapter;
