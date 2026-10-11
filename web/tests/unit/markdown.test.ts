import mammoth from 'mammoth';
import { describe, expect, it } from 'vitest';
import markdown from '../../src/lib/adapters/doc/markdown';
import { renderMarkdown, tocHtml } from '../../src/lib/markdown/render';
import type { FileData } from '../../src/lib/registry/types';

const md = (src: string, name = 'note.md'): FileData => ({ name, type: 'text/markdown', bytes: new TextEncoder().encode(src) });

describe('renderMarkdown', () => {
	it('gives every block its own direction and headings unique ids (Arabic too)', async () => {
		const r = await renderMarkdown('# مقدمة البحث\n\nفقرة\n\n## Results\n\n## Results\n\n- بند');
		expect(r.html).toContain('<h1 dir="auto" id="مقدمة-البحث">');
		expect(r.html).toContain('<p dir="auto">فقرة</p>');
		expect(r.html).toContain('<li dir="auto">');
		expect(r.headings.map((h) => h.id)).toEqual(['مقدمة-البحث', 'results', 'results-1']);
		expect(r.title).toBe('مقدمة البحث');
		expect(tocHtml(r.headings, 'المحتويات')).toContain('<a href="#results-1">Results</a>');
	});

	it('math via KaTeX, isolated left-to-right inline; diagrams left for the page', async () => {
		const r = await renderMarkdown('القدرة $P = V \\times I$\n\n$$E = mc^2$$\n\n```mermaid\nflowchart LR\n A-->B\n```');
		expect(r.html).toContain('<span class="math-inline" dir="ltr"><span class="katex">');
		expect(r.html).toContain('<div class="math" dir="ltr"><span class="katex-display">');
		expect(r.html).toContain('<div class="mermaid" dir="ltr">flowchart LR\n A--&gt;B\n</div>');
	});

	it('raw HTML in a document is shown, never run', async () => {
		const r = await renderMarkdown('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>');
		expect(r.html).not.toContain('<script>');
		expect(r.html).not.toContain('<img');
		expect(r.html).toContain('&lt;script&gt;');
	});

	it('highlights code with a known language, escapes the rest', async () => {
		const r = await renderMarkdown('```js\nconst a = 1;\n```\n\n```\n<b>x</b>\n```');
		expect(r.html).toContain('<span class="hljs-keyword">const</span>');
		expect(r.html).toContain('&lt;b&gt;x&lt;/b&gt;');
	});
});

describe('Markdown → HTML / Word', () => {
	it('HTML: a full page, right-to-left for Arabic, contents when asked', async () => {
		const [html] = await markdown.convert(md('# عنوان\n\n## قسم\n\nنص'), { to: 'html', toc: true, lang: 'ar' });
		const t = new TextDecoder().decode(html.bytes);
		expect(html.name).toBe('note.html');
		expect(t).toContain('<html lang="ar" dir="rtl">');
		expect(t).toContain('<nav class="toc" dir="auto"><h2>المحتويات</h2>');
		expect(t).toContain('@font-face');
	});

	it('Word: headings, bold, lists, tables, code — readable back', async () => {
		const src = '# تقرير\n\nنص **مهم** هنا\n\n- أول\n- ثاني\n\n1. one\n2. two\n\n| البند | الحالة |\n| --- | --- |\n| فلتر | تم |\n\n```\ncode line\n```';
		const [docx] = await markdown.convert(md(src, 'r.md'), { to: 'docx' });
		expect(docx.name).toBe('r.docx');
		const html = (await mammoth.convertToHtml({ buffer: Buffer.from(docx.bytes) })).value;
		expect(html).toContain('<h1>تقرير</h1>');
		expect(html).toContain('<strong>مهم</strong>');
		expect(html).toContain('<li>أول</li>');
		expect(html).toContain('<li>one</li>');
		expect(html).toContain('<thead><tr><th><p><strong>البند</strong></p></th>');
		expect(html).toContain('<tbody><tr><td><p>فلتر</p></td>');
		expect(html).toContain('code line');
	});
});
