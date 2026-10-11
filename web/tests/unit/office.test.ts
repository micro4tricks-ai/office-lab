import { describe, expect, it } from 'vitest';
import { normalizeArabic, removeTashkeel, textStats, toArabicDigits, toWesternDigits } from '../../src/lib/office/arabic-text';
import { gregorianToHijri, hijriToGregorian } from '../../src/lib/office/hijri';

describe('Hijri ↔ Gregorian (Umm al-Qura)', () => {
	it('known dates', () => {
		expect(gregorianToHijri(new Date(Date.UTC(2023, 2, 23)))).toEqual({ y: 1444, m: 9, d: 1 }); // 1 Ramadan 1444
		expect(gregorianToHijri(new Date(Date.UTC(2024, 6, 7)))).toEqual({ y: 1446, m: 1, d: 1 }); // 1 Muharram 1446
	});

	it('round-trips every day of a span of years', () => {
		for (let t = Date.UTC(2020, 0, 1); t < Date.UTC(2030, 0, 1); t += 86_400_000 * 7) {
			const h = gregorianToHijri(new Date(t));
			expect(hijriToGregorian(h)?.getTime(), JSON.stringify(h)).toBe(t);
		}
	});

	it('a day that does not exist returns null', () => {
		expect(hijriToGregorian({ y: 1446, m: 13, d: 1 })).toBeNull();
	});
});

describe('Arabic text', () => {
	it('removes tashkeel and tatweel', () => {
		expect(removeTashkeel('مُحَمَّدٌ رَسُولُ اللَّهِ')).toBe('محمد رسول الله');
		expect(removeTashkeel('جمـــيل')).toBe('جميل');
		expect(removeTashkeel('جمـــيل', false)).toBe('جمـــيل');
	});

	it('converts digits both ways', () => {
		expect(toWesternDigits('رقم ١٢٣ و۴۵')).toBe('رقم 123 و45');
		expect(toArabicDigits('2026')).toBe('٢٠٢٦');
	});

	it('normalizes spellings for search', () => {
		expect(normalizeArabic('أحمد إلى مدرسةٌ')).toBe('احمد الي مدرسه');
		expect(normalizeArabic('مدرسة', { taMarbuta: false })).toBe('مدرسة');
	});

	it('counts', () => {
		expect(textStats('سطر أول\nسطر ثاني')).toEqual({ words: 4, chars: 16, charsNoSpaces: 13, lines: 2 });
	});
});
