/**
 * Reads a WhatsApp "Export chat" text file: Android and iPhone, Arabic or English phones,
 * 12/24-hour clocks, Arabic-Indic digits. Pure (no DOM), so it is unit-tested directly.
 */

export type Message = {
	/** Day as written in the file, normalised to ASCII digits ("31/12/2023"). */
	day: string;
	/** Time without seconds, as the phone showed it ("9:41 PM", "21:41", "9:41 م"). */
	time: string;
	/** null for system lines ("Messages are end-to-end encrypted", "X added Y"). */
	author: string | null;
	text: string;
	/** File name of a photo/video/document sent with the message (when the export kept it). */
	attachment?: string;
	/** The export left the media out ("<Media omitted>"). */
	omitted?: boolean;
	edited?: boolean;
};

export type Chat = { messages: Message[]; authors: string[]; dayFirst: boolean; rtl: boolean };

// Direction marks and isolates that phones sprinkle into exports.
const MARKS = /[\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g;

/** ASCII digits, plain spaces and commas, no direction marks. */
export function normalise(line: string): string {
	return line
		.replace(MARKS, '')
		.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
		.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0))
		.replace(/[\u202f\u00a0]/g, ' ')
		.replace(/،/g, ',');
}

const DATE = String.raw`(\d{1,4})[/.\-](\d{1,2})[/.\-](\d{1,4})`;
const TIME = String.raw`(\d{1,2}):(\d{2})(?::\d{2})?(?:\s*([AaPp]\.?\s?[Mm]\.?|ص|م))?`;
// iPhone: "[31/12/2023, 21:41:05] Name: text"
const IOS = new RegExp(String.raw`^\[${DATE},?\s+${TIME}\]\s+(.*)$`);
// Android: "31/12/2023, 21:41 - Name: text"
const ANDROID = new RegExp(String.raw`^${DATE},?\s+${TIME}\s+[-–]\s+(.*)$`);

const ATTACHED_ANDROID = /^(.+?\.[A-Za-z0-9]{2,5}) \((?:file attached|ملف مرفق|الملف مرفق|fichier joint|archivo adjunto|Datei angehängt)\)$/i;
const ATTACHED_IOS = /^<(?:attached|مرفق|المرفق|pièce jointe|adjunto|Anhang)\s*:\s*(.+?)>$/i;
const OMITTED = /^<?(?:Media omitted|تم استبعاد الوسائط|الوسائط غير مضمنة|(?:image|video|audio|sticker|GIF|document) omitted|(?:الصورة|الفيديو|الصوت|الملصق|المستند) (?:محذوف|محذوفة|غير مضمن|غير مضمنة))>?$/i;
const EDITED = /\s*<(?:This message was edited|تم تعديل هذه الرسالة)>$/i;

type Head = { a: number; b: number; y: string; time: string; rest: string };

function head(line: string): Head | null {
	const m = IOS.exec(line) ?? ANDROID.exec(line);
	if (!m) return null;
	const [, p1, p2, p3, hh, mm, ampm, rest] = m;
	// Year first ("2023-12-31") → a/b are month/day.
	const yearFirst = p1.length === 4;
	const a = Number(yearFirst ? p3 : p1);
	const b = Number(p2);
	const y = yearFirst ? p1 : p3;
	const time = `${Number(hh)}:${mm}${ampm ? ' ' + ampm.replace(/\s/g, '').toUpperCase().replace(/\./g, '') : ''}`;
	return { a: yearFirst ? Number(p3) : a, b, y, time, rest };
}

/** Splits "Name: text"; a line without a colon is a system message. */
function author(rest: string): [string | null, string] {
	const i = rest.indexOf(': ');
	if (i > 0 && i <= 80) return [rest.slice(0, i).trim(), rest.slice(i + 2)];
	if (rest.endsWith(':') && rest.length <= 81) return [rest.slice(0, -1).trim(), ''];
	return [null, rest];
}

export function parseChat(text: string): Chat {
	const lines = text.replace(/\r\n?/g, '\n').split('\n');
	const heads: (Head | null)[] = lines.map((l) => head(normalise(l)));
	// dd/mm or mm/dd: a part above 12 tells; else day first (most of the world, every Arabic locale).
	let dayFirst = true;
	if (heads.some((h) => h && h.b > 12 && h.a <= 12)) dayFirst = false;
	if (heads.some((h) => h && h.a > 12)) dayFirst = true;

	const messages: Message[] = [];
	lines.forEach((raw, i) => {
		const h = heads[i];
		if (!h) {
			// A continuation of the previous message (multi-line text).
			const last = messages[messages.length - 1];
			if (last) last.text += '\n' + raw.replace(MARKS, '');
			return;
		}
		const [who, body] = author(h.rest);
		const day = dayFirst ? `${h.a}/${h.b}/${h.y}` : `${h.b}/${h.a}/${h.y}`;
		messages.push({ day, time: h.time, author: who, text: body });
	});

	for (const m of messages) {
		let t = m.text.replace(MARKS, '').trim();
		if (EDITED.test(t)) {
			t = t.replace(EDITED, '');
			m.edited = true;
		}
		const firstLine = t.split('\n')[0].trim();
		const att = ATTACHED_IOS.exec(firstLine) ?? ATTACHED_ANDROID.exec(firstLine);
		if (att) {
			m.attachment = att[1].trim();
			t = t.split('\n').slice(1).join('\n').trim();
		} else if (OMITTED.test(t)) {
			m.omitted = true;
			t = '';
		}
		m.text = t;
	}

	const counts = new Map<string, number>();
	for (const m of messages) if (m.author) counts.set(m.author, (counts.get(m.author) ?? 0) + 1);
	const all = messages.map((m) => m.text).join(' ');
	const arabic = (all.match(/[؀-ۿ]/g) ?? []).length;
	const latin = (all.match(/[A-Za-z]/g) ?? []).length;
	return { messages, authors: [...counts.keys()], dayFirst, rtl: arabic >= latin };
}

/** "31/12/2023" (already day-first) → a Date, or null. Two-digit years are 20xx. */
export function dayToDate(day: string): Date | null {
	const [d, m, y] = day.split('/').map(Number);
	const year = y < 100 ? 2000 + y : y;
	const date = new Date(Date.UTC(year, m - 1, d));
	return date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date : null;
}

/** The chat's name from the export's file name: "WhatsApp Chat with Ahmed.txt" → "Ahmed". */
export function chatName(fileName: string): string {
	const stem = fileName.replace(/\.[^.]+$/, '').trim();
	const m = /^(?:WhatsApp Chat(?: with| -)|محادثة واتساب مع|دردشة واتساب مع|محادثة WhatsApp مع)\s*(.+)$/i.exec(stem);
	return (m ? m[1] : stem).trim();
}
