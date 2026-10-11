/**
 * Markdown → HTML without touching the DOM, so it runs in a worker or in the page.
 * Every block gets dir="auto" (Arabic and English paragraphs each find their own direction),
 * headings get ids for the table of contents, $math$ / $$math$$ go through KaTeX,
 * code is highlighted, and ```mermaid blocks are left for the page to draw.
 */
import type MarkdownIt from 'markdown-it';

export type Heading = { level: number; text: string; id: string };
export type Rendered = { html: string; headings: Heading[]; title: string };

type Libs = { MarkdownIt: typeof MarkdownIt; katex: typeof import('katex').default; hljs: typeof import('highlight.js').default };
let libs: Promise<Libs> | null = null;

function load(): Promise<Libs> {
	libs ??= Promise.all([import('markdown-it'), import('katex'), import('highlight.js/lib/common')]).then(([m, k, h]) => ({
		MarkdownIt: m.default,
		katex: k.default,
		hljs: h.default
	}));
	return libs;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** "مقدمة البحث" → "مقدمة-البحث"; Latin lowercased; unique within the document. */
function slugger() {
	const seen = new Map<string, number>();
	return (text: string) => {
		const base = text.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'section';
		const n = seen.get(base) ?? 0;
		seen.set(base, n + 1);
		return n ? `${base}-${n}` : base;
	};
}

/** $…$ inline and $$…$$ block math, rendered to HTML by KaTeX (bad TeX shows the error, not a crash). */
function mathPlugin(md: InstanceType<Libs['MarkdownIt']>, katex: Libs['katex']) {
	const tex = (src: string, display: boolean) => {
		try {
			return katex.renderToString(src, { displayMode: display, throwOnError: false, output: 'html', trust: false });
		} catch {
			return `<code>${esc(src)}</code>`;
		}
	};
	md.inline.ruler.after('escape', 'math_inline', (state, silent) => {
		const src = state.src;
		const start = state.pos;
		if (src[start] !== '$' || src[start + 1] === '$') return false;
		const end = src.indexOf('$', start + 1);
		if (end < 0 || end === start + 1 || /\s/.test(src[start + 1]) || /\s/.test(src[end - 1])) return false;
		if (!silent) {
			const token = state.push('math_inline', 'math', 0);
			token.content = src.slice(start + 1, end);
		}
		state.pos = end + 1;
		return true;
	});
	md.block.ruler.after('blockquote', 'math_block', (state, startLine, endLine, silent) => {
		const first = state.src.slice(state.bMarks[startLine] + state.tShift[startLine], state.eMarks[startLine]);
		if (!first.startsWith('$$')) return false;
		if (silent) return true;
		let content = first.slice(2);
		let line = startLine;
		if (!content.trimEnd().endsWith('$$') || content.trim() === '') {
			while (++line < endLine) {
				const text = state.src.slice(state.bMarks[line] + state.tShift[line], state.eMarks[line]);
				if (text.trimEnd().endsWith('$$')) {
					content += '\n' + text.trimEnd().slice(0, -2);
					break;
				}
				content += '\n' + text;
			}
		} else content = content.trimEnd().slice(0, -2);
		const token = state.push('math_block', 'math', 0);
		token.block = true;
		token.content = content.trim();
		state.line = line + 1;
		return true;
	});
	md.renderer.rules.math_inline = (tokens, i) => tex(tokens[i].content, false);
	md.renderer.rules.math_block = (tokens, i) => `<div class="math" dir="ltr">${tex(tokens[i].content, true)}</div>\n`;
}

export async function renderMarkdown(src: string): Promise<Rendered> {
	const { MarkdownIt, katex, hljs } = await load();
	const md = new MarkdownIt({
		html: false, // raw HTML in the source is shown as text: nothing in a document can run
		linkify: true,
		typographer: false,
		highlight(code, lang) {
			if (lang === 'mermaid') return `<div class="mermaid" dir="ltr">${esc(code)}</div>`;
			if (lang && hljs.getLanguage(lang)) {
				try {
					return `<pre class="hljs" dir="ltr"><code>${hljs.highlight(code, { language: lang, ignoreIllegals: true }).value}</code></pre>`;
				} catch {
					/* fall through */
				}
			}
			return `<pre class="hljs" dir="ltr"><code>${esc(code)}</code></pre>`;
		}
	});
	mathPlugin(md, katex);

	const slug = slugger();
	const headings: Heading[] = [];
	const env = {};
	const tokens = md.parse(src, env);
	for (let i = 0; i < tokens.length; i++) {
		const t = tokens[i];
		if (/^(paragraph|heading|bullet_list|ordered_list|list_item|blockquote|th|td)_open$/.test(t.type)) t.attrSet('dir', 'auto');
		if (t.type === 'heading_open') {
			const text = tokens[i + 1]?.children?.map((c) => c.content).join('') ?? '';
			const id = slug(text);
			t.attrSet('id', id);
			headings.push({ level: Number(t.tag.slice(1)), text, id });
		}
		if (t.type === 'table_open') t.attrSet('dir', 'auto');
	}
	const html = md.renderer.render(tokens, md.options, env);
	const title = headings.find((h) => h.level === 1)?.text ?? headings[0]?.text ?? '';
	return { html, headings, title };
}

/** Table of contents (h1–h3) as a nested list of links. */
export function tocHtml(headings: Heading[], label: string): string {
	const items = headings.filter((h) => h.level <= 3);
	if (!items.length) return '';
	return `<nav class="toc" dir="auto"><h2>${esc(label)}</h2><ol>${items
		.map((h) => `<li class="toc-${h.level}"><a href="#${esc(h.id)}">${esc(h.text)}</a></li>`)
		.join('')}</ol></nav>`;
}
