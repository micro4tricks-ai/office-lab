import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import convert from '../../src/lib/adapters/data/convert';
import format from '../../src/lib/adapters/data/format';
import { decodeText, guessDelimiter } from '../../src/lib/adapters/data/sheet';
import type { FileData } from '../../src/lib/registry/types';

const fx = (name: string): FileData => ({
	name,
	type: '',
	bytes: new Uint8Array(readFileSync(new URL(`../fixtures/data/${name}`, import.meta.url)))
});
const text = (f: FileData) => new TextDecoder().decode(f.bytes);

describe('reading spreadsheets', () => {
	it('decodes Windows-1256 Arabic CSV and finds the semicolon', () => {
		const t = decodeText(fx('arabic-1256.csv').bytes);
		expect(t).toContain('أحمد');
		expect(guessDelimiter(t)).toBe(';');
	});
});

describe('Excel → other formats', () => {
	it('CSV: one file per sheet, UTF-8 BOM for Excel', async () => {
		const out = await convert.convert(fx('sales.xlsx'), { to: 'csv' });
		expect(out.map((f) => f.name)).toEqual(['sales-Sales.csv', 'sales-Stock.csv']);
		expect([...out[0].bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
		expect(text(out[0])).toContain('شركة النور,القاهرة,1500');
	});

	it('CSV from a Windows-1256 file keeps the Arabic', async () => {
		const [csv] = await convert.convert(fx('arabic-1256.csv'), { to: 'csv', bom: false });
		expect(text(csv)).toBe('الاسم,الهاتف\nأحمد,0100\nسارة,0122');
	});

	it('JSON keeps numbers as numbers', async () => {
		const [json] = await convert.convert(fx('sales.xlsx'), { to: 'json', sheets: 'first' });
		expect(json.name).toBe('sales.json');
		expect(JSON.parse(text(json))[1]).toEqual({ العميل: 'مؤسسة الأمل', المدينة: 'الإسكندرية', المبلغ: 2750.5 });
	});

	it('HTML is right-to-left for Arabic; Markdown escapes cells', async () => {
		const [html] = await convert.convert(fx('sales.xlsx'), { to: 'html', sheets: 'first' });
		expect(text(html)).toContain('dir="rtl"');
		expect(text(html)).toContain('<th>العميل</th>');
		const [md] = await convert.convert(fx('sales.xlsx'), { to: 'md', sheets: 'first' });
		expect(text(md).split('\n').slice(0, 2)).toEqual(['| العميل | المدينة | المبلغ |', '| --- | --- | --- |']);
	});

	it('SQL quotes text, leaves numbers bare', async () => {
		const [sql] = await convert.convert(fx('sales.xlsx'), { to: 'sql', sheets: 'first', table: 'sales' });
		expect(text(sql)).toContain('CREATE TABLE "sales"');
		expect(text(sql)).toContain(`VALUES ('شركة النور', 'القاهرة', 1500);`);
	});

	it('CSV → Excel keeps leading zeros (phones, codes) but real numbers stay numbers', async () => {
		const body = 'name,phone,amount,id\nA,01001234567,1500,00123\n';
		const csv: FileData = { name: 'p.csv', type: '', bytes: new TextEncoder().encode(body) };
		const [xlsx] = await convert.convert(csv, { to: 'xlsx' });
		const ws = XLSX.read(xlsx.bytes).Sheets.Sheet1;
		expect([ws.B2.v, ws.C2.v, ws.D2.v]).toEqual(['01001234567', 1500, '00123']);
	});

	it('CSV / JSON → Excel with a right-to-left sheet', async () => {
		const [xlsx] = await convert.convert(fx('arabic-1256.csv'), { to: 'xlsx' });
		const wb = XLSX.read(xlsx.bytes);
		expect(wb.Workbook?.Views?.[0]?.RTL).toBe(true);
		expect(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])).toMatchObject([
			{ الاسم: 'أحمد', الهاتف: '0100' },
			{ الاسم: 'سارة', الهاتف: '0122' }
		]);
		const [fromJson] = await convert.convert(fx('sample.json'), { to: 'xlsx' });
		const row = XLSX.utils.sheet_to_json<Record<string, unknown>>(XLSX.read(fromJson.bytes).Sheets.Sheet1)[0];
		expect(row['owner.city']).toBe('Cairo'); // nested objects become dotted columns
	});
});

describe('JSON ↔ YAML ↔ XML ↔ TOML', () => {
	it('round-trips the same data through every format', async () => {
		const [yaml] = await format.convert(fx('sample.json'), { to: 'yaml' });
		const [json] = await format.convert({ ...yaml, name: 'x.yaml' }, { to: 'json' });
		expect(JSON.parse(text(json))).toEqual(JSON.parse(text(fx('sample.json'))));

		const [toml] = await format.convert(fx('sample.yaml'), { to: 'toml' });
		expect(text(toml)).toContain('company = "المعمل"');

		const [xml] = await format.convert(fx('sample.json'), { to: 'xml' });
		expect(text(xml)).toContain('<company>المعمل</company>');
		const [back] = await format.convert(fx('sample.xml'), { to: 'json' });
		expect(JSON.parse(text(back)).company['@_year']).toBe(2026);
	});

	it('reports broken input as corrupted', async () => {
		const bad: FileData = { name: 'bad.json', type: '', bytes: new TextEncoder().encode('{ nope') };
		await expect(format.convert(bad, { to: 'yaml' })).rejects.toHaveProperty('code', 'corrupted');
	});
});
