import { ConvertError, type Adapter, type FileData } from '../../registry/types';
import { decodeImage } from '../image/decode';
import { encodePng } from '../image/encode';
import { textToPng } from '../text-image';
import { loadPdf, pdfOut, requirePages, savePdf } from './lib';
import { parsePages } from './pages';
import { stamp, visualSize } from './place';

/** Text (any language) or an image across pages: centred or tiled, with opacity and angle. */
const adapter: Adapter = {
	async convert(input, options, progress) {
		const doc = await loadPdf(input);
		const count = doc.getPageCount();
		let list: number[];
		try {
			list = String(options.pages ?? '').trim() ? parsePages(String(options.pages), count) : doc.getPageIndices();
		} catch {
			throw new ConvertError('pages');
		}
		requirePages(list, count);

		let png: Uint8Array;
		if (options.kind === 'image') {
			const logo = options.logo as FileData | null;
			if (!logo) throw new ConvertError('wrong-type', 'image missing');
			png = await encodePng((await decodeImage(logo)).image, false);
		} else {
			png = (await textToPng(String(options.text || '©'), { px: 200, color: String(options.color || '#c0392b') })).png;
		}
		const img = await doc.embedPng(png);
		const ratio = img.height / img.width;
		const angle = Number(options.angle) || 0;
		const opacity = Math.max(5, Math.min(100, Number(options.opacity) || 30)) / 100;
		const sizePct = Math.max(5, Math.min(100, Number(options.size) || 50)) / 100;

		for (const [k, i] of list.entries()) {
			const page = doc.getPage(i);
			const { w: W, h: H } = visualSize(page);
			const w = W * sizePct;
			const h = w * ratio;
			if (options.position === 'tile') {
				const stepX = w * 1.6;
				const stepY = Math.max(h * 3, H / 6);
				for (let y = stepY / 2, row = 0; y < H + stepY / 2; y += stepY, row++)
					for (let x = row % 2 ? stepX / 2 : 0; x < W + stepX / 2; x += stepX) stamp(page, img, { cx: x, cy: y, w, h, angle, opacity });
			} else stamp(page, img, { cx: W / 2, cy: H / 2, w, h, angle, opacity });
			progress?.((k + 1) / list.length);
		}
		return [pdfOut(input.name, await savePdf(doc))];
	}
};

export default adapter;
