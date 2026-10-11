/**
 * Clean-up before OCR. Phone photos and scans have uneven light (shadows, a darker corner), which
 * Tesseract's single global threshold handles badly: on a test photo of an Arabic letter this step
 * took the character error rate from ~64% to ~4%.
 *
 * 1. grayscale; 2. estimate the paper's brightness everywhere (max over blocks — removes the dark
 * text — then smoothed and interpolated); 3. divide by it, so the page becomes evenly white;
 * 4. stretch the contrast, ignoring the 1% extremes.
 */
export function toGray(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number): Uint8Array {
	const g = new Uint8Array(w * h);
	for (let i = 0, j = 0; i < g.length; i++, j += 4) {
		// Transparent pixels count as white paper.
		const a = rgba[j + 3] / 255;
		const y = 0.299 * rgba[j] + 0.587 * rgba[j + 1] + 0.114 * rgba[j + 2];
		g[i] = Math.round(y * a + 255 * (1 - a));
	}
	return g;
}

function blur3(src: Float32Array, cw: number, ch: number): Float32Array<ArrayBuffer> {
	const out = new Float32Array(src.length);
	for (let y = 0; y < ch; y++)
		for (let x = 0; x < cw; x++) {
			let s = 0;
			let n = 0;
			for (let dy = -1; dy <= 1; dy++)
				for (let dx = -1; dx <= 1; dx++) {
					const xx = x + dx;
					const yy = y + dy;
					if (xx >= 0 && yy >= 0 && xx < cw && yy < ch) {
						s += src[yy * cw + xx];
						n++;
					}
				}
			out[y * cw + x] = s / n;
		}
	return out;
}

export function evenLight(gray: Uint8Array, w: number, h: number): Uint8Array {
	// Blocks a bit taller than a text line, so each holds some paper.
	const b = Math.max(8, Math.round(Math.max(w, h) / 60));
	const cw = Math.ceil(w / b);
	const ch = Math.ceil(h / b);
	let grid = new Float32Array(cw * ch);
	for (let y = 0; y < h; y++) {
		const row = Math.floor(y / b) * cw;
		for (let x = 0; x < w; x++) {
			const k = row + Math.floor(x / b);
			const v = gray[y * w + x];
			if (v > grid[k]) grid[k] = v;
		}
	}
	grid = blur3(blur3(grid, cw, ch), cw, ch);

	const out = new Uint8Array(w * h);
	const hist = new Uint32Array(256);
	for (let y = 0; y < h; y++) {
		// Bilinear: block centres sit at (i + 0.5) * b.
		const gy = Math.min(Math.max(y / b - 0.5, 0), ch - 1);
		const y0 = Math.floor(gy);
		const y1 = Math.min(y0 + 1, ch - 1);
		const fy = gy - y0;
		for (let x = 0; x < w; x++) {
			const gx = Math.min(Math.max(x / b - 0.5, 0), cw - 1);
			const x0 = Math.floor(gx);
			const x1 = Math.min(x0 + 1, cw - 1);
			const fx = gx - x0;
			const top = grid[y0 * cw + x0] * (1 - fx) + grid[y0 * cw + x1] * fx;
			const bottom = grid[y1 * cw + x0] * (1 - fx) + grid[y1 * cw + x1] * fx;
			const bg = Math.max(top * (1 - fy) + bottom * fy, 1);
			const v = Math.min(255, Math.round((gray[y * w + x] * 255) / bg));
			out[y * w + x] = v;
			hist[v]++;
		}
	}

	// Contrast stretch between the 1st and 99th percentiles.
	const cut = Math.floor(out.length * 0.01);
	let lo = 0;
	for (let s = 0; lo < 255 && s + hist[lo] <= cut; lo++) s += hist[lo];
	let hi = 255;
	for (let s = 0; hi > 0 && s + hist[hi] <= cut; hi--) s += hist[hi];
	if (hi - lo < 16) return out; // nearly blank page: leave it
	const scale = 255 / (hi - lo);
	for (let i = 0; i < out.length; i++) out[i] = Math.max(0, Math.min(255, Math.round((out[i] - lo) * scale)));
	return out;
}

/** Gray bytes → RGBA (what the PNG encoder takes). */
export function grayToRgba(g: Uint8Array): Uint8ClampedArray<ArrayBuffer> {
	const out = new Uint8ClampedArray(g.length * 4);
	for (let i = 0, j = 0; i < g.length; i++, j += 4) {
		out[j] = out[j + 1] = out[j + 2] = g[i];
		out[j + 3] = 255;
	}
	return out;
}

/**
 * Tilt of the text lines in degrees (photos are rarely straight). Tries -6°…6° and keeps the angle
 * whose horizontal projection of dark pixels is the most "peaky" (lines line up with rows).
 */
export function skewAngle(gray: Uint8Array, w: number, h: number): number {
	const step = Math.max(1, Math.ceil(Math.max(w, h) / 800));
	const xs: number[] = [];
	const ys: number[] = [];
	for (let y = 0; y < h; y += step)
		for (let x = 0; x < w; x += step)
			if (gray[y * w + x] < 128) {
				xs.push(x / step);
				ys.push(y / step);
			}
	if (xs.length < 50) return 0;
	const sw = Math.ceil(w / step);
	const sh = Math.ceil(h / step);
	const bins = new Float64Array(sw + 2 * sh + 2);
	let best = -1;
	let angle = 0;
	for (let a10 = -60; a10 <= 60; a10 += 2) {
		const r = (a10 / 10) * (Math.PI / 180);
		const s = Math.sin(r);
		const c = Math.cos(r);
		bins.fill(0);
		for (let i = 0; i < xs.length; i++) bins[Math.floor(-xs[i] * s + ys[i] * c) + sw]++;
		let score = 0;
		for (const v of bins) score += v * v;
		if (score > best) {
			best = score;
			angle = a10 / 10;
		}
	}
	return angle;
}

/** Rotates a gray image counter-clockwise by `deg` (canvas grows; new corners are white). */
export function rotateGray(gray: Uint8Array, w: number, h: number, deg: number) {
	const r = (deg * Math.PI) / 180;
	const c = Math.cos(r);
	const s = Math.sin(r);
	const W = Math.ceil(Math.abs(w * c) + Math.abs(h * s));
	const H = Math.ceil(Math.abs(w * s) + Math.abs(h * c));
	const out = new Uint8Array(W * H).fill(255);
	const cx = w / 2;
	const cy = h / 2;
	const CX = W / 2;
	const CY = H / 2;
	for (let Y = 0; Y < H; Y++)
		for (let X = 0; X < W; X++) {
			// Inverse mapping (image y points down, so counter-clockwise on screen is this sign).
			const dx = X - CX;
			const dy = Y - CY;
			const x = c * dx - s * dy + cx;
			const y = s * dx + c * dy + cy;
			const x0 = Math.floor(x);
			const y0 = Math.floor(y);
			if (x0 < 0 || y0 < 0 || x0 >= w - 1 || y0 >= h - 1) continue;
			const fx = x - x0;
			const fy = y - y0;
			const i = y0 * w + x0;
			const top = gray[i] * (1 - fx) + gray[i + 1] * fx;
			const bottom = gray[i + w] * (1 - fx) + gray[i + w + 1] * fx;
			out[Y * W + X] = Math.round(top * (1 - fy) + bottom * fy);
		}
	return { gray: out, width: W, height: H };
}

/** The whole clean-up: even light, then straighten. Small images are doubled first (tiny text OCRs badly). */
export function prepareForOcr(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number) {
	let gray = toGray(rgba, w, h);
	let scale = 1;
	if (Math.max(w, h) < 1000) {
		({ gray, width: w, height: h } = doubleSize(gray, w, h));
		scale = 2;
	}
	gray = evenLight(gray, w, h);
	const angle = skewAngle(gray, w, h);
	if (Math.abs(angle) >= 0.3) return { ...rotateGray(gray, w, h, angle), angle, scale, srcW: w / scale, srcH: h / scale };
	return { gray, width: w, height: h, angle: 0, scale, srcW: w / scale, srcH: h / scale };
}

export type Prepared = ReturnType<typeof prepareForOcr>;

/** A box found on the prepared image → the same box on the original (undo rotation and scaling). */
export function toOriginal(p: Prepared, b: { x0: number; y0: number; x1: number; y1: number }) {
	const r = (p.angle * Math.PI) / 180;
	const c = Math.cos(r);
	const s = Math.sin(r);
	const w = p.srcW * p.scale;
	const h = p.srcH * p.scale;
	const xs: number[] = [];
	const ys: number[] = [];
	for (const [X, Y] of [[b.x0, b.y0], [b.x1, b.y0], [b.x0, b.y1], [b.x1, b.y1]]) {
		const dx = X - p.width / 2;
		const dy = Y - p.height / 2;
		xs.push((c * dx - s * dy + w / 2) / p.scale);
		ys.push((s * dx + c * dy + h / 2) / p.scale);
	}
	return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

function doubleSize(gray: Uint8Array, w: number, h: number) {
	const W = w * 2;
	const H = h * 2;
	const out = new Uint8Array(W * H);
	for (let Y = 0; Y < H; Y++) {
		const y = Math.min((Y - 0.5) / 2, h - 1);
		const y0 = Math.max(0, Math.floor(y));
		const y1 = Math.min(h - 1, y0 + 1);
		const fy = Math.max(0, y - y0);
		for (let X = 0; X < W; X++) {
			const x = Math.min((X - 0.5) / 2, w - 1);
			const x0 = Math.max(0, Math.floor(x));
			const x1 = Math.min(w - 1, x0 + 1);
			const fx = Math.max(0, x - x0);
			const top = gray[y0 * w + x0] * (1 - fx) + gray[y0 * w + x1] * fx;
			const bottom = gray[y1 * w + x0] * (1 - fx) + gray[y1 * w + x1] * fx;
			out[Y * W + X] = Math.round(top * (1 - fy) + bottom * fy);
		}
	}
	return { gray: out, width: W, height: H };
}

/** "Scanned document" look for phone photos of paper: white page, dark text, straightened, gray. */
export function scanLook(image: ImageData): ImageData {
	let gray = evenLight(toGray(image.data, image.width, image.height), image.width, image.height);
	let { width, height } = image;
	const angle = skewAngle(gray, width, height);
	if (Math.abs(angle) >= 0.3) ({ gray, width, height } = rotateGray(gray, width, height, angle));
	return new ImageData(grayToRgba(gray), width, height);
}
