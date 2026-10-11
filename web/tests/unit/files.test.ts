import { unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import zip from '../../src/lib/adapters/files/zip';
import { newNames } from '../../src/lib/adapters/files/rename';
import type { FileData } from '../../src/lib/registry/types';

const file = (name: string, text = name): FileData => ({ name, type: '', bytes: new TextEncoder().encode(text) });

describe('batch rename', () => {
	it('pattern, numbering, padding, replacing, keeping extensions', () => {
		expect(newNames(['a.pdf', 'b.pdf', 'c.jpg'], { pattern: 'فاتورة-{n}', start: 1, digits: 3 })).toEqual(['فاتورة-001.pdf', 'فاتورة-002.pdf', 'فاتورة-003.jpg']);
		expect(newNames(['scan 01.png'], { pattern: '{date}_{name}', start: 1, digits: 1, find: ' ', replace: '_', date: '2026-10-11' })).toEqual(['2026-10-11_scan_01.png']);
	});

	it('never produces duplicate names or path characters', () => {
		expect(newNames(['a.txt', 'b.txt'], { pattern: 'same', start: 1, digits: 1 })).toEqual(['same.txt', 'same (2).txt']);
		expect(newNames(['x.txt'], { pattern: '../{name}/evil', start: 1, digits: 1 })).toEqual(['.._x_evil.txt']);
	});
});

describe('ZIP', () => {
	it('creates an archive and unpacks it again', async () => {
		const [archive] = await zip.combine!([file('a.txt'), file('a.txt', 'second'), file('تقرير.txt')], { level: 'normal' });
		expect(archive.name).toBe('archive.zip');
		expect(Object.keys(unzipSync(archive.bytes)).sort()).toEqual(['a (2).txt', 'a.txt', 'تقرير.txt'].sort());
		const out = await zip.convert(archive, { action: 'extract' });
		expect(out.find((f) => f.name === 'a (2).txt')?.bytes).toEqual(new TextEncoder().encode('second'));
	});

	it('extracting keeps every file inside its folder (zip-slip)', async () => {
		const evil: FileData = { name: 'evil.zip', type: '', bytes: zipSync({ '../../outside.txt': new Uint8Array([1]), 'ok/inner.txt': new Uint8Array([2]) }) };
		const names = (await zip.convert(evil, { action: 'extract' })).map((f) => f.name).sort();
		expect(names).toEqual(['ok/inner.txt', 'outside.txt']);
	});

	it('a damaged archive is reported as such', async () => {
		await expect(zip.convert(file('bad.zip', 'not a zip'), { action: 'extract' })).rejects.toHaveProperty('code', 'corrupted');
	});
});
