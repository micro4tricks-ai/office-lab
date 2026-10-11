import { ConvertError, type Adapter, type FileData } from '../../registry/types';
import { encodeImage } from '../image/encode';
import { parsePages } from './pages';
import { openPdf } from './pdfjs';
import { renderPage } from './render';

/**
 * Previews for the interactive editors: first a JSON file with every page's visual size
 * (points), then a JPEG per requested page, `width` pixels wide.
 */
const adapter: Adapter = {
	async convert(input, options, progress) {
		const doc = await openPdf(input);
		const sizes = [];
		for (let n = 1; n <= doc.numPages; n++) {
			const page = await doc.getPage(n);
			const v = page.getViewport({ scale: 1 });
			sizes.push({ w: v.width, h: v.height });
		}
		let list: number[];
		try {
			list = parsePages(String(options.pages ?? ''), doc.numPages);
		} catch {
			throw new ConvertError('pages');
		}
		const width = Math.max(40, Math.min(1600, Number(options.width) || 160));
		const out: FileData[] = [
			{ name: 'pages.json', type: 'application/json', bytes: new TextEncoder().encode(JSON.stringify(sizes)) }
		];
		for (const [k, i] of list.entries()) {
			const pixels = await renderPage(doc, i + 1, width / sizes[i].w);
			out.push({ name: `p${i + 1}.jpg`, type: 'image/jpeg', bytes: await encodeImage(pixels, 'jpg', 0.75) });
			progress?.((k + 1) / list.length);
		}
		await doc.loadingTask.destroy();
		return out;
	}
};

export default adapter;
