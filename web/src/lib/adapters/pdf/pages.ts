/**
 * Page-range text → 0-based page indexes, in the order written.
 * "1-3, 5, 8-" → [0,1,2,4,7,8,…]; "-2" = first two; "last" / "end" = last page; "3-1" counts down.
 * A range end past the last page is clamped ("8-20" on 10 pages); a single page or
 * range start past it, or anything unreadable, throws.
 */
export function parsePages(spec: string, count: number): number[] {
	const text = spec.trim().toLowerCase().replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
	if (!text || text === 'all' || text === '*') return Array.from({ length: count }, (_, i) => i);
	const num = (s: string, empty: number, clamp = false) => {
		const t = s.trim();
		if (!t) return empty;
		if (t === 'last' || t === 'end') return count;
		const n = Number(t);
		if (!Number.isInteger(n) || n < 1) throw new Error(`bad page "${s}"`);
		if (n > count && !clamp) throw new Error(`page ${n} > ${count}`);
		return Math.min(n, count);
	};
	const out: number[] = [];
	for (const part of text.split(/[,،;\s]+/).filter(Boolean)) {
		const [a, b] = part.split(/[-–—]/);
		if (b === undefined) {
			out.push(num(a, 1) - 1);
			continue;
		}
		const from = num(a, 1);
		const to = num(b, count, true);
		const step = from <= to ? 1 : -1;
		for (let p = from; p !== to + step; p += step) out.push(p - 1);
	}
	return out;
}

/** Groups for splitting: "1-3, 4-6" → [[0,1,2],[3,4,5]]. */
export const parseGroups = (spec: string, count: number) =>
	spec
		.split(/[,،;]+/)
		.map((g) => g.trim())
		.filter(Boolean)
		.map((g) => parsePages(g, count));

/** Every `n` pages: count=7, n=3 → [[0,1,2],[3,4,5],[6]]. */
export function chunks(count: number, n: number): number[][] {
	const size = Math.max(1, Math.floor(n));
	const out: number[][] = [];
	for (let i = 0; i < count; i += size) out.push(Array.from({ length: Math.min(size, count - i) }, (_, k) => i + k));
	return out;
}

/** 1 → "١" when Arabic-Indic digits are wanted. */
export const digits = (n: number | string, arabic: boolean) =>
	arabic ? String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d]) : String(n);
