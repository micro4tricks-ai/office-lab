import arabicFont from '@fontsource-variable/cairo/files/cairo-arabic-wght-normal.woff2?url';
import latinFont from '@fontsource-variable/cairo/files/cairo-latin-wght-normal.woff2?url';

/** Font family name used for everything drawn inside workers. */
export const FAMILY = 'Office Lab Cairo';
let fonts: Promise<void> | null = null;

/** Loads self-hosted Cairo into the worker so canvas text (Arabic included) is shaped properly. */
export function loadFonts() {
	fonts ??= (async () => {
		const set = (self as unknown as { fonts: FontFaceSet }).fonts;
		const faces = [
			new FontFace(FAMILY, `url(${arabicFont})`, {
				weight: '200 1000',
				unicodeRange: 'U+0600-06FF,U+0750-077F,U+0870-08FF,U+200C-200E,U+FB50-FDFF,U+FE70-FEFC'
			}),
			new FontFace(FAMILY, `url(${latinFont})`, {
				weight: '200 1000',
				unicodeRange: 'U+0000-00FF,U+0131,U+0152-0153,U+2000-206F,U+20AC,U+2122'
			})
		];
		for (const f of faces) set.add(await f.load());
	})();
	return fonts;
}

export const isArabic = (s: string) => /[؀-ۿݐ-ݿ]/.test(s);

/**
 * Draws a line of text to a transparent PNG. `px` is the font size in image pixels;
 * the result keeps a little padding so strokes are not clipped.
 */
export async function textToPng(text: string, { px = 64, color = '#000000', weight = 700, outline = false } = {}) {
	await loadFonts();
	const font = `${weight} ${px}px "${FAMILY}"`;
	const probe = new OffscreenCanvas(1, 1).getContext('2d')!;
	probe.font = font;
	const pad = Math.ceil(px * 0.2);
	const w = Math.ceil(probe.measureText(text).width) + pad * 2;
	const h = Math.ceil(px * 1.5) + pad;
	const c = new OffscreenCanvas(w, h);
	const ctx = c.getContext('2d')!;
	ctx.font = font;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.direction = isArabic(text) ? 'rtl' : 'ltr';
	if (outline) {
		ctx.strokeStyle = 'rgba(0,0,0,0.35)';
		ctx.lineWidth = Math.max(1, px / 24);
		ctx.strokeText(text, w / 2, h / 2);
	}
	ctx.fillStyle = color;
	ctx.fillText(text, w / 2, h / 2);
	const blob = await c.convertToBlob({ type: 'image/png' });
	return { png: new Uint8Array(await blob.arrayBuffer()), width: w, height: h };
}
