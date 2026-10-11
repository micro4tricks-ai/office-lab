import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { packDocument } from '../../src/lib/markdown/pack';
import { serverTools } from '../../src/lib/registry/server-tools';
import { fileNameOf } from '../../src/lib/remote';

const SERVER = join(__dirname, '../../../server/app/tools');

/** Tool ids and option names declared in server/app/tools/*.py. */
function serverRegistry() {
	const tools = new Map<string, Set<string>>();
	for (const f of readdirSync(SERVER).filter((n) => n.endsWith('.py'))) {
		const src = readFileSync(join(SERVER, f), 'utf-8');
		for (const m of src.matchAll(/register\(ServerTool\("([a-z0-9-]+)"([\s\S]*?)\)\)\n/g)) {
			const opts = new Set([...m[2].matchAll(/"([a-z_]+)": (?:Opt|ebook_to|landscape|pdfa|paper)\b/g)].map((x) => x[1]));
			tools.set(m[1], opts);
		}
	}
	return tools;
}

describe('server tools', () => {
	it('match the server registry one to one (ids and option names)', () => {
		const server = serverRegistry();
		expect([...server.keys()].sort()).toEqual(serverTools.map((t) => t.id).sort());
		for (const t of serverTools) {
			const web = new Set((t.options ?? []).map((o) => o.id));
			expect([...web].sort(), t.id).toEqual([...server.get(t.id)!].sort());
		}
	});

	it('are marked server, load through the API and accept files or a URL', () => {
		for (const t of serverTools) {
			expect(t.runtime).toBe('server');
			expect(t.load).toBeTypeOf('function');
			expect(t.from.length > 0 || t.widget === 'web-capture', t.id).toBe(true);
		}
	});

	it('reads the download name the API sends', () => {
		expect(fileNameOf(`attachment; filename*=utf-8''%D8%AA%D9%82%D8%B1%D9%8A%D8%B1.pdf`, 'x')).toBe('تقرير.pdf');
		expect(fileNameOf('attachment; filename="report.pdf"', 'x')).toBe('report.pdf');
		expect(fileNameOf(null, 'result')).toBe('result');
		expect(fileNameOf(`attachment; filename*=utf-8''%E0%A4%A`, 'x')).toBe('x');
	});
});

describe('packDocument (Markdown → server PDF)', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('sends same-site WOFF2 fonts and scripts along, by bare name', async () => {
		const fetched: string[] = [];
		vi.stubGlobal('fetch', async (u: string) => {
			fetched.push(u);
			return new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'font/woff2' } });
		});
		const html =
			'<style>@font-face{src:url(https://site.test/_app/a/cairo-arabic.woff2) format("woff2")}' +
			'@font-face{src:url(/_app/KaTeX_Main.woff2),url(/_app/KaTeX_Main.woff)}' +
			'@font-face{src:url(https://fonts.example.com/x.woff2)}.x{background:url(data:image/png;base64,AA)}</style>' +
			'<script src="https://site.test/office-lab/pagedjs/paged.polyfill.min.js"></script>';
		const { index, assets } = await packDocument(html, 'https://site.test/office-lab/ar/markdown-to-pdf/');
		const out = new TextDecoder().decode(index.bytes);
		expect(assets.map((a) => a.name).sort()).toEqual(['cairo-arabic.woff2', 'paged_polyfill_min.js']);
		expect(out).toContain('url(cairo-arabic.woff2)');
		expect(out).toContain('<script src="paged_polyfill_min.js"');
		expect(out).toContain('url(https://fonts.example.com/x.woff2)'); // other sites: untouched, never fetched
		expect(out).toContain('url(/_app/KaTeX_Main.woff2)'); // no math in the document: KaTeX fonts not sent
		expect(fetched).toHaveLength(2);
		for (const a of assets) expect(a.name).toMatch(/^[A-Za-z0-9._-]{1,100}$/);
	});

	it('includes KaTeX fonts when the document has math', async () => {
		vi.stubGlobal('fetch', async () => new Response(new Uint8Array([1])));
		const { assets } = await packDocument(
			'<span class="katex"></span><style>@font-face{src:url(/_app/KaTeX_Main.woff2)}</style>',
			'https://site.test/'
		);
		expect(assets.map((a) => a.name)).toEqual(['KaTeX_Main.woff2']);
	});
});
