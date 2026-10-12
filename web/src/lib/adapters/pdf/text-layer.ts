import amiriArabic from '@fontsource/amiri/files/amiri-arabic-400-normal.woff?url';
import amiriLatin from '@fontsource/amiri/files/amiri-latin-400-normal.woff?url';
import type { PDFDocument } from '@cantoo/pdf-lib';
import { woffToSfnt } from './woff';

/**
 * Amiri (Arabic + Latin) for invisible text layers (OCR, chat PDFs), so the PDF can be searched
 * and copied. The layer is never seen, so no shaping: one plain glyph per character keeps the
 * ToUnicode map exact (shaped Arabic glyphs extract as garbage).
 */
export async function embedPlainFonts(doc: PDFDocument) {
	const fontkit = (await import('@pdf-lib/fontkit')).default;
	doc.registerFontkit(fontkit);
	// As TrueType (Acrobat and MuPDF refuse a WOFF inside a PDF), whole: fontkit's subsetter fails on Amiri.
	const load = async (url: string) => woffToSfnt(new Uint8Array(await (await fetch(url)).arrayBuffer()));
	const off = Object.fromEntries(
		['init', 'medi', 'fina', 'isol', 'liga', 'rlig', 'calt', 'ccmp', 'mark', 'mkmk', 'curs', 'kern', 'locl'].map((f) => [f, false])
	);
	return {
		ar: await doc.embedFont(await load(amiriArabic), { subset: false, features: off }),
		en: await doc.embedFont(await load(amiriLatin), { subset: false, features: off })
	};
}
