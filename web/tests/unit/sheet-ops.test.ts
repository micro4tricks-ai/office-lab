import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import ops, { parseVcards } from '../../src/lib/adapters/data/sheet-ops';
import type { FileData } from '../../src/lib/registry/types';

const csv = (name: string, text: string): FileData => ({ name, type: 'text/csv', bytes: new TextEncoder().encode(text) });
const rows = (f: FileData) => {
	const wb = XLSX.read(f.bytes);
	return XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
};

describe('spreadsheet chores', () => {
	it('merge stacks files and matches columns by name', async () => {
		const [out] = await ops.combine!(
			[csv('jan.csv', 'الاسم,المبلغ\nأحمد,100\n'), csv('feb.csv', 'المبلغ,الاسم\n200,سارة\n')],
			{ mode: 'stack', source: true }
		);
		expect(rows(out)).toEqual([
			['الاسم', 'المبلغ', 'المصدر / Source'],
			['أحمد', 100, 'jan'],
			['سارة', 200, 'feb']
		]);
	});

	it('merge as separate sheets keeps file names', async () => {
		const [out] = await ops.combine!([csv('a.csv', 'x\n1\n'), csv('b.csv', 'y\n2\n')], { mode: 'sheets' });
		expect(XLSX.read(out.bytes).SheetNames).toEqual(['a', 'b']);
	});

	it('split by a column value, header in every file', async () => {
		const out = await ops.convert(csv('s.csv', 'المدينة,المبلغ\nالقاهرة,1\nالجيزة,2\nالقاهرة,3\n'), { action: 'split', by: 'column', column: 'المدينة' });
		expect(out.map((f) => f.name)).toEqual(['s-القاهرة.xlsx', 's-الجيزة.xlsx']);
		expect(rows(out[0])).toEqual([['المدينة', 'المبلغ'], ['القاهرة', 1], ['القاهرة', 3]]);
	});

	it('removes duplicates by chosen columns, ignoring case and spaces', async () => {
		const [out] = await ops.convert(csv('d.csv', 'Name,Phone\nA,0100\nB, 0100\nC,0122\n'), { action: 'dedupe', columns: 'Phone' });
		expect(rows(out)).toEqual([['Name', 'Phone'], ['A', '0100'], ['C', '0122']]);
	});

	it('cleans spaces, empty rows/columns and digits', async () => {
		const [out] = await ops.convert(csv('c.csv', 'الاسم,,الرقم\n  أحمد   علي ,,١٢٣\n,,\n'), { action: 'clean', digits: 'western' });
		expect(rows(out)).toEqual([['الاسم', 'الرقم'], ['أحمد علي', '123']]);
	});

	it('contacts: Excel → vCard → Excel', async () => {
		const [vcf] = await ops.convert(csv('c.csv', 'الاسم,الموبايل,البريد\nأحمد علي,0100 123 4567,a@x.com\n'), { action: 'to-vcard' });
		const text = new TextDecoder().decode(vcf.bytes);
		expect(text).toContain('FN:أحمد علي');
		expect(text).toContain('TEL;TYPE=CELL:01001234567');
		expect(parseVcards(text)[1]).toEqual(['أحمد علي', '01001234567', 'a@x.com', '']);
		const [xlsx] = await ops.convert({ ...vcf, name: 'c.vcf' }, { action: 'from-vcard' });
		expect(rows(xlsx)[1]).toEqual(['أحمد علي', '01001234567', 'a@x.com', '']);
	});
});
