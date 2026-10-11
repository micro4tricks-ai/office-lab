import { describe, expect, it } from 'vitest';
import { evenLight, prepareForOcr, rotateGray, skewAngle, toOriginal } from '../../src/lib/adapters/ocr/prepare';

/** A page of dark "text lines" on paper, optionally with a shadow over one side. */
function page(w: number, h: number, shadow: boolean) {
	const g = new Uint8Array(w * h);
	for (let y = 0; y < h; y++)
		for (let x = 0; x < w; x++) {
			const paper = shadow ? 235 - Math.round((x / w) * 140) : 235; // 235 → 95 across the page
			const ink = y % 40 >= 30 && y % 40 < 36 && x > 40 && x < w - 40 && x % 9 < 6;
			g[y * w + x] = ink ? Math.round(paper * 0.25) : paper;
		}
	return g;
}

describe('OCR clean-up', () => {
	it('evens out a shadow: paper becomes white everywhere, text stays dark', () => {
		const w = 600;
		const h = 400;
		const out = evenLight(page(w, h, true), w, h);
		const paperLeft = out[5 * w + 20];
		const paperRight = out[5 * w + w - 20];
		expect(paperLeft).toBeGreaterThan(240);
		expect(paperRight).toBeGreaterThan(240);
		// Ink in the shadowed half is as dark as ink in the bright half.
		const inkLeft = out[32 * w + 45];
		const inkRight = out[32 * w + w - 50];
		expect(Math.abs(inkLeft - inkRight)).toBeLessThan(40);
		expect(inkRight).toBeLessThan(110);
	});

	it('finds the tilt of the text lines', () => {
		const w = 700;
		const h = 500;
		const tilted = rotateGray(page(w, h, false), w, h, 3);
		expect(skewAngle(tilted.gray, tilted.width, tilted.height)).toBeCloseTo(-3, 0);
		expect(skewAngle(page(w, h, false), w, h)).toBe(0);
	});

	it('maps word boxes back to the original image', () => {
		const w = 800;
		const h = 600;
		const rgba = new Uint8Array(w * h * 4);
		const tilted = rotateGray(page(w, h, false), w, h, 2.5);
		const src = tilted.gray;
		for (let i = 0; i < src.length && i < w * h; i++) rgba.set([src[i], src[i], src[i], 255], i * 4);
		const p = prepareForOcr(rgba, w, h);
		expect(Math.abs(p.angle)).toBeGreaterThan(1);
		// The centre stays the centre; a box keeps roughly its size.
		const c = toOriginal(p, { x0: p.width / 2 - 10, y0: p.height / 2 - 5, x1: p.width / 2 + 10, y1: p.height / 2 + 5 });
		expect((c.x0 + c.x1) / 2).toBeCloseTo(w / 2, 0);
		expect((c.y0 + c.y1) / 2).toBeCloseTo(h / 2, 0);
		expect(c.x1 - c.x0).toBeLessThan(30);
	});

	it('doubles small images and maps back through the scale', () => {
		const rgba = new Uint8Array(400 * 300 * 4).fill(255);
		const p = prepareForOcr(rgba, 400, 300);
		expect([p.width, p.height, p.scale]).toEqual([800, 600, 2]);
		expect(toOriginal(p, { x0: 100, y0: 100, x1: 200, y1: 150 })).toEqual({ x0: 50, y0: 50, x1: 100, y1: 75 });
	});
});
