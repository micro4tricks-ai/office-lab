import { ConvertError, type Adapter, type Placement } from '../../registry/types';
import { loadPdf, pdfOut, savePdf } from './lib';
import { stamp, visualSize } from './place';

/** Draws the editor's placements (signatures, text, images — all PNG) onto their pages. */
const adapter: Adapter = {
	async convert(input, options) {
		const items = (options.items ?? []) as Placement[];
		if (!items.length) throw new ConvertError('nothing');
		const doc = await loadPdf(input);
		const pages = doc.getPages();
		const cache = new Map<Uint8Array, Awaited<ReturnType<typeof doc.embedPng>>>();
		for (const item of items) {
			let img = cache.get(item.png.bytes);
			if (!img) {
				img = await doc.embedPng(item.png.bytes);
				cache.set(item.png.bytes, img);
			}
			const targets = item.page === -1 ? pages : [pages[item.page]].filter(Boolean);
			for (const page of targets) {
				const { w: W, h: H } = visualSize(page);
				stamp(page, img, {
					cx: (item.x + item.w / 2) * W,
					cy: H - (item.y + item.h / 2) * H, // editor y runs down from the top
					w: item.w * W,
					h: item.h * H
				});
			}
		}
		return [pdfOut(input.name, await savePdf(doc))];
	}
};

export default adapter;
