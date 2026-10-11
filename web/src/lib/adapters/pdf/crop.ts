import type { Adapter } from '../../registry/types';
import { loadPdf, pdfOut, savePdf } from './lib';

const MM = 72 / 25.4;

/** Trims page margins (in mm) by setting each page's crop box; content outside is hidden, not deleted. */
const adapter: Adapter = {
	async convert(input, options) {
		const doc = await loadPdf(input);
		const [t, r, b, l] = ['top', 'right', 'bottom', 'left'].map((k) => Math.max(0, Number(options[k]) || 0) * MM);
		for (const page of doc.getPages()) {
			const box = page.getCropBox();
			const w = Math.max(1, box.width - l - r);
			const h = Math.max(1, box.height - t - b);
			page.setCropBox(box.x + l, box.y + b, w, h);
		}
		return [pdfOut(input.name, await savePdf(doc))];
	}
};

export default adapter;
