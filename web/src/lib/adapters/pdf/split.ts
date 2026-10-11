import { ConvertError, type Adapter, type FileData } from '../../registry/types';
import { loadPdf, pdfOut, pickPages, requirePages, savePdf, withSuffix } from './lib';
import { chunks, parseGroups } from './pages';

/** One PDF → several: by ranges ("1-3, 4-6"), every N pages, or one file per page. */
const adapter: Adapter = {
	async convert(input, options, progress) {
		const src = await loadPdf(input);
		const count = src.getPageCount();
		let groups: number[][];
		const mode = String(options.mode ?? 'ranges');
		if (mode === 'every') groups = chunks(count, Number(options.every) || 1);
		else if (mode === 'each') groups = chunks(count, 1);
		else {
			try {
				groups = parseGroups(String(options.ranges ?? ''), count);
			} catch {
				throw new ConvertError('pages');
			}
		}
		if (!groups.length) throw new ConvertError('pages');
		const out: FileData[] = [];
		for (const [i, g] of groups.entries()) {
			requirePages(g, count);
			const label = g.length === 1 ? `-p${g[0] + 1}` : `-p${g[0] + 1}-${g[g.length - 1] + 1}`;
			out.push(pdfOut(withSuffix(input.name, label), await savePdf(await pickPages(src, g))));
			progress?.((i + 1) / groups.length);
		}
		return out;
	}
};

export default adapter;
