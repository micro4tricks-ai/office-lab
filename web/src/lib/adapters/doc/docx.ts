import { ConvertError, type Adapter, type FileData } from '../../registry/types';

const hasArabic = (s: string) => /[؀-ۿ]/.test(s);
const base = (name: string) => name.replace(/\.[^.]+$/, '');

type Image = { name: string; type: string; bytes: Uint8Array };

/** DOCX → HTML with mammoth; images either inline (data URIs) or collected as files. */
async function toHtml(input: FileData, inlineImages: boolean, folder: string) {
	const mammoth = (await import('mammoth')).default;
	const images: Image[] = [];
	const convertImage = inlineImages
		? undefined
		: mammoth.images.imgElement(async (img) => {
				const ext = (img.contentType.split('/')[1] ?? 'png').replace('jpeg', 'jpg');
				const name = `${folder}/image-${images.length + 1}.${ext}`;
				images.push({ name, type: img.contentType, bytes: new Uint8Array(await img.readAsArrayBuffer()) });
				return { src: name };
			});
	try {
		// The browser build reads `arrayBuffer`, the Node build (unit tests) reads `buffer`.
		const source = { arrayBuffer: input.bytes.slice().buffer, buffer: input.bytes } as { arrayBuffer: ArrayBuffer };
		const result = await mammoth.convertToHtml(source, convertImage ? { convertImage } : {});
		// Word keeps paragraph direction; mammoth drops it — let each block find its own.
		const html = result.value.replace(/<(p|h[1-6]|li|td|th|blockquote)(?=[\s>])/g, '<$1 dir="auto"');
		return { html, images };
	} catch (e) {
		throw new ConvertError('corrupted', e instanceof Error ? e.message : String(e));
	}
}

function page(body: string, title: string) {
	const rtl = hasArabic(body.replace(/<[^>]+>/g, ''));
	return `<!doctype html>
<html lang="${rtl ? 'ar' : 'en'}" dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title.replace(/</g, '&lt;')}</title>
<style>body{font-family:system-ui,"Segoe UI",Tahoma,sans-serif;max-width:48rem;margin:2rem auto;padding:0 1rem;line-height:1.8}
table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:.3rem .6rem}img{max-width:100%;height:auto}</style>
</head><body>
${body}
</body></html>
`;
}

/** Word (DOCX) → a standalone HTML page or Markdown (params.to). */
const adapter: Adapter = {
	async convert(input, options) {
		const to = String(options.to);
		const inline = options.images !== 'files';
		const folder = `${base(input.name)}-images`;
		const { html, images } = await toHtml(input, inline, folder);
		const enc = new TextEncoder();
		let doc: FileData;
		if (to === 'md') {
			const { default: TurndownService } = await import('turndown');
			// @ts-expect-error domino ships a non-module .d.ts; createDocument is all we use.
			const domino: { createDocument(html: string): Document } = await import('@mixmark-io/domino');
			// No DOMParser in a worker: hand turndown a DOM built by domino.
			const root = domino.createDocument(`<!doctype html><html><body>${html}</body></html>`).body;
			const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' });
			td.keep(['table', 'thead', 'tbody', 'tr', 'th', 'td']);
			doc = { name: base(input.name) + '.md', type: 'text/markdown', bytes: enc.encode(td.turndown(root as unknown as HTMLElement) + '\n') };
		} else {
			doc = { name: base(input.name) + '.html', type: 'text/html', bytes: enc.encode(page(html, base(input.name))) };
		}
		return [doc, ...images];
	}
};

export default adapter;
