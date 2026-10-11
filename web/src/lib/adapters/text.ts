import { ConvertError, type Adapter } from '../registry/types';

const escape = (s: string) =>
	s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Plain text → standalone HTML page. Placeholder engine for Phase 0. */
const adapter: Adapter = {
	async convert(input, options) {
		let text: string;
		try {
			text = new TextDecoder('utf-8', { fatal: true }).decode(input.bytes);
		} catch {
			throw new ConvertError('corrupted');
		}
		const dir = String(options.dir ?? 'auto');
		const title = escape(input.name.replace(/\.[^.]+$/, ''));
		const body = text
			.split(/\r?\n\s*\r?\n/)
			.map((p) => `<p dir="auto">${escape(p).replace(/\r?\n/g, '<br>')}</p>`)
			.join('\n');
		const html = `<!doctype html>
<html dir="${dir}"><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:system-ui,"Segoe UI",Tahoma,sans-serif;max-width:46rem;margin:2rem auto;padding:0 1rem;line-height:1.8}</style>
</head><body>
${body}
</body></html>
`;
		return [
			{
				name: input.name.replace(/\.[^.]+$/, '') + '.html',
				type: 'text/html',
				bytes: new TextEncoder().encode(html)
			}
		];
	}
};

export default adapter;
