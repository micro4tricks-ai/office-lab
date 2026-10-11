import type { Adapter, FileData } from '../../registry/types';
import { hasArabic, pickSheets, readBook, rowsOf, setRtlIfArabic, sheetFileName, sheetjs, textFile } from './sheet';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const cell = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? ''));

function markdown(rows: unknown[][]) {
	if (!rows.length) return '';
	const width = Math.max(...rows.map((r) => r.length));
	const line = (r: unknown[]) =>
		'| ' + Array.from({ length: width }, (_, i) => cell(r[i]).replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')).join(' | ') + ' |';
	return [line(rows[0]), '|' + ' --- |'.repeat(width), ...rows.slice(1).map(line)].join('\n') + '\n';
}

function html(rows: unknown[][], title: string) {
	const rtl = hasArabic(rows.flat().map(cell).join(' '));
	const [head = [], ...body] = rows;
	return `<!doctype html>
<html dir="${rtl ? 'rtl' : 'ltr'}" lang="${rtl ? 'ar' : 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>body{font-family:system-ui,"Segoe UI",Tahoma,sans-serif;margin:2rem}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:.4rem .6rem;text-align:start}th{background:#0f6e66;color:#fff}tr:nth-child(even) td{background:#f6f5f1}</style>
</head><body><table><thead><tr>${head.map((h) => `<th>${esc(cell(h))}</th>`).join('')}</tr></thead><tbody>
${body.map((r) => `<tr>${head.map((_, i) => `<td dir="auto">${esc(cell(r[i]))}</td>`).join('')}</tr>`).join('\n')}
</tbody></table></body></html>
`;
}

/**
 * SQL identifier from free text: letters (Arabic too), digits and "_" only, so a header or
 * table name can never break out of its quotes.
 */
const ident = (s: string, i: number, mysql: boolean) => {
	const id = s.trim().replace(/[^\p{L}\p{N}_]+/gu, '_').replace(/^_+|_+$/g, '');
	const q = mysql ? '`' : '"';
	return `${q}${id || 'column_' + (i + 1)}${q}`;
};
function sql(rows: unknown[][], table: string, create: boolean, mysql: boolean) {
	if (!rows.length) return '';
	const [head, ...body] = rows;
	const cols = head.map((h, i) => ident(cell(h), i, mysql));
	const name = ident(table || 'data', 0, mysql);
	const value = (v: unknown) => {
		const s = cell(v);
		if (s === '') return 'NULL';
		if (/^-?\d+(\.\d+)?$/.test(s) && !/^0\d/.test(s)) return s;
		// Standard SQL escapes only quotes; MySQL also treats backslash as an escape.
		const body = mysql ? s.replace(/\\/g, '\\\\').replace(/'/g, "''") : s.replace(/'/g, "''");
		return `'${body}'`;
	};
	const out = create ? [`CREATE TABLE ${name} (\n  ${cols.map((c) => `${c} TEXT`).join(',\n  ')}\n);`] : [];
	for (const r of body) out.push(`INSERT INTO ${name} (${cols.join(', ')}) VALUES (${cols.map((_, i) => value(r[i])).join(', ')});`);
	return out.join('\n') + '\n';
}

/**
 * CSV injection guard: a text cell starting with = + @ or a non-number "-" would run as a
 * formula when the CSV is opened in Excel. Such cells get a leading apostrophe; real
 * numbers (including negatives) are left alone.
 */
export function defuseFormulas(ws: import('xlsx').WorkSheet) {
	for (const [ref, c] of Object.entries(ws)) {
		if (ref.startsWith('!') || c.t !== 's') continue;
		const v = String(c.v);
		if (/^[=+@\t\r]/.test(v) || (v.startsWith('-') && !/^-\d+(\.\d+)?$/.test(v))) {
			// sheet_to_csv prints the formatted text (w), so change both.
			c.v = c.w = "'" + v;
			delete c.f;
		}
	}
}

/** Spreadsheets (xlsx/xls/ods/csv/JSON) → CSV, JSON, HTML, Markdown, SQL or Excel. */
const adapter: Adapter = {
	async convert(input, options) {
		const X = await sheetjs();
		const wb = await readBook(input);
		const to = String(options.to);
		const sheets = pickSheets(wb, options.sheets);
		const many = sheets.length > 1;
		const out: FileData[] = [];

		if (to === 'xlsx') {
			const book = X.utils.book_new();
			for (const s of sheets) X.utils.book_append_sheet(book, s.ws, s.name.slice(0, 31));
			setRtlIfArabic(book, JSON.stringify((await rowsOf(sheets[0].ws)).slice(0, 20)));
			const bytes = new Uint8Array(X.write(book, { type: 'array', bookType: 'xlsx', compression: true }));
			return [{ name: input.name.replace(/\.[^.]+$/, '.xlsx'), type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', bytes }];
		}

		for (const { name, ws } of sheets) {
			const file = (ext: string) => sheetFileName(input.name, name, many, ext);
			if (to === 'csv') {
				const sep = options.delimiter === 'semicolon' ? ';' : options.delimiter === 'tab' ? '\t' : ',';
				defuseFormulas(ws);
				out.push(textFile(file('csv'), 'text/csv;charset=utf-8', X.utils.sheet_to_csv(ws, { FS: sep, blankrows: false }), options.bom !== false));
			} else if (to === 'json') {
				const rows = X.utils.sheet_to_json(ws, { defval: null, raw: true });
				out.push(textFile(file('json'), 'application/json', JSON.stringify(rows, (_, v) => (v instanceof Date ? v.toISOString() : v), 2) + '\n'));
			} else {
				const rows = await rowsOf(ws);
				if (to === 'html') out.push(textFile(file('html'), 'text/html', html(rows, name)));
				else if (to === 'md') out.push(textFile(file('md'), 'text/markdown', markdown(rows)));
				else if (to === 'sql') out.push(textFile(file('sql'), 'application/sql', sql(rows, String(options.table || name), options.create !== false, options.dialect === 'mysql')));
			}
		}
		return out;
	}
};

export default adapter;
