/**
 * Documents → paragraphs to translate → the same document with the translations put back, so
 * styles, tables and images stay. Main thread only (DOMParser). Word, PowerPoint, Excel, text,
 * Markdown and subtitles (SRT).
 */
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { ConvertError } from '../registry/types';

export type Translate = (texts: string[]) => Promise<string[]>;
export const DOC_TYPES = ['docx', 'pptx', 'xlsx', 'txt', 'md', 'srt'] as const;
export type DocType = (typeof DOC_TYPES)[number];

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const S = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';

const parse = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml');
const serialize = (doc: Document) => new XMLSerializer().serializeToString(doc);

/** Children of `el` with this namespace and local name (direct only). */
const kids = (el: Element, ns: string, name: string) =>
	Array.from(el.children).filter((c) => c.namespaceURI === ns && c.localName === name);

/**
 * Inserts `child` into an OOXML properties element respecting the schema order: before the first
 * existing child whose name is in `before` (Word rejects files with elements out of order).
 */
function insertOrdered(parent: Element, child: Element, before: string[]) {
	const next = Array.from(parent.children).find((c) => before.includes(c.localName));
	parent.insertBefore(child, next ?? null);
}

function ensureFirst(parent: Element, ns: string, qname: string): Element {
	const local = qname.split(':')[1];
	let el = kids(parent, ns, local)[0];
	if (!el) {
		el = parent.ownerDocument.createElementNS(ns, qname);
		parent.insertBefore(el, parent.firstElementChild);
	}
	return el;
}

// ---- Word ------------------------------------------------------------------------------

const AFTER_BIDI = ['adjustRightInd', 'snapToGrid', 'spacing', 'ind', 'contextualSpacing', 'mirrorIndents', 'suppressOverlap', 'jc', 'textDirection', 'textAlignment', 'textboxTightWrap', 'outlineLvl', 'divId', 'cnfStyle', 'rPr', 'sectPr', 'pPrChange'];
const AFTER_RTL = ['cs', 'em', 'lang', 'eastAsianLayout', 'specVanish', 'oMath', 'rPrChange'];
const AFTER_BIDIVISUAL = ['tblStyleRowBandSize', 'tblStyleColBandSize', 'tblW', 'jc', 'tblCellSpacing', 'tblInd', 'tblBorders', 'shd', 'tblLayout', 'tblCellMar', 'tblLook', 'tblCaption', 'tblDescription', 'tblPrChange'];

/** Turns a direction flag (w:bidi, w:rtl, w:bidiVisual) on or off. */
function flag(parent: Element, local: string, on: boolean, before: string[]) {
	const existing = kids(parent, W, local)[0];
	if (on && !existing) insertOrdered(parent, parent.ownerDocument.createElementNS(W, `w:${local}`), before);
	if (!on && existing) existing.remove();
}

/** Nearest ancestor with this name (the w:p that owns a w:t; text boxes nest paragraphs). */
function closestNS(el: Element, ns: string, local: string): Element | null {
	for (let e = el.parentElement; e; e = e.parentElement) if (e.namespaceURI === ns && e.localName === local) return e;
	return null;
}

async function translateWordPart(xml: string, translate: Translate, rtl: boolean): Promise<string> {
	const doc = parse(xml);
	const paras = Array.from(doc.getElementsByTagNameNS(W, 'p'));
	const runsOf = paras.map((p) => Array.from(p.getElementsByTagNameNS(W, 't')).filter((t) => closestNS(t, W, 'p') === p));
	const texts = runsOf.map((ts) => ts.map((t) => t.textContent ?? '').join(''));
	const out = await translate(texts);
	paras.forEach((p, i) => {
		const ts = runsOf[i];
		if (!ts.length || out[i] === texts[i]) return;
		ts[0].textContent = out[i];
		ts[0].setAttributeNS(XML_NS, 'xml:space', 'preserve');
		for (const t of ts.slice(1)) t.textContent = '';
		const pPr = ensureFirst(p, W, 'w:pPr');
		flag(pPr, 'bidi', rtl, AFTER_BIDI);
		for (const r of p.getElementsByTagNameNS(W, 'r')) {
			if (closestNS(r, W, 'p') !== p) continue;
			flag(ensureFirst(r, W, 'w:rPr'), 'rtl', rtl, AFTER_RTL);
		}
	});
	// Tables read from the right in Arabic.
	for (const tblPr of doc.getElementsByTagNameNS(W, 'tblPr')) flag(tblPr, 'bidiVisual', rtl, AFTER_BIDIVISUAL);
	return serialize(doc);
}

// ---- PowerPoint --------------------------------------------------------------------------

async function translateSlide(xml: string, translate: Translate, rtl: boolean): Promise<string> {
	const doc = parse(xml);
	const paras = Array.from(doc.getElementsByTagNameNS(A, 'p'));
	const runsOf = paras.map((p) => Array.from(p.getElementsByTagNameNS(A, 't')));
	const texts = runsOf.map((ts) => ts.map((t) => t.textContent ?? '').join(''));
	const out = await translate(texts);
	paras.forEach((p, i) => {
		const ts = runsOf[i];
		if (!ts.length || out[i] === texts[i]) return;
		ts[0].textContent = out[i];
		for (const t of ts.slice(1)) t.textContent = '';
		const pPr = ensureFirst(p, A, 'a:pPr');
		if (rtl) {
			pPr.setAttribute('rtl', '1');
			if (!pPr.getAttribute('algn') || pPr.getAttribute('algn') === 'l') pPr.setAttribute('algn', 'r');
		} else {
			pPr.removeAttribute('rtl');
			if (pPr.getAttribute('algn') === 'r') pPr.setAttribute('algn', 'l');
		}
	});
	return serialize(doc);
}

// ---- Excel -------------------------------------------------------------------------------

/**
 * Shared strings (<si>) and, in sheets, inline strings (<is>) and plain string cells (t="str" without
 * a formula) — SheetJS and other tools write the last two.
 */
async function translateCells(xml: string, translate: Translate, sheetRtl: boolean | null): Promise<string> {
	const doc = parse(xml);
	if (sheetRtl !== null)
		for (const v of doc.getElementsByTagNameNS(S, 'sheetView')) {
			if (sheetRtl) v.setAttribute('rightToLeft', '1');
			else v.removeAttribute('rightToLeft');
		}
	const items = [...Array.from(doc.getElementsByTagNameNS(S, 'si')), ...Array.from(doc.getElementsByTagNameNS(S, 'is'))];
	const runsOf = items.map((si) => Array.from(si.getElementsByTagNameNS(S, 't')).filter((t) => !closestNS(t, S, 'rPh')));
	for (const c of Array.from(doc.getElementsByTagNameNS(S, 'c'))) {
		if (c.getAttribute('t') !== 'str' || kids(c, S, 'f').length) continue;
		const v = kids(c, S, 'v');
		if (v.length) runsOf.push(v);
	}
	const texts = runsOf.map((ts) => ts.map((t) => t.textContent ?? '').join(''));
	const out = await translate(texts);
	runsOf.forEach((ts, i) => {
		if (!ts.length || out[i] === texts[i]) return;
		ts[0].textContent = out[i];
		if (ts[0].localName === 't') ts[0].setAttributeNS(XML_NS, 'xml:space', 'preserve');
		for (const t of ts.slice(1)) t.textContent = '';
	});
	return serialize(doc);
}

// ---- Plain text, Markdown, subtitles -----------------------------------------------------

async function translateLines(text: string, translate: Translate, kind: 'txt' | 'md' | 'srt'): Promise<string> {
	const lines = text.replace(/\r\n/g, '\n').split('\n');
	const prefixes: string[] = [];
	const bodies: string[] = [];
	let code = false;
	for (const line of lines) {
		let prefix = '';
		let body = line;
		if (kind === 'md') {
			if (/^\s*(```|~~~)/.test(line)) code = !code;
			if (code || /^\s*(```|~~~)/.test(line) || /^\s*\|?\s*:?-{3,}/.test(line)) [prefix, body] = [line, ''];
			else {
				const m = line.match(/^(\s*(?:#{1,6}\s+|[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+|>\s*)*)(.*)$/)!;
				[prefix, body] = [m[1], m[2]];
			}
		} else if (kind === 'srt' && (/^\d+$/.test(line.trim()) || /-->/.test(line))) [prefix, body] = [line, ''];
		prefixes.push(prefix);
		bodies.push(body);
	}
	const out = await translate(bodies);
	return lines.map((_, i) => prefixes[i] + (bodies[i] ? out[i] : '')).join('\n');
}

// ---- Entry point -------------------------------------------------------------------------

export function docTypeOf(name: string): DocType | null {
	const ext = name.split('.').pop()?.toLowerCase() ?? '';
	return (DOC_TYPES as readonly string[]).includes(ext) ? (ext as DocType) : ext === 'markdown' ? 'md' : null;
}

/**
 * Collects every piece of text first (so the translator sees the whole document in one go, with
 * duplicates sent once), then writes the translations back.
 */
export async function translateDocument(bytes: Uint8Array, type: DocType, translate: Translate, rtl: boolean): Promise<Uint8Array> {
	if (type === 'txt' || type === 'md' || type === 'srt') {
		const text = new TextDecoder().decode(bytes).replace(/^﻿/, '');
		return strToU8((type === 'txt' ? '﻿' : '') + (await translateLines(text, translate, type)));
	}
	let files: Record<string, Uint8Array>;
	try {
		files = unzipSync(bytes);
	} catch {
		throw new ConvertError('corrupted');
	}
	const parts = Object.keys(files).filter((n) =>
		type === 'docx'
			? /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/.test(n)
			: type === 'pptx'
				? /^ppt\/(slides\/slide\d+|notesSlides\/notesSlide\d+)\.xml$/.test(n)
				: n === 'xl/sharedStrings.xml' || /^xl\/worksheets\/sheet\d+\.xml$/.test(n)
	);
	if (type === 'docx' && !files['word/document.xml']) throw new ConvertError('wrong-type');
	if (type === 'pptx' && !parts.length) throw new ConvertError('wrong-type');

	// Pass 1: gather every part's texts through a recording translator; pass 2: write them back.
	const gathered: string[][] = [];
	const record: Translate = async (texts) => {
		gathered.push(texts);
		return texts;
	};
	const work = (fn: Translate) =>
		Promise.all(
			parts.map((n) => {
				const xml = strFromU8(files[n]);
				if (type === 'docx') return translateWordPart(xml, fn, rtl);
				if (type === 'pptx') return translateSlide(xml, fn, rtl);
				return translateCells(xml, fn, n.startsWith('xl/worksheets/') ? rtl : null);
			})
		);
	await work(record);
	const all = await translate(gathered.flat());
	let k = 0;
	const answers = gathered.map((g) => all.slice(k, (k += g.length)));
	let call = 0;
	const results = await work(async () => answers[call++]);
	parts.forEach((n, i) => (files[n] = strToU8(results[i])));
	return zipSync(files, { level: 6 });
}
