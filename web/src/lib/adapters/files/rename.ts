import type { Adapter, FileData } from '../../registry/types';

/**
 * New names from a pattern: {name} original name, {n} counter, {ext} extension, {date} today.
 * "invoice-{n}" with start 1 and 3 digits → invoice-001.pdf, invoice-002.pdf, …
 */
export function newNames(names: string[], o: { pattern: string; start: number; digits: number; find?: string; replace?: string; date?: string }) {
	const date = o.date ?? new Date().toISOString().slice(0, 10);
	const used = new Set<string>();
	return names.map((original, i) => {
		const dot = original.lastIndexOf('.');
		const base = dot > 0 ? original.slice(0, dot) : original;
		const ext = dot > 0 ? original.slice(dot + 1) : '';
		const n = String(o.start + i).padStart(Math.max(1, o.digits), '0');
		let stem = (o.pattern || '{name}')
			.replace(/\{name\}/g, base)
			.replace(/\{n\}/g, n)
			.replace(/\{date\}/g, date)
			.replace(/\{ext\}/g, ext);
		if (o.find) stem = stem.split(o.find).join(o.replace ?? '');
		stem = stem.replace(/[\\/:*?"<>|]+/g, '_').trim() || n;
		let name = ext ? `${stem}.${ext}` : stem;
		for (let k = 2; used.has(name.toLowerCase()); k++) name = ext ? `${stem} (${k}).${ext}` : `${stem} (${k})`;
		used.add(name.toLowerCase());
		return name;
	});
}

/** Renames all files at once (download them one by one or as a ZIP). */
const adapter: Adapter = {
	async convert(input, options) {
		return adapter.combine!([input], options);
	},
	async combine(inputs, options) {
		const names = newNames(
			inputs.map((f) => f.name),
			{
				pattern: String(options.pattern ?? '{name}'),
				start: Number(options.start) || 1,
				digits: Number(options.digits) || 1,
				find: String(options.find ?? ''),
				replace: String(options.replace ?? '')
			}
		);
		return inputs.map((f, i): FileData => ({ ...f, name: names[i] }));
	}
};

export default adapter;
