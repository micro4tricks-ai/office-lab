import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import docx from '../../src/lib/adapters/doc/docx';
import type { FileData } from '../../src/lib/registry/types';

const report = (): FileData => ({
	name: 'report.docx',
	type: '',
	bytes: new Uint8Array(readFileSync(new URL('../fixtures/doc/report.docx', import.meta.url)))
});
const text = (f: FileData) => new TextDecoder().decode(f.bytes);

describe('Word → HTML / Markdown', () => {
	it('HTML: right-to-left page, headings, lists, tables, inline image', async () => {
		const [html] = await docx.convert(report(), { to: 'html' });
		const t = text(html);
		expect(html.name).toBe('report.html');
		expect(t).toContain('dir="rtl"');
		expect(t).toContain('<h1 dir="auto">تقرير الزيارة</h1>');
		expect(t).toContain('<li dir="auto">Filter replaced</li>');
		expect(t).toContain('<td dir="auto"><p dir="auto">الفلتر</p></td>');
		expect(t).toMatch(/<img src="data:image\/png;base64,/);
	});

	it('Markdown: atx headings, list, table kept, image as a separate file', async () => {
		const [md, ...images] = await docx.convert(report(), { to: 'md', images: 'files' });
		const t = text(md);
		expect(md.name).toBe('report.md');
		expect(t).toContain('# تقرير الزيارة');
		expect(t).toContain('**تمت زيارة الموقع وفحص المعدات.**');
		expect(t).toContain('-   Filter replaced');
		expect(t).toContain('<table>');
		expect(t).toContain('![](report-images/image-1.png)');
		expect(images.map((i) => i.name)).toEqual(['report-images/image-1.png']);
		expect([...images[0].bytes.subarray(1, 4)]).toEqual([0x50, 0x4e, 0x47]);
	});

	it('a file that is not a Word document is reported as damaged', async () => {
		const bad: FileData = { name: 'x.docx', type: '', bytes: new TextEncoder().encode('not a zip') };
		await expect(docx.convert(bad, { to: 'html' })).rejects.toHaveProperty('code', 'corrupted');
	});
});
