import { ConvertError, type Adapter } from '../../registry/types';
import { withSuffix } from './lib';
import { openPdf, pageTexts } from './pdfjs';

/** PDF → plain text (UTF-8), one block per page. Scans have no text: that needs OCR. */
const adapter: Adapter = {
	async convert(input) {
		const doc = await openPdf(input);
		const pages = await pageTexts(doc);
		await doc.loadingTask.destroy();
		if (!pages.some(Boolean)) throw new ConvertError('nothing');
		const text = pages.map((t, i) => `--- ${i + 1} ---\n${t}`).join('\n\n') + '\n';
		return [
			{
				name: withSuffix(input.name, '', 'txt'),
				type: 'text/plain;charset=utf-8',
				bytes: new TextEncoder().encode(text)
			}
		];
	}
};

export default adapter;
