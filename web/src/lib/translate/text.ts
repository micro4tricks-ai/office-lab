/** Text helpers for translation (pure functions: unit-tested). */

/** Sentences of a paragraph, each short enough for the model; empty input → []. */
export function splitSentences(text: string, max = 400): string[] {
	const t = text.trim();
	if (!t) return [];
	const parts = t.split(/(?<=[.!?؟؛…])\s+|\n+/).filter((s) => s.trim());
	const out: string[] = [];
	for (const p of parts) {
		if (p.length <= max) out.push(p.trim());
		else for (let i = 0; i < p.length; i += max) out.push(p.slice(i, i + max).trim()); // very long run-ons
	}
	return out;
}

/** Currency codes the small model gets wrong ("EGP" → "pounds sterling"): spell them out first. */
const CURRENCY_EN: Record<string, string> = {
	EGP: 'Egyptian pounds',
	SAR: 'Saudi riyals',
	AED: 'UAE dirhams',
	KWD: 'Kuwaiti dinars',
	QAR: 'Qatari riyals',
	USD: 'US dollars',
	EUR: 'euros'
};
export function preEdit(s: string, pair: string): string {
	if (pair !== 'en-ar') return s;
	return s.replace(/\b(EGP|SAR|AED|KWD|QAR|USD|EUR)\b/g, (c) => CURRENCY_EN[c]);
}

/**
 * The en→ar model writes "4,750" as "750 4" (groups reversed). Put every number of the source back
 * as it was written when its groups show up reversed in the translation.
 */
export function fixNumbers(source: string, translated: string): string {
	let out = translated;
	for (const n of source.match(/\d{1,3}(?:,\d{3})+(?:\.\d+)?/g) ?? []) {
		const [int, dec] = n.split('.');
		const groups = int.split(',');
		const reversed = [...groups].reverse().join(' ') + (dec ? `.${dec}` : '');
		const loose = [...groups].reverse().join('[ ,٬]') + (dec ? `[.٫]${dec}` : '');
		if (out.includes(reversed) || new RegExp(loose).test(out)) out = out.replace(new RegExp(loose), n);
	}
	return out;
}

/** Worth sending to a translator: has letters (not only numbers, symbols, a code or a URL). */
export function translatable(s: string): boolean {
	const t = s.trim();
	if (!t || /^https?:\/\/\S+$/.test(t) || /^[\w.+-]+@[\w-]+\.[\w.]+$/.test(t)) return false;
	return /\p{L}{2,}/u.test(t);
}
