/**
 * تفقيط: amounts in Arabic (and English) words, the way invoices and cheques write them:
 * "فقط ألف وخمسمائة جنيه مصري وخمسون قرشًا لا غير".
 *
 * Arabic rules used:
 * - 1 and 2 agree with the counted noun; 3–10 take the opposite gender (ثلاثة جنيهات / ثلاث هللات).
 * - The noun after the number: 1 → singular, 2 → dual, 3–10 → plural, 11–99 → singular with
 *   tanween (خمسون جنيهًا), otherwise singular (مائة جنيه) — decided by the last two digits.
 * - Thousands/millions/billions follow the same pattern (ثلاثة آلاف، أحد عشر ألفًا).
 */

type Gender = 'm' | 'f';
type Noun = { one: string; two: string; few: string; many: string; gender: Gender };
export type Currency = { code: string; label: { ar: string; en: string }; main: Noun; sub?: Noun & { per: number }; en: { one: string; many: string; subOne?: string; subMany?: string } };

export const CURRENCIES: Currency[] = [
	{
		code: 'EGP',
		label: { ar: 'جنيه مصري', en: 'Egyptian pound' },
		main: { one: 'جنيه مصري', two: 'جنيهان مصريان', few: 'جنيهات مصرية', many: 'جنيهًا مصريًا', gender: 'm' },
		sub: { one: 'قرش', two: 'قرشان', few: 'قروش', many: 'قرشًا', gender: 'm', per: 100 },
		en: { one: 'Egyptian pound', many: 'Egyptian pounds', subOne: 'piastre', subMany: 'piastres' }
	},
	{
		code: 'SAR',
		label: { ar: 'ريال سعودي', en: 'Saudi riyal' },
		main: { one: 'ريال سعودي', two: 'ريالان سعوديان', few: 'ريالات سعودية', many: 'ريالًا سعوديًا', gender: 'm' },
		sub: { one: 'هللة', two: 'هللتان', few: 'هللات', many: 'هللةً', gender: 'f', per: 100 },
		en: { one: 'Saudi riyal', many: 'Saudi riyals', subOne: 'halala', subMany: 'halalas' }
	},
	{
		code: 'AED',
		label: { ar: 'درهم إماراتي', en: 'UAE dirham' },
		main: { one: 'درهم إماراتي', two: 'درهمان إماراتيان', few: 'دراهم إماراتية', many: 'درهمًا إماراتيًا', gender: 'm' },
		sub: { one: 'فلس', two: 'فلسان', few: 'فلوس', many: 'فلسًا', gender: 'm', per: 100 },
		en: { one: 'UAE dirham', many: 'UAE dirhams', subOne: 'fils', subMany: 'fils' }
	},
	{
		code: 'KWD',
		label: { ar: 'دينار كويتي', en: 'Kuwaiti dinar' },
		main: { one: 'دينار كويتي', two: 'ديناران كويتيان', few: 'دنانير كويتية', many: 'دينارًا كويتيًا', gender: 'm' },
		sub: { one: 'فلس', two: 'فلسان', few: 'فلوس', many: 'فلسًا', gender: 'm', per: 1000 },
		en: { one: 'Kuwaiti dinar', many: 'Kuwaiti dinars', subOne: 'fils', subMany: 'fils' }
	},
	{
		code: 'USD',
		label: { ar: 'دولار أمريكي', en: 'US dollar' },
		main: { one: 'دولار أمريكي', two: 'دولاران أمريكيان', few: 'دولارات أمريكية', many: 'دولارًا أمريكيًا', gender: 'm' },
		sub: { one: 'سنت', two: 'سنتان', few: 'سنتات', many: 'سنتًا', gender: 'm', per: 100 },
		en: { one: 'US dollar', many: 'US dollars', subOne: 'cent', subMany: 'cents' }
	},
	{
		code: 'EUR',
		label: { ar: 'يورو', en: 'Euro' },
		main: { one: 'يورو', two: 'يورو', few: 'يورو', many: 'يورو', gender: 'm' },
		sub: { one: 'سنت', two: 'سنتان', few: 'سنتات', many: 'سنتًا', gender: 'm', per: 100 },
		en: { one: 'euro', many: 'euros', subOne: 'cent', subMany: 'cents' }
	}
];

const UNITS_M = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
const UNITS_F = ['', 'واحدة', 'اثنتان', 'ثلاث', 'أربع', 'خمس', 'ست', 'سبع', 'ثماني', 'تسع'];
const TENS = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const HUNDREDS = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

/**
 * Units for a counted noun of gender `noun`. The tables are keyed by the NOUN's gender, so they
 * already hold the polarity: masculine noun → ثلاثة, feminine noun → ثلاث (1–2 simply agree).
 */
const unit = (d: number, noun: Gender) => (noun === 'm' ? UNITS_M : UNITS_F)[d];

/** 1–999 in words, for a counted noun of gender `g`. */
function below1000(n: number, g: Gender): string {
	const h = Math.floor(n / 100);
	const r = n % 100;
	const parts: string[] = [];
	if (h) parts.push(HUNDREDS[h]);
	if (r) {
		const t = Math.floor(r / 10);
		const u = r % 10;
		if (r === 10) parts.push(g === 'm' ? 'عشرة' : 'عشر');
		else if (r === 11) parts.push(g === 'm' ? 'أحد عشر' : 'إحدى عشرة');
		else if (r === 12) parts.push(g === 'm' ? 'اثنا عشر' : 'اثنتا عشرة');
		else if (r < 10) parts.push(unit(u, g));
		else if (r < 20) parts.push(`${unit(u, g)} ${g === 'm' ? 'عشر' : 'عشرة'}`);
		else parts.push(u ? `${unit(u, g)} و${TENS[t]}` : TENS[t]);
	}
	return parts.join(' و');
}

/** Which form of a noun follows the count n (last two digits decide). */
function form(n: number, noun: Noun): string {
	if (n === 1) return noun.one;
	if (n === 2) return noun.two;
	const r = n % 100;
	if (r >= 3 && r <= 10) return noun.few;
	if (r >= 11 && r <= 99) return noun.many;
	return noun.one;
}

const SCALES: Noun[] = [
	{ one: 'ألف', two: 'ألفان', few: 'آلاف', many: 'ألفًا', gender: 'm' },
	{ one: 'مليون', two: 'مليونان', few: 'ملايين', many: 'مليونًا', gender: 'm' },
	{ one: 'مليار', two: 'ملياران', few: 'مليارات', many: 'مليارًا', gender: 'm' }
];

/** A whole number in words, counting a noun of gender g. 1 and 2 are spelled out ("واحد"). */
export function numberToArabic(n: number, g: Gender = 'm'): string {
	if (!Number.isFinite(n) || n < 0 || n >= 1e12) throw new RangeError('out of range');
	n = Math.floor(n);
	if (n === 0) return 'صفر';
	const groups: string[] = [];
	const rest = n % 1000;
	let left = Math.floor(n / 1000);
	for (let s = 0; left > 0; s++, left = Math.floor(left / 1000)) {
		const c = left % 1000;
		if (!c) continue;
		const noun = SCALES[s];
		if (c === 1) groups.unshift(noun.one);
		else if (c === 2) groups.unshift(noun.two);
		else groups.unshift(`${below1000(c, noun.gender)} ${form(c, noun)}`);
	}
	if (rest) groups.push(below1000(rest, g));
	return groups.join(' و');
}

/** "1500.5", currency → "فقط ألف وخمسمائة جنيه مصري وخمسون قرشًا لا غير". */
export function tafqeet(amount: number, currency: Currency | null, { wrap = true } = {}): string {
	if (!Number.isFinite(amount) || amount < 0) throw new RangeError('out of range');
	const per = currency?.sub?.per ?? 100;
	const total = Math.round(amount * per);
	const whole = Math.floor(total / per);
	const fraction = total % per;

	const phrase = (n: number, noun: Noun | undefined) => {
		if (!noun) return numberToArabic(n);
		if (n === 1) return `${noun.one} ${noun.gender === 'm' ? 'واحد' : 'واحدة'}`;
		if (n === 2) return noun.two;
		return `${numberToArabic(n, noun.gender)} ${form(n, noun)}`;
	};

	const parts: string[] = [];
	if (whole || !fraction) parts.push(phrase(whole, currency?.main));
	if (fraction && currency?.sub) parts.push(phrase(fraction, currency.sub));
	else if (fraction) parts.push(`${numberToArabic(fraction)} من ${per === 1000 ? 'ألف' : 'مائة'}`);
	const text = parts.join(' و');
	return wrap ? `فقط ${text} لا غير` : text;
}

// --- English ---
const EN_ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const EN_SCALES = ['', 'thousand', 'million', 'billion'];

export function numberToEnglish(n: number): string {
	if (!Number.isFinite(n) || n < 0 || n >= 1e12) throw new RangeError('out of range');
	n = Math.floor(n);
	if (n === 0) return 'zero';
	const chunk = (c: number) => {
		const h = Math.floor(c / 100);
		const r = c % 100;
		const words = [];
		if (h) words.push(`${EN_ONES[h]} hundred`);
		if (r) words.push(r < 20 ? EN_ONES[r] : EN_TENS[Math.floor(r / 10)] + (r % 10 ? '-' + EN_ONES[r % 10] : ''));
		return words.join(' and ');
	};
	const out: string[] = [];
	for (let s = 0; n > 0; s++, n = Math.floor(n / 1000)) {
		const c = n % 1000;
		if (c) out.unshift(chunk(c) + (EN_SCALES[s] ? ' ' + EN_SCALES[s] : ''));
	}
	return out.join(' ');
}

export function tafqeetEnglish(amount: number, currency: Currency | null): string {
	const per = currency?.sub?.per ?? 100;
	const total = Math.round(amount * per);
	const whole = Math.floor(total / per);
	const fraction = total % per;
	const main = currency ? ` ${whole === 1 ? currency.en.one : currency.en.many}` : '';
	let text = numberToEnglish(whole) + main;
	if (fraction) {
		const sub = currency?.en.subOne ? ` ${fraction === 1 ? currency.en.subOne : currency.en.subMany}` : `/${per}`;
		text += currency?.en.subOne ? ` and ${numberToEnglish(fraction)}${sub}` : ` and ${fraction}${sub}`;
	}
	return text.charAt(0).toUpperCase() + text.slice(1) + ' only';
}
