import { ConvertError, type FileData } from '../../registry/types';

export type XLSX = typeof import('xlsx');
export const sheetjs = (): Promise<XLSX> => import('xlsx');

const hasArabic = (s: string) => /[؀-ۿ]/.test(s);

/**
 * Text files: UTF-8 if valid, else Windows-1256 (what Arabic Excel writes for CSV).
 * A UTF-8 byte-order mark is dropped.
 */
export function decodeText(bytes: Uint8Array): string {
	try {
		return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, '');
	} catch {
		return new TextDecoder('windows-1256').decode(bytes);
	}
}

/** Comma, semicolon or tab — whichever the first lines use most. */
export function guessDelimiter(text: string): string {
	const head = text.split(/\r?\n/).slice(0, 5).join('\n');
	const counts = [',', ';', '\t'].map((d) => [d, head.split(d).length] as const);
	return counts.sort((a, b) => b[1] - a[1])[0][0];
}

/** Reads any spreadsheet-ish file (xlsx, xls, ods, csv/tsv, JSON array) into a workbook. */
export async function readBook(file: FileData) {
	const X = await sheetjs();
	const b = file.bytes;
	const binary = (b[0] === 0x50 && b[1] === 0x4b) || (b[0] === 0xd0 && b[1] === 0xcf); // zip (xlsx/ods) or OLE (xls)
	try {
		if (binary) return X.read(b, { type: 'array', cellDates: true });
		const text = decodeText(b);
		const t = text.trimStart();
		if (t.startsWith('[') || t.startsWith('{')) {
			const data = JSON.parse(t);
			const rows = Array.isArray(data) ? data : [data];
			const wb = X.utils.book_new();
			X.utils.book_append_sheet(wb, X.utils.json_to_sheet(rows.map((r) => flatten(r))), 'Sheet1');
			return wb;
		}
		const wb = X.read(text, { type: 'string', FS: guessDelimiter(text), raw: true });
		for (const name of wb.SheetNames) keepLeadingZeros(wb.Sheets[name]);
		return wb;
	} catch (e) {
		throw new ConvertError('corrupted', e instanceof Error ? e.message : String(e));
	}
}

/**
 * CSV cells are read as text, then only real numbers become numbers: "0100" (a phone),
 * "00123" (a code) and 16+ digit IDs stay text, so nothing loses its leading zeros.
 */
function keepLeadingZeros(ws: import('xlsx').WorkSheet) {
	for (const [ref, c] of Object.entries(ws)) {
		if (ref.startsWith('!') || c.t !== 's') continue;
		const v = String(c.v).trim();
		if (/^-?(0|[1-9]\d{0,14})(\.\d+)?$/.test(v)) {
			c.t = 'n';
			c.v = Number(v);
		}
	}
}

/** Nested JSON objects become dotted columns: {a:{b:1}} → {"a.b":1}. */
export function flatten(row: unknown, prefix = '', out: Record<string, unknown> = {}): Record<string, unknown> {
	if (row === null || typeof row !== 'object' || Array.isArray(row)) {
		out[prefix || 'value'] = Array.isArray(row) ? JSON.stringify(row) : row;
		return out;
	}
	for (const [k, v] of Object.entries(row)) {
		const key = prefix ? `${prefix}.${k}` : k;
		if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) flatten(v, key, out);
		else out[key] = Array.isArray(v) ? JSON.stringify(v) : v;
	}
	return out;
}

/** Rows as arrays (first row = header), empty cells as ''. */
export async function rowsOf(ws: import('xlsx').WorkSheet): Promise<unknown[][]> {
	const X = await sheetjs();
	return X.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', raw: false, blankrows: false });
}

/** Sheets to export: all, or just the first. */
export function pickSheets(wb: import('xlsx').WorkBook, which: unknown) {
	const names = which === 'first' ? wb.SheetNames.slice(0, 1) : wb.SheetNames;
	return names.map((name) => ({ name, ws: wb.Sheets[name] }));
}

/** "data.xlsx" + sheet "Jan" (when several) → "data-Jan.csv". */
export function sheetFileName(input: string, sheet: string, many: boolean, ext: string) {
	const base = input.replace(/\.[^.]+$/, '');
	const safe = sheet.replace(/[\\/:*?"<>|]+/g, '_').trim();
	return `${base}${many ? '-' + safe : ''}.${ext}`;
}

/** A workbook whose sheets show right-to-left when the content is Arabic. */
export function setRtlIfArabic(wb: import('xlsx').WorkBook, sample: string) {
	if (!hasArabic(sample)) return;
	wb.Workbook ??= {};
	wb.Workbook.Views = [{ RTL: true }];
}

export const textFile = (name: string, type: string, text: string, bom = false): FileData => ({
	name,
	type,
	bytes: new TextEncoder().encode((bom ? '﻿' : '') + text)
});

export { hasArabic };
