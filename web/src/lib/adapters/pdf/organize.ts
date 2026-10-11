import { degrees } from '@cantoo/pdf-lib';
import { ConvertError, type Adapter, type PagePlan } from '../../registry/types';
import { loadPdf, pdfLib, pdfOut, savePdf } from './lib';

/** Reorder, rotate and drop pages following the organizer's plan. */
const adapter: Adapter = {
	async convert(input, options) {
		const plan = (options.plan ?? []) as PagePlan[];
		const src = await loadPdf(input);
		const count = src.getPageCount();
		if (!plan.length || plan.some((p) => p.src < 0 || p.src >= count)) throw new ConvertError('pages');
		const { PDFDocument } = await pdfLib();
		const out = await PDFDocument.create();
		const pages = await out.copyPages(src, plan.map((p) => p.src));
		pages.forEach((page, i) => {
			const extra = plan[i].rotate || 0;
			if (extra) page.setRotation(degrees((((page.getRotation().angle + extra) % 360) + 360) % 360));
			out.addPage(page);
		});
		return [pdfOut(input.name, await savePdf(out))];
	}
};

export default adapter;
