/** Hijri (Umm al-Qura, as used officially in Saudi Arabia) ↔ Gregorian, with the browser's own calendar data. */

export type HDate = { y: number; m: number; d: number };

const fmt = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura-nu-latn', {
	day: 'numeric',
	month: 'numeric',
	year: 'numeric',
	timeZone: 'UTC'
});

export function gregorianToHijri(date: Date): HDate {
	const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
	return { y: parseInt(parts.year, 10), m: parseInt(parts.month, 10), d: parseInt(parts.day, 10) };
}

const EPOCH = Date.UTC(622, 6, 16); // 1 Muharram 1 AH (civil)
const DAY = 86_400_000;
const serial = (h: HDate) => (h.y * 12 + h.m) * 30 + h.d;

/** Hijri → Gregorian (UTC midnight), or null if that day does not exist (e.g. 30th of a 29-day month). */
export function hijriToGregorian(h: HDate): Date | null {
	if (h.m < 1 || h.m > 12 || h.d < 1 || h.d > 30 || h.y < 1) return null;
	// Start from the mean lunar calendar, then walk a few days until the calendar agrees.
	let t = EPOCH + Math.round((h.y - 1) * 354.36707 + (h.m - 1) * 29.530588 + (h.d - 1)) * DAY;
	for (let i = 0; i < 40; i++) {
		const got = gregorianToHijri(new Date(t));
		const diff = serial(h) - serial(got);
		if (diff === 0) return new Date(t);
		t += Math.sign(diff) * Math.max(1, Math.min(Math.abs(diff), 15)) * DAY;
	}
	return null;
}

export const hijriLong = (date: Date, lang: 'ar' | 'en') =>
	new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-ca-islamic-umalqura' : 'en-u-ca-islamic-umalqura', {
		dateStyle: 'full',
		timeZone: 'UTC'
	}).format(date);

export const gregorianLong = (date: Date, lang: 'ar' | 'en') =>
	new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'full', timeZone: 'UTC' }).format(date);
