import { ConvertError, type FileData } from '../../registry/types';

type PdfJs = typeof import('pdfjs-dist');
let lib: Promise<PdfJs> | null = null;

/** pdf.js with its "worker" running in this (already off-main-thread) worker. */
export function pdfjs(): Promise<PdfJs> {
	lib ??= (async () => {
		(globalThis as unknown as { pdfjsWorker: unknown }).pdfjsWorker = await import('pdfjs-dist/build/pdf.worker.mjs');
		return import('pdfjs-dist');
	})();
	return lib;
}

/** pdf.js's default canvas factory needs `document`; workers only have OffscreenCanvas. */
class OffscreenCanvasFactory {
	create(width: number, height: number) {
		if (width <= 0 || height <= 0) throw new Error('Invalid canvas size');
		const canvas = new OffscreenCanvas(width, height);
		return { canvas, context: canvas.getContext('2d', { willReadFrequently: true }) };
	}
	reset(target: { canvas: OffscreenCanvas }, width: number, height: number) {
		target.canvas.width = width;
		target.canvas.height = height;
	}
	destroy(target: { canvas: OffscreenCanvas | null; context: unknown }) {
		if (target.canvas) target.canvas.width = target.canvas.height = 0;
		target.canvas = null;
		target.context = null;
	}
}

/** SVG filters (high-contrast modes, selection) need the DOM; on export "none" is right anyway. */
class NoFilterFactory {
	addFilter() {
		return 'none';
	}
	addHCMFilter() {
		return 'none';
	}
	addAlphaFilter() {
		return 'none';
	}
	addLuminosityFilter() {
		return 'none';
	}
	addKnockoutFilter() {
		return 'none';
	}
	addHighlightHCMFilter() {
		return 'none';
	}
	addSelectionHCMFilter() {
		return 'none';
	}
	addSelectionFilter() {
		return 'none';
	}
	createSelectionStyle() {
		return '';
	}
	destroy() {}
}

/** Where scripts/copy-assets.mjs put pdf.js's cmaps, fonts and wasm (works under /office-lab/ too). */
function assets() {
	const href = self.location.href;
	const i = href.indexOf('/_app/');
	return (i >= 0 ? href.slice(0, i) : self.location.origin) + '/pdfjs/';
}

export async function openPdf(file: FileData, password?: string) {
	const { getDocument } = await pdfjs();
	const root = assets();
	const task = getDocument({
		data: file.bytes.slice(),
		password: password || undefined,
		cMapUrl: root + 'cmaps/',
		cMapPacked: true,
		standardFontDataUrl: root + 'standard_fonts/',
		wasmUrl: root + 'wasm/',
		iccUrl: root + 'iccs/',
		isOffscreenCanvasSupported: true,
		disableFontFace: true,
		useWorkerFetch: false,
		// No DOM in a worker: canvases and font lookups go through these instead.
		CanvasFactory: OffscreenCanvasFactory,
		FilterFactory: NoFilterFactory,
		ownerDocument: { fonts: (self as unknown as { fonts: FontFaceSet }).fonts },
		verbosity: 0
	} as Parameters<PdfJs['getDocument']>[0]);
	try {
		return await task.promise;
	} catch (e) {
		const name = (e as { name?: string })?.name;
		if (name === 'PasswordException') throw new ConvertError('password');
		throw new ConvertError('corrupted', e instanceof Error ? e.message : String(e));
	}
}

export type PdfDoc = Awaited<ReturnType<typeof openPdf>>;

/** Text of every page (line breaks kept), via pdf.js. */
export async function pageTexts(doc: PdfDoc): Promise<string[]> {
	const out: string[] = [];
	for (let n = 1; n <= doc.numPages; n++) {
		const page = await doc.getPage(n);
		const content = await page.getTextContent();
		let text = '';
		for (const item of content.items) {
			if (!('str' in item)) continue;
			text += item.str + (item.hasEOL ? '\n' : '');
		}
		out.push(text.replace(/[ \t]+\n/g, '\n').trim());
		page.cleanup();
	}
	return out;
}
