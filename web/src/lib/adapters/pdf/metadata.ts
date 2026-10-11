import type { Adapter } from '../../registry/types';
import { loadPdf, pdfOut, savePdf } from './lib';

/** Sets title/author/subject/keywords; empty fields stay as they are, or wipe everything. */
const adapter: Adapter = {
	async convert(input, options) {
		const doc = await loadPdf(input);
		if (options.clear === true) {
			for (const set of [doc.setTitle, doc.setAuthor, doc.setSubject, doc.setCreator]) set.call(doc, '');
			doc.setKeywords([]);
			doc.setProducer('');
			doc.setCreationDate(new Date(0));
			doc.setModificationDate(new Date(0));
			doc.catalog.delete((await import('@cantoo/pdf-lib')).PDFName.of('Metadata'));
			return [pdfOut(input.name, await doc.save({ useObjectStreams: true }))];
		}
		const text = (k: string) => String(options[k] ?? '').trim();
		if (text('title')) doc.setTitle(text('title'));
		if (text('author')) doc.setAuthor(text('author'));
		if (text('subject')) doc.setSubject(text('subject'));
		if (text('keywords')) doc.setKeywords(text('keywords').split(/[,،]\s*/));
		doc.setModificationDate(new Date());
		return [pdfOut(input.name, await savePdf(doc))];
	}
};

export default adapter;
