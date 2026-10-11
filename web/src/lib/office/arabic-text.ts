/** Everyday Arabic text clean-ups. */

/** Harakat, tanween, shadda, sukun, dagger alef and Quranic marks. */
const TASHKEEL = /[ً-ٰٟۖ-ۭ]/g;
const TATWEEL = /ـ/g;

export const removeTashkeel = (s: string, tatweel = true) => {
	const out = s.replace(TASHKEEL, '');
	return tatweel ? out.replace(TATWEEL, '') : out;
};

/** ٠١٢ / ۰۱۲ (Persian) → 012 */
export const toWesternDigits = (s: string) =>
	s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

/** 012 → ٠١٢ */
export const toArabicDigits = (s: string) => s.replace(/[0-9]/g, (d) => String.fromCharCode(0x0660 + Number(d)));

/**
 * One spelling for search and matching: أ/إ/آ → ا, ى → ي, ؤ → و, ئ → ي, ة → ه (optional),
 * no tashkeel or tatweel, Western digits.
 */
export function normalizeArabic(s: string, { taMarbuta = true } = {}) {
	let out = toWesternDigits(removeTashkeel(s));
	out = out.replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي');
	return taMarbuta ? out.replace(/ة/g, 'ه') : out;
}

export function textStats(s: string) {
	const trimmed = s.trim();
	return {
		words: trimmed ? trimmed.split(/\s+/).length : 0,
		chars: [...s].length,
		charsNoSpaces: [...s.replace(/\s/g, '')].length,
		lines: s ? s.split(/\r?\n/).length : 0
	};
}
