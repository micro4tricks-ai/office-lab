import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sniff, sameFormat } from '../../src/lib/adapters/image/formats';
import { readIcoDirectory, writeIco } from '../../src/lib/adapters/image/ico';
import { stripJpeg, stripPng, stripWebp } from '../../src/lib/adapters/image/metadata';
import { fitToSize } from '../../src/lib/adapters/image/target-size';
import { formatList } from '../../src/lib/registry/tools';

const fx = (name: string) => new Uint8Array(readFileSync(new URL(`../fixtures/images/${name}`, import.meta.url)));
const has = (b: Uint8Array, s: string) => Buffer.from(b).includes(Buffer.from(s, 'latin1'));

describe('sniff', () => {
	it.each([
		['photo.jpg', 'jpg'],
		['alpha.png', 'png'],
		['photo.webp', 'webp'],
		['photo.avif', 'avif'],
		['anim.gif', 'gif'],
		['photo.bmp', 'bmp'],
		['photo.tiff', 'tiff'],
		['icon.ico', 'ico'],
		['photo.heic', 'heic'],
		['photo.jxl', 'jxl'],
		['logo.svg', 'svg']
	])('%s → %s', (file, kind) => {
		expect(sniff(fx(file))).toBe(kind);
	});

	it('rejects non-images and keeps same-format rules', () => {
		expect(sniff(new TextEncoder().encode('just some text, not an image'))).toBeNull();
		expect(sameFormat('heic')).toBe('jpg');
		expect(sameFormat('gif')).toBe('png');
		expect(sameFormat('webp')).toBe('webp');
	});
});

describe('ico', () => {
	it('writes a directory that points at each PNG', () => {
		const png = (n: number) => new Uint8Array(n).fill(n);
		const ico = writeIco([
			{ size: 16, png: png(10) },
			{ size: 256, png: png(20) }
		]);
		expect([...ico.subarray(0, 6)]).toEqual([0, 0, 1, 0, 2, 0]);
		const dir = readIcoDirectory(ico);
		expect(dir.map((d) => d.size)).toEqual([16, 256]);
		expect(dir.map((d) => d.bytes)).toEqual([10, 20]);
		expect(ico[dir[1].offset]).toBe(20);
		expect(ico.length).toBe(6 + 32 + 30);
	});
});

describe('metadata removal', () => {
	it('JPEG: drops EXIF/GPS, reports the orientation, keeps the image data', () => {
		const src = fx('photo.jpg');
		expect(has(src, 'Exif')).toBe(true);
		const r = stripJpeg(src);
		expect(r.removed).toBe(true);
		expect(r.orientation).toBe(6);
		expect(has(r.bytes, 'Exif')).toBe(false);
		expect(has(r.bytes, 'FixtureCam')).toBe(false);
		expect(sniff(r.bytes)).toBe('jpg');
		// everything from the start of scan on is untouched
		const sos = (b: Uint8Array) => Buffer.from(b).indexOf(Buffer.from([0xff, 0xda]));
		expect(Buffer.from(r.bytes.subarray(sos(r.bytes))).equals(Buffer.from(src.subarray(sos(src))))).toBe(true);
	});

	it('PNG: drops text and eXIf chunks', () => {
		const r = stripPng(fx('meta.png'));
		expect(r.removed).toBe(true);
		expect(has(r.bytes, 'tEXt')).toBe(false);
		expect(has(r.bytes, 'eXIf')).toBe(false);
		expect(has(r.bytes, 'IDAT')).toBe(true);
		expect(has(r.bytes, 'IEND')).toBe(true);
	});

	it('WebP: drops the EXIF chunk and fixes the RIFF size', () => {
		const r = stripWebp(fx('meta.webp'));
		expect(r.removed).toBe(true);
		expect(has(r.bytes, 'EXIF')).toBe(false);
		const riff = new DataView(r.bytes.buffer, r.bytes.byteOffset).getUint32(4, true);
		expect(riff).toBe(r.bytes.length - 8);
	});

	it('reports when there was nothing to remove', () => {
		expect(stripPng(fx('alpha.png')).removed).toBe(false);
	});
});

describe('fitToSize', () => {
	// Fake encoder: size ∝ quality × pixels.
	const fake = (base: number) => async (q: number, s: number) => new Uint8Array(Math.round(base * q * s * s));

	it('finds the highest quality that fits', async () => {
		const r = await fitToSize(fake(100_000), 60_000);
		expect(r.fits).toBe(true);
		expect(r.scale).toBe(1);
		expect(r.bytes.length).toBeLessThanOrEqual(60_000);
		expect(r.quality).toBeGreaterThan(0.55);
	});

	it('shrinks the image when quality alone is not enough', async () => {
		const r = await fitToSize(fake(1_000_000), 50_000);
		expect(r.fits).toBe(true);
		expect(r.scale).toBeLessThan(1);
		expect(r.bytes.length).toBeLessThanOrEqual(50_000);
	});

	it('returns the smallest attempt when the target is impossible', async () => {
		const r = await fitToSize(async () => new Uint8Array(5000), 10);
		expect(r.fits).toBe(false);
		expect(r.bytes.length).toBe(5000);
	});
});

describe('formatList', () => {
	it('merges aliases, hides MIME types, trims', () => {
		expect(formatList(['jpg', 'jpeg', 'image/jpeg', 'tif', 'tiff', 'png'])).toEqual(['JPG', 'TIFF', 'PNG']);
		expect(formatList(['a', 'b', 'c', 'd', 'e', 'f'], 4)).toEqual(['A', 'B', 'C', 'D', '+2']);
	});
});
