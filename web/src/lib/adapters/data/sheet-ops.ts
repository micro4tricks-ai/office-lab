import { ConvertError, type Adapter, type FileData } from '../../registry/types';
import { removeTashkeel, toArabicDigits, toWesternDigits } from '../../office/arabic-text';
import { vcardPayload } from '../../office/qr';
import { decodeText, rawRowsOf, readBook, setRtlIfArabic, sheetjs } from './sheet';

type Row = unknown[];
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const base = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]+/g, '_') || 'data';
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));

/** Workbook from sheets of rows (first row = header), right-to-left when Arabic. */
async function book(sheets: { name: string; rows: Row[] }[], fileName: string): Promise<FileData> {
	const X = await sheetjs();
	const wb = X.utils.book_new();
	const used = new Set<string>();
	for (const s of sheets) {
		let n = s.name.replace(/[\\/?*[\]:]/g, '_').slice(0, 31) || 'Sheet';
		for (let i = 2; used.has(n.toLowerCase()); i++) n = `${n.slice(0, 27)} (${i})`;
		used.add(n.toLowerCase());
		X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(s.rows), n);
	}
	setRtlIfArabic(wb, JSON.stringify(sheets[0]?.rows.slice(0, 20) ?? []));
	return { name: fileName, type: XLSX_TYPE, bytes: new Uint8Array(X.write(wb, { type: 'array', bookType: 'xlsx', compression: true })) };
}

async function firstSheetRows(file: FileData): Promise<Row[]> {
	const wb = await readBook(file);
	return rawRowsOf(wb.Sheets[wb.SheetNames[0]]);
}

/** Column index by header name (case- and space-insensitive); -1 if missing. */
const columnOf = (header: Row, name: string) => header.findIndex((h) => str(h).trim().toLowerCase() === name.trim().toLowerCase());

/** Finds a column whose header matches any of the patterns (Arabic or English). */
const findColumn = (header: Row, patterns: RegExp) => header.findIndex((h) => patterns.test(str(h).trim()));

const NAME = /^(الاسم|اسم|الإسم|name|full ?name|contact)$/i;
const PHONE = /(هاتف|موبايل|جوال|تليفون|محمول|رقم|phone|mobile|tel|cell)/i;
const EMAIL = /(بريد|ايميل|إيميل|e-?mail)/i;
const ORG = /(شركة|جهة|مؤسسة|company|organi[sz]ation|org)/i;

/** vCard text → rows: name, phone(s), email(s), organisation. */
export function parseVcards(text: string): Row[] {
	const rows: Row[] = [['الاسم / Name', 'الهاتف / Phone', 'البريد / Email', 'الجهة / Organisation']];
	const unfolded = text.replace(/\r?\n[ \t]/g, '');
	for (const card of unfolded.split(/BEGIN:VCARD/i).slice(1)) {
		const field = (key: string) =>
			card
				.split(/\r?\n/)
				.filter((l) => new RegExp(`^${key}[;:]`, 'i').test(l))
				.map((l) => l.slice(l.indexOf(':') + 1).replace(/\\([,;\\])/g, '$1').replace(/\\n/gi, ' ').trim());
		const fn = field('FN')[0] || field('N')[0]?.split(';').filter(Boolean).reverse().join(' ') || '';
		rows.push([fn, field('TEL').join(' / '), field('EMAIL').join(' / '), field('ORG')[0]?.replace(/;/g, ' ') ?? '']);
	}
	return rows;
}

/** Spreadsheet chores; params.action: merge | split | dedupe | clean | to-vcard | from-vcard. */
const adapter: Adapter = {
	async convert(input, options) {
		const action = String(options.action);
		const name = base(input.name);

		if (action === 'from-vcard') {
			const rows = parseVcards(decodeText(input.bytes));
			if (rows.length < 2) throw new ConvertError('nothing');
			return [await book([{ name: 'Contacts', rows }], `${name}.xlsx`)];
		}

		const rows = await firstSheetRows(input);
		if (rows.length < 1) throw new ConvertError('nothing');
		const [header, ...body] = rows;

		if (action === 'to-vcard') {
			const n = findColumn(header, NAME);
			const p = findColumn(header, PHONE);
			const e = findColumn(header, EMAIL);
			const o = findColumn(header, ORG);
			if (n < 0) throw new ConvertError('nothing', 'no name column');
			const cards = body
				.filter((r) => str(r[n]).trim())
				.map((r) => vcardPayload({ name: str(r[n]).trim(), phone: p >= 0 ? str(r[p]) : '', email: e >= 0 ? str(r[e]) : '', org: o >= 0 ? str(r[o]) : '' }));
			if (!cards.length) throw new ConvertError('nothing');
			return [{ name: `${name}.vcf`, type: 'text/vcard', bytes: new TextEncoder().encode(cards.join('\n') + '\n') }];
		}

		if (action === 'dedupe') {
			const cols = String(options.columns ?? '')
				.split(/[,،]/)
				.map((c) => c.trim())
				.filter(Boolean)
				.map((c) => columnOf(header, c));
			if (cols.some((i) => i < 0)) throw new ConvertError('nothing', 'unknown column');
			const seen = new Set<string>();
			const kept = body.filter((r) => {
				const key = JSON.stringify((cols.length ? cols : header.map((_, i) => i)).map((i) => str(r[i]).trim().toLowerCase()));
				if (seen.has(key)) return false;
				seen.add(key);
				return true;
			});
			return [await book([{ name: 'Data', rows: [header, ...kept] }], `${name}-unique.xlsx`)];
		}

		if (action === 'clean') {
			const digits = String(options.digits ?? 'keep');
			const fix = (v: unknown) => {
				if (typeof v !== 'string') return v;
				let s = v.replace(/\s+/g, ' ').trim();
				if (options.tashkeel === true) s = removeTashkeel(s);
				if (digits === 'western') s = toWesternDigits(s);
				if (digits === 'arabic') s = toArabicDigits(s);
				return s;
			};
			let out = rows.map((r) => r.map(fix)).filter((r) => r.some((v) => str(v) !== ''));
			const width = Math.max(0, ...out.map((r) => r.length));
			const keepCols = Array.from({ length: width }, (_, i) => i).filter((i) => out.some((r) => str(r[i]) !== ''));
			out = out.map((r) => keepCols.map((i) => r[i] ?? ''));
			return [await book([{ name: 'Data', rows: out }], `${name}-clean.xlsx`)];
		}

		if (action === 'split') {
			const files: FileData[] = [];
			if (options.by === 'column') {
				const c = columnOf(header, String(options.column ?? ''));
				if (c < 0) throw new ConvertError('nothing', 'unknown column');
				const groups = new Map<string, Row[]>();
				for (const r of body) {
					const k = str(r[c]).trim() || '—';
					groups.set(k, [...(groups.get(k) ?? []), r]);
				}
				for (const [k, g] of groups) files.push(await book([{ name: k, rows: [header, ...g] }], `${name}-${k.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 60)}.xlsx`));
			} else {
				const size = Math.max(1, Number(options.rows) || 100);
				for (let i = 0; i < body.length; i += size)
					files.push(await book([{ name: 'Data', rows: [header, ...body.slice(i, i + size)] }], `${name}-${i / size + 1}.xlsx`));
			}
			if (!files.length) throw new ConvertError('nothing');
			return files;
		}

		throw new Error(`unknown action ${action}`);
	},

	/** Merge: every file's first sheet, as separate sheets or stacked under one header. */
	async combine(inputs, options) {
		const all = await Promise.all(inputs.map(async (f) => ({ name: base(f.name), rows: await firstSheetRows(f) })));
		if (options.mode === 'sheets') return [await book(all, 'merged.xlsx')];
		const header = [...(all[0].rows[0] ?? [])];
		const withSource = options.source === true;
		const out: Row[] = [withSource ? [...header, 'المصدر / Source'] : header];
		for (const f of all) {
			const [h = [], ...body] = f.rows;
			// Line columns up by header name, so files with columns in another order still merge right.
			const map = header.map((col) => h.findIndex((x) => str(x).trim() === str(col).trim()));
			for (const r of body) out.push([...map.map((i) => (i >= 0 ? r[i] : '')), ...(withSource ? [f.name] : [])]);
		}
		return [await book([{ name: 'Data', rows: out }], 'merged.xlsx')];
	}
};

export default adapter;
