import type { PDFFont, PDFPage } from '@cantoo/pdf-lib';
import { ConvertError, type Adapter, type FileData } from '../../registry/types';
import { chatName, dayToDate, parseChat, type Message } from '../../whatsapp/parse';
import { pdfLib, pdfOut, savePdf } from '../pdf/lib';
import { embedPlainFonts } from '../pdf/text-layer';
import { FAMILY, isArabic, loadFonts } from '../text-image';

/**
 * WhatsApp "Export chat" (.txt, or the .zip with media) → a PDF that looks like the chat:
 * bubbles, names, times, day separators and the photos. Pages are drawn on a canvas (so Arabic
 * is shaped by the browser), with an invisible text layer on top so the PDF can be searched.
 */

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 36;
const FOOTER = 18;
const SCALE = 2; // canvas pixels per PDF point (~144 dpi)
const CONTENT_W = PAGE_W - MARGIN * 2;
const BUBBLE_MAX = CONTENT_W * 0.75;
const PAD_X = 8;
const PAD_Y = 5;
const TEXT = 10.5;
const LINE = 15;
const NAME = 9;
const META = 7.5;
const GAP = 4;
const IMAGE_MAX_W = 240;
const IMAGE_MAX_H = 260;
const MAX_ENTRIES = 5000;
const MAX_UNPACKED = 1024 * 1024 * 1024;

type Theme = { bg: string; mine: string; theirs: string; text: string; meta: string; pill: string; border: string };
const THEMES: Record<string, Theme> = {
	whatsapp: { bg: '#efeae2', mine: '#d9fdd3', theirs: '#ffffff', text: '#111b21', meta: '#667781', pill: '#ffffff', border: '#00000014' },
	plain: { bg: '#ffffff', mine: '#e7f3ec', theirs: '#f2f3f5', text: '#111111', meta: '#5f6368', pill: '#eceff1', border: '#00000018' }
};
const NAME_COLORS = ['#1f6fd1', '#b8326f', '#087f5b', '#a35200', '#6d3fd1', '#b4233c', '#0b7285', '#4f7a0a'];

const WORDS = {
	ar: {
		title: 'محادثة واتساب',
		count: (n: number) => `${n.toLocaleString('ar-EG')} رسالة`,
		people: 'المشاركون',
		omitted: 'وسائط لم تُضمَّن في التصدير',
		file: 'ملف مرفق',
		edited: 'معدّلة',
		page: (n: number, m: number) => `صفحة ${n.toLocaleString('ar-EG')} من ${m.toLocaleString('ar-EG')}`,
		locale: 'ar-EG'
	},
	en: {
		title: 'WhatsApp chat',
		count: (n: number) => `${n.toLocaleString('en')} messages`,
		people: 'People',
		omitted: 'media not included in the export',
		file: 'attached file',
		edited: 'edited',
		page: (n: number, m: number) => `Page ${n} of ${m}`,
		locale: 'en-GB'
	}
};
type Words = (typeof WORDS)['ar'];

const font = (size: number, weight = 400, italic = false) => `${italic ? 'italic ' : ''}${weight} ${size}px "${FAMILY}", sans-serif`;

/** First strong character decides the direction of a line. */
function rtlOf(text: string, fallback: boolean) {
	const m = /[A-Za-z؀-ۿݐ-ݿא-ת]/.exec(text);
	return m ? isArabic(m[0]) || /[א-ת]/.test(m[0]) : fallback;
}

/** `note`: grey italic remark (attachment name, media left out). */
type Line = { text: string; rtl: boolean; width: number; note?: boolean };

const measurer = () => new OffscreenCanvas(1, 1).getContext('2d')!;

/** Greedy word wrap; words longer than the line (links) are cut. */
function wrap(ctx: OffscreenCanvasRenderingContext2D, text: string, f: string, max: number, fallbackRtl: boolean): Line[] {
	ctx.font = f;
	const out: Line[] = [];
	for (const para of text.split('\n')) {
		const rtl = rtlOf(para, fallbackRtl);
		const push = (t: string) => out.push({ text: t, rtl, width: ctx.measureText(t).width });
		if (!para.trim()) {
			push('');
			continue;
		}
		let line = '';
		for (const word of para.split(/(?<=\s)/)) {
			const next = line + word;
			if (ctx.measureText(next.trimEnd()).width <= max) {
				line = next;
				continue;
			}
			if (line.trim()) push(line.trimEnd());
			line = '';
			let rest = word;
			while (ctx.measureText(rest.trimEnd()).width > max) {
				let cut = rest.length - 1;
				while (cut > 1 && ctx.measureText(rest.slice(0, cut)).width > max) cut--;
				push(rest.slice(0, cut));
				rest = rest.slice(cut);
			}
			line = rest;
		}
		if (line.trim()) push(line.trimEnd());
	}
	return out;
}

type Picture = { bitmap: ImageBitmap; w: number; h: number };

type Block =
	| { kind: 'title'; h: number; title: string; sub: string; people: string }
	| { kind: 'pill'; h: number; text: string; lines: Line[]; system: boolean }
	| {
			kind: 'bubble';
			h: number;
			mine: boolean;
			name?: { text: string; color: string };
			lines: Line[];
			picture?: Picture;
			note?: string;
			time: string;
			width: number;
			/** Joins the bubble above (same sender): a smaller gap. */
			follow: boolean;
	  };

type Placed = { block: Block; y: number };

const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;

async function picture(bytes: Uint8Array): Promise<Picture | undefined> {
	try {
		const full = await createImageBitmap(new Blob([bytes as BlobPart]));
		const k = Math.min(1, IMAGE_MAX_W / full.width, IMAGE_MAX_H / full.height);
		const w = Math.max(24, full.width * k);
		const h = Math.max(24, full.height * k);
		// Keep only what the page needs (a phone photo is ~48 MB decoded).
		const bitmap = await createImageBitmap(full, { resizeWidth: Math.round(w * SCALE), resizeHeight: Math.round(h * SCALE), resizeQuality: 'high' });
		full.close();
		return { bitmap, w, h };
	} catch {
		return undefined;
	}
}

/** The chat text and, from a ZIP export, its pictures by file name. */
async function unpack(input: FileData): Promise<{ text: string; name: string; media: Map<string, Uint8Array> }> {
	const media = new Map<string, Uint8Array>();
	const isZip = input.bytes[0] === 0x50 && input.bytes[1] === 0x4b;
	if (!isZip) return { text: new TextDecoder().decode(input.bytes), name: input.name, media };
	const { unzipSync } = await import('fflate');
	let count = 0;
	let total = 0;
	let files: Record<string, Uint8Array>;
	try {
		files = unzipSync(input.bytes, {
			filter: (f) => {
				count++;
				total += f.originalSize;
				if (count > MAX_ENTRIES || total > MAX_UNPACKED) throw new ConvertError('too-big', 'archive unpacks too large');
				return /\.txt$/i.test(f.name) || IMAGE_EXT.test(f.name);
			}
		});
	} catch (e) {
		if (e instanceof ConvertError) throw e;
		throw new ConvertError('corrupted');
	}
	const texts = Object.keys(files).filter((n) => /\.txt$/i.test(n));
	const chat = texts.find((n) => /(^|\/)_chat\.txt$/i.test(n)) ?? texts.find((n) => /whatsapp|واتساب|محادثة/i.test(n)) ?? texts[0];
	if (!chat) throw new ConvertError('wrong-type', 'no chat text in the ZIP');
	for (const [n, b] of Object.entries(files)) if (IMAGE_EXT.test(n)) media.set(n.split('/').pop()!, b);
	// iPhone ZIPs hold "_chat.txt": the ZIP's own name carries the chat's name.
	const name = /(^|\/)_chat\.txt$/i.test(chat) ? input.name : chat.split('/').pop()!;
	return { text: new TextDecoder().decode(files[chat]), name, media };
}

function dayLabel(day: string, locale: string) {
	const d = dayToDate(day);
	return d ? new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d) : day;
}

async function layout(messages: Message[], o: { me: string; media: Map<string, Uint8Array> | null; rtl: boolean; w: Words; title: string; authors: string[]; group: boolean }) {
	const ctx = measurer();
	const blocks: Block[] = [];
	const colors = new Map(o.authors.map((a, i) => [a, NAME_COLORS[i % NAME_COLORS.length]]));
	const first = messages.find((m) => m.author)?.day;
	const last = [...messages].reverse().find((m) => m.author)?.day;
	const count = messages.filter((m) => m.author).length;
	const range = first && last ? (first === last ? dayLabel(first, o.w.locale) : `${dayLabel(first, o.w.locale)} — ${dayLabel(last, o.w.locale)}`) : '';
	blocks.push({
		kind: 'title',
		h: 62,
		title: `${o.w.title}: ${o.title}`,
		sub: [o.w.count(count), range].filter(Boolean).join(' · '),
		people: `${o.w.people}: ${o.authors.slice(0, 12).join(o.rtl ? '، ' : ', ')}${o.authors.length > 12 ? ' …' : ''}`
	});
	let day = '';
	let prev: string | null = null;
	const me = o.me.trim().toLowerCase();
	for (const m of messages) {
		if (m.day !== day) {
			day = m.day;
			prev = null;
			const text = dayLabel(m.day, o.w.locale);
			blocks.push({ kind: 'pill', h: 28, text, lines: [], system: false });
		}
		if (!m.author) {
			const lines = wrap(ctx, m.text, font(META + 0.5, 400, true), CONTENT_W * 0.8, o.rtl);
			blocks.push({ kind: 'pill', h: lines.length * 11 + 14, text: m.text, lines, system: true });
			prev = null;
			continue;
		}
		const mine = !!me && m.author.trim().toLowerCase() === me;
		const follow = prev === m.author;
		const showName = !mine && !follow && (o.group || !me);
		const name = showName ? { text: m.author, color: colors.get(m.author) ?? NAME_COLORS[0] } : undefined;
		let pic: Picture | undefined;
		let note: string | undefined;
		if (m.attachment) {
			const bytes = o.media?.get(m.attachment);
			if (bytes && IMAGE_EXT.test(m.attachment)) pic = await picture(bytes);
			if (!pic) note = `${o.w.file}: ${m.attachment}`;
		} else if (m.omitted) note = o.w.omitted;
		const lines = m.text ? wrap(ctx, m.text, font(TEXT), BUBBLE_MAX - PAD_X * 2, o.rtl) : [];
		const noteLines = note ? wrap(ctx, note, font(META + 1, 400, true), BUBBLE_MAX - PAD_X * 2, o.rtl) : [];
		ctx.font = font(NAME, 700);
		const nameW = name ? ctx.measureText(name.text).width : 0;
		ctx.font = font(META);
		const timeText = m.edited ? `${o.w.edited} · ${m.time}` : m.time;
		const timeW = ctx.measureText(timeText).width;
		const width = Math.min(
			BUBBLE_MAX,
			Math.max(70, nameW, timeW + 10, pic?.w ?? 0, ...lines.map((l) => l.width), ...noteLines.map((l) => l.width)) + PAD_X * 2
		);
		const h = PAD_Y * 2 + (name ? 13 : 0) + (pic ? pic.h + 4 : 0) + noteLines.length * 12 + lines.length * LINE + 11;
		blocks.push({ kind: 'bubble', h, mine, name, lines: [...noteLines.map((l) => ({ ...l, note: true })), ...lines], picture: pic, time: timeText, width, follow });
		prev = m.author;
	}
	return blocks;
}

/** Splits a bubble whose text runs past the page end: the first part keeps the name, the last the time. */
function splitBubble(b: Extract<Block, { kind: 'bubble' }>, room: number): [typeof b, typeof b] | null {
	const fixed = PAD_Y * 2 + (b.name ? 13 : 0) + (b.picture ? b.picture.h + 4 : 0);
	const fit = Math.floor((room - fixed - 4) / LINE);
	if (fit < 2 || fit >= b.lines.length) return null;
	const head = { ...b, lines: b.lines.slice(0, fit), time: '', h: fixed + fit * LINE + 4 };
	const tail = { ...b, name: undefined, picture: undefined, lines: b.lines.slice(fit), follow: true };
	tail.h = PAD_Y * 2 + tail.lines.length * LINE + 11;
	return [head, tail];
}

function paginate(blocks: Block[]): Placed[][] {
	const pages: Placed[][] = [[]];
	const bottom = PAGE_H - MARGIN - FOOTER;
	let y = MARGIN;
	const queue = [...blocks];
	while (queue.length) {
		const b = queue.shift()!;
		const gap = b.kind === 'bubble' && b.follow ? 2 : GAP;
		const top = pages[pages.length - 1].length ? y + gap : y;
		if (top + b.h <= bottom) {
			pages[pages.length - 1].push({ block: b, y: top });
			y = top + b.h;
			continue;
		}
		if (b.kind === 'bubble') {
			const parts = splitBubble(b, bottom - top);
			if (parts) {
				pages[pages.length - 1].push({ block: parts[0], y: top });
				queue.unshift(parts[1]);
				pages.push([]);
				y = MARGIN;
				continue;
			}
		}
		if (pages[pages.length - 1].length === 0) {
			// Taller than a page on its own: split by lines across pages.
			if (b.kind === 'bubble') {
				const parts = splitBubble(b, bottom - MARGIN);
				if (parts) {
					pages[pages.length - 1].push({ block: parts[0], y: MARGIN });
					queue.unshift(parts[1]);
					pages.push([]);
					continue;
				}
			}
			pages[pages.length - 1].push({ block: b, y: MARGIN });
			pages.push([]);
			y = MARGIN;
			continue;
		}
		pages.push([]);
		y = MARGIN;
		queue.unshift(b);
	}
	if (!pages[pages.length - 1].length) pages.pop();
	return pages;
}

/** Where to write invisible text: one entry per drawn line, in PDF points from the top-left. */
type TextRun = { text: string; x: number; right: number; y: number; size: number; rtl: boolean };

function roundRect(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
	ctx.beginPath();
	ctx.roundRect(x, y, w, h, r);
	ctx.fill();
}

function drawLine(ctx: OffscreenCanvasRenderingContext2D, runs: TextRun[], l: Line, left: number, right: number, baseline: number, size: number) {
	ctx.direction = l.rtl ? 'rtl' : 'ltr';
	ctx.textAlign = l.rtl ? 'right' : 'left';
	ctx.fillText(l.text, l.rtl ? right : left, baseline);
	if (l.text.trim()) runs.push({ text: l.text, x: left, right, y: baseline, size, rtl: l.rtl });
}

function drawPage(placed: Placed[], n: number, total: number, t: Theme, rtl: boolean, w: Words, title: string) {
	const canvas = new OffscreenCanvas(Math.round(PAGE_W * SCALE), Math.round(PAGE_H * SCALE));
	const ctx = canvas.getContext('2d')!;
	ctx.scale(SCALE, SCALE);
	ctx.fillStyle = t.bg;
	ctx.fillRect(0, 0, PAGE_W, PAGE_H);
	ctx.textBaseline = 'alphabetic';
	const runs: TextRun[] = [];
	const startX = (bw: number) => (rtl ? PAGE_W - MARGIN - bw : MARGIN);
	const endX = (bw: number) => (rtl ? MARGIN : PAGE_W - MARGIN - bw);

	for (const { block: b, y } of placed) {
		if (b.kind === 'title') {
			ctx.fillStyle = t.text;
			ctx.font = font(16, 700);
			drawLine(ctx, runs, { text: b.title, rtl: rtlOf(b.title, rtl), width: 0 }, MARGIN, PAGE_W - MARGIN, y + 18, 16);
			ctx.fillStyle = t.meta;
			ctx.font = font(9);
			drawLine(ctx, runs, { text: b.sub, rtl, width: 0 }, MARGIN, PAGE_W - MARGIN, y + 34, 9);
			drawLine(ctx, runs, { text: b.people, rtl, width: 0 }, MARGIN, PAGE_W - MARGIN, y + 48, 9);
			ctx.fillStyle = t.border;
			ctx.fillRect(MARGIN, y + 57, CONTENT_W, 0.75);
		} else if (b.kind === 'pill') {
			if (!b.system) {
				ctx.font = font(8.5, 600);
				const pw = ctx.measureText(b.text).width + 20;
				ctx.fillStyle = t.pill;
				roundRect(ctx, (PAGE_W - pw) / 2, y + 5, pw, 17, 8);
				ctx.fillStyle = t.meta;
				ctx.textAlign = 'center';
				ctx.direction = rtl ? 'rtl' : 'ltr';
				ctx.fillText(b.text, PAGE_W / 2, y + 16.5);
				runs.push({ text: b.text, x: (PAGE_W - pw) / 2 + 10, right: (PAGE_W + pw) / 2 - 10, y: y + 16.5, size: 8.5, rtl });
			} else {
				ctx.font = font(META + 0.5, 400, true);
				const pw = Math.max(...b.lines.map((l) => l.width)) + 20;
				ctx.fillStyle = t.pill;
				roundRect(ctx, (PAGE_W - pw) / 2, y + 3, pw, b.h - 6, 7);
				ctx.fillStyle = t.meta;
				b.lines.forEach((l, i) => {
					const lw = l.width;
					drawLine(ctx, runs, l, (PAGE_W - lw) / 2, (PAGE_W + lw) / 2, y + 15 + i * 11, META + 0.5);
				});
			}
		} else {
			const x = b.mine ? endX(b.width) : startX(b.width);
			ctx.fillStyle = b.mine ? t.mine : t.theirs;
			ctx.shadowColor = 'rgba(0,0,0,0.12)';
			ctx.shadowOffsetY = 0.6;
			ctx.shadowBlur = 0.8;
			roundRect(ctx, x, y, b.width, b.h, 7);
			ctx.shadowColor = 'transparent';
			const left = x + PAD_X;
			const right = x + b.width - PAD_X;
			let cy = y + PAD_Y;
			if (b.name) {
				ctx.fillStyle = b.name.color;
				ctx.font = font(NAME, 700);
				drawLine(ctx, runs, { text: b.name.text, rtl: rtlOf(b.name.text, rtl), width: 0 }, left, right, cy + 9, NAME);
				cy += 13;
			}
			if (b.picture) {
				const px = rtl ? right - b.picture.w : left;
				ctx.drawImage(b.picture.bitmap, px, cy + 1, b.picture.w, b.picture.h);
				b.picture.bitmap.close();
				cy += b.picture.h + 4;
			}
			for (const l of b.lines) {
				ctx.fillStyle = l.note ? t.meta : t.text;
				ctx.font = l.note ? font(META + 1, 400, true) : font(TEXT);
				const h = l.note ? 12 : LINE;
				drawLine(ctx, runs, l, left, right, cy + h - 4, l.note ? META + 1 : TEXT);
				cy += h;
			}
			if (b.time) {
				ctx.fillStyle = t.meta;
				ctx.font = font(META);
				ctx.direction = 'ltr';
				// The time sits in the bubble's far corner, like on the phone.
				ctx.textAlign = rtl ? 'left' : 'right';
				ctx.fillText(b.time, rtl ? left : right, y + b.h - PAD_Y - 1);
			}
		}
	}
	ctx.fillStyle = t.meta;
	ctx.font = font(8);
	ctx.direction = rtl ? 'rtl' : 'ltr';
	ctx.textAlign = 'center';
	const footer = `${title} — ${w.page(n, total)}`;
	const fw = ctx.measureText(footer).width;
	ctx.fillText(footer, PAGE_W / 2, PAGE_H - MARGIN / 2 - 4);
	runs.push({ text: footer, x: (PAGE_W - fw) / 2, right: (PAGE_W + fw) / 2, y: PAGE_H - MARGIN / 2 - 4, size: 8, rtl });
	return { canvas, runs };
}

/** Invisible text over each drawn line, split into Arabic / other runs (each font has its script). */
function writeRuns(page: PDFPage, runs: TextRun[], fonts: { ar: PDFFont; en: PDFFont }, sets: { ar: Set<number>; en: Set<number> }) {
	for (const r of runs) {
		// Arabic-Indic digits as ASCII, in their own runs: readers reverse them inside Arabic runs,
		// and people search "2026" either way.
		const plain = r.text.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660));
		const words = plain.split(/(\s+)/).filter((s) => s.length);
		const segs: { text: string; ar: boolean }[] = [];
		for (const wd of words) {
			const ar = isArabic(wd);
			const last = segs[segs.length - 1];
			if (last && (last.ar === ar || !wd.trim())) last.text += wd;
			else segs.push({ text: wd, ar });
		}
		let cursor = r.rtl ? r.right : r.x;
		for (const s of segs) {
			const f = s.ar ? fonts.ar : fonts.en;
			const set = s.ar ? sets.ar : sets.en;
			const text = [...s.text].filter((c) => set.has(c.codePointAt(0)!) || c === ' ').join('');
			if (!text.trim()) continue;
			let width: number;
			try {
				width = f.widthOfTextAtSize(text, r.size);
			} catch {
				continue;
			}
			const x = r.rtl ? cursor - width : cursor;
			try {
				page.drawText(text, { x, y: PAGE_H - r.y, size: r.size, font: f, opacity: 0 });
			} catch {
				/* a character the font can't encode: leave this run out of the search layer */
			}
			cursor = r.rtl ? cursor - width : cursor + width;
		}
	}
}

const adapter: Adapter = {
	async convert(input, options, onProgress) {
		const lang = options.uiLang === 'en' ? 'en' : 'ar';
		const { text, name, media } = await unpack(input);
		const chat = parseChat(text);
		if (!chat.messages.some((m) => m.author)) throw new ConvertError('wrong-type', 'not a WhatsApp export');
		await loadFonts();
		const theme = THEMES[String(options.theme)] ?? THEMES.whatsapp;
		const title = chatName(name);
		const w = WORDS[lang];
		const blocks = await layout(chat.messages, {
			me: String(options.me ?? ''),
			media: options.photos === false ? null : media,
			rtl: chat.rtl,
			w,
			title,
			authors: chat.authors,
			group: chat.authors.length > 2
		});
		onProgress?.(0.1);
		const pages = paginate(blocks);
		const { PDFDocument } = await pdfLib();
		const doc = await PDFDocument.create();
		doc.setTitle(`${w.title}: ${title}`);
		doc.setLanguage(chat.rtl ? 'ar' : 'en');
		const fonts = await embedPlainFonts(doc);
		const sets = { ar: new Set(fonts.ar.getCharacterSet()), en: new Set(fonts.en.getCharacterSet()) };
		for (let i = 0; i < pages.length; i++) {
			const { canvas, runs } = drawPage(pages[i], i + 1, pages.length, theme, chat.rtl, w, title);
			const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.86 });
			const jpg = await doc.embedJpg(new Uint8Array(await blob.arrayBuffer()));
			const page = doc.addPage([PAGE_W, PAGE_H]);
			page.drawImage(jpg, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });
			writeRuns(page, runs, fonts, sets);
			onProgress?.(0.1 + (0.85 * (i + 1)) / pages.length);
		}
		const stem = name.replace(/\.[^.]+$/, '').replace(/^_chat$/, 'whatsapp-chat');
		return [pdfOut(`${stem}.pdf`, await savePdf(doc))];
	}
};

export default adapter;
