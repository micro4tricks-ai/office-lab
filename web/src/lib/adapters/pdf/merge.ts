import type { Adapter } from '../../registry/types';
import { loadPdf, pdfLib, pdfOut, savePdf, withSuffix } from './lib';

/** Several PDFs → one, in the order given. */
const adapter: Adapter = {
	async convert(input) {
		return [input];
	},
	async combine(inputs, _options, progress) {
		const { PDFDocument } = await pdfLib();
		const out = await PDFDocument.create();
		for (const [i, file] of inputs.entries()) {
			const src = await loadPdf(file);
			const pages = await out.copyPages(src, src.getPageIndices());
			for (const p of pages) out.addPage(p);
			progress?.((i + 1) / (inputs.length + 1));
		}
		return [pdfOut(inputs.length === 1 ? inputs[0].name : withSuffix(inputs[0].name, '-merged'), await savePdf(out))];
	}
};

export default adapter;
