import { describe, expect, it } from 'vitest';
import { CURRENCIES, numberToArabic, numberToEnglish, tafqeet, tafqeetEnglish } from '../../src/lib/office/tafqeet';

const EGP = CURRENCIES.find((c) => c.code === 'EGP')!;
const SAR = CURRENCIES.find((c) => c.code === 'SAR')!;
const KWD = CURRENCIES.find((c) => c.code === 'KWD')!;

describe('numberToArabic', () => {
	it.each([
		[0, 'صفر'],
		[7, 'سبعة'],
		[11, 'أحد عشر'],
		[12, 'اثنا عشر'],
		[15, 'خمسة عشر'],
		[21, 'واحد وعشرون'],
		[100, 'مائة'],
		[200, 'مائتان'],
		[305, 'ثلاثمائة وخمسة'],
		[1000, 'ألف'],
		[2000, 'ألفان'],
		[3000, 'ثلاثة آلاف'],
		[11000, 'أحد عشر ألفًا'],
		[100000, 'مائة ألف'],
		[1500, 'ألف وخمسمائة'],
		[2750, 'ألفان وسبعمائة وخمسون'],
		[1000000, 'مليون'],
		[3000000, 'ثلاثة ملايين'],
		[1234567, 'مليون ومائتان وأربعة وثلاثون ألفًا وخمسمائة وسبعة وستون']
	])('%i → %s', (n, words) => {
		expect(numberToArabic(n)).toBe(words);
	});

	it('feminine counted nouns flip 3–9 and change 1, 2, 10–19', () => {
		expect(numberToArabic(3, 'f')).toBe('ثلاث');
		expect(numberToArabic(10, 'f')).toBe('عشر');
		expect(numberToArabic(11, 'f')).toBe('إحدى عشرة');
		expect(numberToArabic(13, 'f')).toBe('ثلاث عشرة');
		expect(numberToArabic(22, 'f')).toBe('اثنتان وعشرون');
	});
});

describe('tafqeet', () => {
	it.each([
		[1, 'فقط جنيه مصري واحد لا غير'],
		[2, 'فقط جنيهان مصريان لا غير'],
		[3, 'فقط ثلاثة جنيهات مصرية لا غير'],
		[11, 'فقط أحد عشر جنيهًا مصريًا لا غير'],
		[100, 'فقط مائة جنيه مصري لا غير'],
		[1500, 'فقط ألف وخمسمائة جنيه مصري لا غير'],
		[1500.5, 'فقط ألف وخمسمائة جنيه مصري وخمسون قرشًا لا غير'],
		[0.25, 'فقط خمسة وعشرون قرشًا لا غير']
	])('EGP %s', (n, words) => {
		expect(tafqeet(n, EGP)).toBe(words);
	});

	it('feminine sub-units (halala) and 1000-based fils', () => {
		expect(tafqeet(10.03, SAR)).toBe('فقط عشرة ريالات سعودية وثلاث هللات لا غير');
		expect(tafqeet(5.25, KWD)).toBe('فقط خمسة دنانير كويتية ومائتان وخمسون فلسًا لا غير');
	});
});

describe('English', () => {
	it('words and amounts', () => {
		expect(numberToEnglish(1515)).toBe('one thousand five hundred and fifteen');
		expect(tafqeetEnglish(1500.5, EGP)).toBe('One thousand five hundred Egyptian pounds and fifty piastres only');
		expect(tafqeetEnglish(1, EGP)).toBe('One Egyptian pound only');
	});
});
