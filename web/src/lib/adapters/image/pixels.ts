/** Pixel operations on ImageData, done with OffscreenCanvas (works in workers). */

const ctx2d = (w: number, h: number) => new OffscreenCanvas(w, h).getContext('2d')!;

export const hasAlpha = (img: ImageData) => {
	const d = img.data;
	for (let i = 3; i < d.length; i += 4) if (d[i] < 255) return true;
	return false;
};

/** Paints transparent pixels onto a solid colour (JPEG and PDF-as-JPEG have no alpha). */
export function flatten(img: ImageData, bg = '#ffffff'): ImageData {
	if (!hasAlpha(img)) return img;
	const c = ctx2d(img.width, img.height);
	c.fillStyle = bg;
	c.fillRect(0, 0, img.width, img.height);
	c.drawImage(toCanvas(img), 0, 0);
	return c.getImageData(0, 0, img.width, img.height);
}

export function toCanvas(img: ImageData): OffscreenCanvas {
	const c = ctx2d(img.width, img.height);
	c.putImageData(img, 0, 0);
	return c.canvas;
}

/** High-quality resize (the browser's own resampler). */
export async function resize(img: ImageData, w: number, h: number): Promise<ImageData> {
	w = Math.max(1, Math.round(w));
	h = Math.max(1, Math.round(h));
	if (w === img.width && h === img.height) return img;
	const bmp = await createImageBitmap(img, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' });
	const c = ctx2d(w, h);
	c.drawImage(bmp, 0, 0);
	bmp.close();
	return c.getImageData(0, 0, w, h);
}

/** Rotate by a multiple of 90° and/or flip. */
export function rotateFlip(img: ImageData, deg: number, flipH: boolean, flipV: boolean): ImageData {
	const r = ((deg % 360) + 360) % 360;
	const swap = r === 90 || r === 270;
	const w = swap ? img.height : img.width;
	const h = swap ? img.width : img.height;
	const c = ctx2d(w, h);
	c.translate(w / 2, h / 2);
	c.rotate((r * Math.PI) / 180);
	c.scale(flipH ? -1 : 1, flipV ? -1 : 1);
	c.drawImage(toCanvas(img), -img.width / 2, -img.height / 2);
	return c.getImageData(0, 0, w, h);
}

export function crop(img: ImageData, x: number, y: number, w: number, h: number): ImageData {
	x = Math.max(0, Math.min(img.width - 1, Math.round(x)));
	y = Math.max(0, Math.min(img.height - 1, Math.round(y)));
	w = Math.max(1, Math.min(img.width - x, Math.round(w)));
	h = Math.max(1, Math.min(img.height - y, Math.round(h)));
	const c = ctx2d(w, h);
	c.drawImage(toCanvas(img), -x, -y);
	return c.getImageData(0, 0, w, h);
}

/** Largest centred box with the ratio `rw:rh`. */
export function centreBox(w: number, h: number, rw: number, rh: number) {
	const target = rw / rh;
	const cw = w / h > target ? h * target : w;
	const ch = w / h > target ? h : w / target;
	return { x: (w - cw) / 2, y: (h - ch) / 2, w: cw, h: ch };
}

/** Fits the image in a transparent square (for icons), centred. */
export async function square(img: ImageData, size: number, mode: 'pad' | 'crop'): Promise<ImageData> {
	let src = img;
	if (mode === 'crop') {
		const b = centreBox(img.width, img.height, 1, 1);
		src = crop(img, b.x, b.y, b.w, b.h);
	}
	const s = size / Math.max(src.width, src.height);
	const scaled = await resize(src, src.width * s, src.height * s);
	const c = ctx2d(size, size);
	c.drawImage(toCanvas(scaled), Math.round((size - scaled.width) / 2), Math.round((size - scaled.height) / 2));
	return c.getImageData(0, 0, size, size);
}
