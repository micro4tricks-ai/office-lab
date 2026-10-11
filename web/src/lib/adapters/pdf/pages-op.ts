import { degrees } from '@cantoo/pdf-lib';
import { ConvertError, type Adapter } from '../../registry/types';
import { loadPdf, pdfOut, pickPages, requirePages, savePdf } from './lib';
import { parsePages } from './pages';

function pick(spec: unknown, count: number) {
	try {
		const list = parsePages(String(spec ?? ''), count);
		requirePages(list, count);
		return list;
	} catch (e) {
		throw e instanceof ConvertError ? e : new ConvertError('pages');
	}
}

/** Page-level edits on one PDF: extract, delete, rotate (params.action picks which). */
const adapter: Adapter = {
	async convert(input, options) {
		const src = await loadPdf(input);
		const count = src.getPageCount();
		const action = String(options.action);
		if (action === 'extract') {
			return [pdfOut(input.name, await savePdf(await pickPages(src, pick(options.pages, count))))];
		}
		if (action === 'delete') {
			const drop = new Set(pick(options.pages, count));
			const keep = src.getPageIndices().filter((i) => !drop.has(i));
			if (!keep.length) throw new ConvertError('pages');
			return [pdfOut(input.name, await savePdf(await pickPages(src, keep)))];
		}
		if (action === 'rotate') {
			const by = Number(options.angle) || 90;
			const list = String(options.pages ?? '').trim() ? pick(options.pages, count) : src.getPageIndices();
			for (const i of new Set(list)) {
				const page = src.getPage(i);
				page.setRotation(degrees((page.getRotation().angle + by + 360) % 360));
			}
			return [pdfOut(input.name, await savePdf(src))];
		}
		throw new Error(`unknown action ${action}`);
	}
};

export default adapter;
