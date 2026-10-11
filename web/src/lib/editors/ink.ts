import type { FileData } from '../registry/types';

/** Fonts offered for typed signatures and text (all self-hosted). */
export const FONTS = {
	cairo: '"Cairo Variable", sans-serif',
	ruqaa: '"Aref Ruqaa", serif',
	script: '"Dancing Script", cursive'
} as const;
export type FontKey = keyof typeof FONTS;

let loaded: Promise<unknown> | null = null;

/** The signature fonts are only fetched when an editor opens. */
export function loadSignatureFonts() {
	loaded ??= Promise.all([
		import('@fontsource/aref-ruqaa/700.css'),
		import('@fontsource/dancing-script/700.css')
	]).then(() =>
		Promise.all([document.fonts.load('700 48px "Aref Ruqaa"', 'توقيع'), document.fonts.load('700 48px "Dancing Script"', 'Sign')])
	);
	return loaded;
}

async function canvasToPng(canvas: HTMLCanvasElement, name: string): Promise<FileData> {
	const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
	if (!blob) throw new Error('canvas export failed');
	return { name, type: 'image/png', bytes: new Uint8Array(await blob.arrayBuffer()) };
}

/** One line of text → transparent PNG (shaped by the browser, so Arabic is correct). */
export async function textPng(text: string, { font = 'cairo' as FontKey, color = '#111111', px = 96, weight = 700 } = {}) {
	await document.fonts.ready;
	const css = `${weight} ${px}px ${FONTS[font]}`;
	const probe = document.createElement('canvas').getContext('2d')!;
	probe.font = css;
	const m = probe.measureText(text);
	const pad = Math.ceil(px * 0.25);
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, Math.ceil(m.width) + pad * 2);
	canvas.height = Math.ceil(px * 1.6) + pad;
	const ctx = canvas.getContext('2d')!;
	ctx.font = css;
	ctx.fillStyle = color;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.direction = /[؀-ۿ]/.test(text) ? 'rtl' : 'ltr';
	ctx.fillText(text, canvas.width / 2, canvas.height / 2);
	return canvasToPng(trim(canvas, pad / 2), 'text.png');
}

/** Crops transparent margins (keeps `pad` px), so a drawn signature is only its ink. */
export function trim(src: HTMLCanvasElement, pad = 4): HTMLCanvasElement {
	const ctx = src.getContext('2d')!;
	const { width: w, height: h } = src;
	const data = ctx.getImageData(0, 0, w, h).data;
	let [x0, y0, x1, y1] = [w, h, -1, -1];
	for (let y = 0; y < h; y++)
		for (let x = 0; x < w; x++)
			if (data[(y * w + x) * 4 + 3] > 8) {
				if (x < x0) x0 = x;
				if (x > x1) x1 = x;
				if (y < y0) y0 = y;
				if (y > y1) y1 = y;
			}
	if (x1 < 0) return src;
	x0 = Math.max(0, x0 - pad);
	y0 = Math.max(0, y0 - pad);
	x1 = Math.min(w - 1, x1 + pad);
	y1 = Math.min(h - 1, y1 + pad);
	const out = document.createElement('canvas');
	out.width = x1 - x0 + 1;
	out.height = y1 - y0 + 1;
	out.getContext('2d')!.drawImage(src, -x0, -y0);
	return out;
}

export const exportInk = (canvas: HTMLCanvasElement) => canvasToPng(trim(canvas), 'signature.png');

/** Any picked image → PNG at most `max` px on its longest side (SVG drawn by the browser). */
export async function imageToPng(file: File, max = 1600): Promise<FileData> {
	const url = URL.createObjectURL(file);
	try {
		const img = new Image();
		img.src = url;
		await img.decode();
		const s = Math.min(1, max / Math.max(img.naturalWidth || max, img.naturalHeight || max));
		const canvas = document.createElement('canvas');
		canvas.width = Math.max(1, Math.round((img.naturalWidth || max) * s));
		canvas.height = Math.max(1, Math.round((img.naturalHeight || max) * s));
		canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
		return canvasToPng(canvas, 'image.png');
	} finally {
		URL.revokeObjectURL(url);
	}
}

/** Size of a PNG from its header (no decoding). */
export function pngSize(png: Uint8Array): { w: number; h: number } {
	const v = new DataView(png.buffer, png.byteOffset, png.byteLength);
	return { w: v.getUint32(16), h: v.getUint32(20) };
}
