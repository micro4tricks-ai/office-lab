import { ConvertError, type Adapter } from '../../registry/types';
import { loadPdf, pdfLib, pdfOut, savePdf } from './lib';

/** Protect (AES-256 password) or unlock (with the known password); params.action picks which. */
const adapter: Adapter = {
	async convert(input, options) {
		const password = String(options.password ?? '');
		if (options.action === 'unlock') {
			// pdf-lib re-encrypts a decrypted document on save, so copy its pages into a fresh one.
			const src = await loadPdf(input, password);
			const { PDFDocument } = await pdfLib();
			const doc = await PDFDocument.create();
			for (const p of await doc.copyPages(src, src.getPageIndices())) doc.addPage(p);
			const title = src.getTitle();
			const author = src.getAuthor();
			if (title) doc.setTitle(title);
			if (author) doc.setAuthor(author);
			return [pdfOut(input.name, await savePdf(doc))];
		}
		if (password.length < 1) throw new ConvertError('password');
		const doc = await loadPdf(input);
		doc.encrypt({
			userPassword: password,
			ownerPassword: password + ':owner:' + crypto.randomUUID(),
			permissions: {
				printing: options.allowPrint === false ? undefined : 'highResolution',
				copying: options.allowCopy !== false,
				modifying: false,
				annotating: false,
				fillingForms: true,
				contentAccessibility: true,
				documentAssembly: false
			}
		});
		return [pdfOut(input.name, await savePdf(doc))];
	}
};

export default adapter;
