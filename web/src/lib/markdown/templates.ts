/** Page templates for Markdown → PDF. Pure CSS strings: Paged.js reads the @page rules. */

export type Template = 'simple' | 'report' | 'cv' | 'letter';
export type FontKey = 'cairo' | 'amiri' | 'naskh';

export const FONT_STACKS: Record<FontKey, string> = {
	cairo: '"Cairo Variable", "Cairo", system-ui, sans-serif',
	amiri: '"Amiri", "Times New Roman", serif',
	naskh: '"Noto Naskh Arabic", "Amiri", serif'
};

export type PageOptions = {
	template: Template;
	font: FontKey;
	paper: 'A4' | 'Letter';
	toc: boolean;
	pageNumbers: boolean;
	arabicDigits: boolean;
	header: string;
	footer: string;
	accent: string;
};

/** CSS string literal for `content:` (quotes and backslashes escaped, newlines dropped). */
const cssString = (s: string) => `"${s.replace(/[\\"]/g, '\\$&').replace(/[\r\n]+/g, ' ')}"`;

const BASE = (o: PageOptions) => `
:root { --accent: ${/^#[0-9a-f]{3,8}$/i.test(o.accent) ? o.accent : '#0f6e66'}; }
html { font-family: ${FONT_STACKS[o.font]}; font-size: 11.5pt; line-height: 1.75; color: #1d2321; }
body { margin: 0; }
h1, h2, h3, h4 { line-height: 1.35; break-after: avoid; color: #111; }
h1 { font-size: 2em; margin: 0 0 .6em; }
h2 { font-size: 1.45em; margin: 1.4em 0 .5em; }
h3 { font-size: 1.15em; margin: 1.2em 0 .4em; }
p, li { orphans: 3; widows: 3; text-align: start; }
a { color: var(--accent); text-decoration: none; }
img, svg { max-width: 100%; }
table { border-collapse: collapse; width: 100%; margin: 1em 0; break-inside: avoid; font-size: .95em; }
th, td { border: 1px solid #cfcac0; padding: .35em .6em; text-align: start; vertical-align: top; }
th { background: color-mix(in srgb, var(--accent) 12%, white); }
blockquote { margin: 1em 0; padding: .3em 1em; border-inline-start: 4px solid var(--accent); background: #f6f5f1; }
pre.hljs { padding: .8em 1em; border-radius: 6px; overflow-x: auto; font-size: .85em; break-inside: avoid; direction: ltr; text-align: left; }
code { font-family: Consolas, "Cascadia Mono", monospace; font-size: .92em; }
:not(pre) > code { background: #efede7; padding: .1em .35em; border-radius: 4px; }
.math { margin: 1em 0; text-align: center; overflow-x: auto; }
.math-inline { unicode-bidi: isolate; }
.mermaid { text-align: center; margin: 1em 0; break-inside: avoid; }
hr { border: 0; border-top: 1px solid #cfcac0; margin: 2em 0; }
.toc { break-after: page; }
.toc h2 { margin-top: 0; }
.toc ol { list-style: none; padding: 0; }
.toc li { margin: .25em 0; }
.toc .toc-2 { padding-inline-start: 1.2em; }
.toc .toc-3 { padding-inline-start: 2.4em; font-size: .95em; }
.toc a { color: inherit; }
`;

const numbers = (o: PageOptions) => {
	const style = o.arabicDigits ? ', arabic-indic' : '';
	return o.pageNumbers ? `@bottom-center { content: counter(page${style}) " / " counter(pages${style}); font-size: 9pt; color: #777; }` : '';
};
const margins = (o: PageOptions) =>
	[
		o.header ? `@top-center { content: ${cssString(o.header)}; font-size: 9pt; color: #777; }` : '',
		o.footer ? `@bottom-left { content: ${cssString(o.footer)}; font-size: 8.5pt; color: #999; }` : '',
		numbers(o)
	].join('\n');

const TEMPLATES: Record<Template, (o: PageOptions) => string> = {
	simple: (o) => `@page { size: ${o.paper}; margin: 20mm 18mm 22mm; ${margins(o)} }`,

	report: (o) => `
@page { size: ${o.paper}; margin: 22mm 20mm 24mm; ${margins(o)} }
@page cover { margin: 0; @top-center { content: none } @bottom-center { content: none } @bottom-left { content: none } }
.cover { page: cover; height: 297mm; display: flex; flex-direction: column; justify-content: center; padding: 0 25mm;
  background: linear-gradient(160deg, var(--accent), color-mix(in srgb, var(--accent) 60%, black)); color: #fff; break-after: page; }
.cover h1 { color: #fff; font-size: 2.8em; border: 0; }
.cover .date { opacity: .85; font-size: 1.1em; }
h1 { break-before: page; border-bottom: 3px solid var(--accent); padding-bottom: .2em; }
.cover + .toc + h1, .cover + h1, body > h1:first-child { break-before: auto; }
h2 { color: var(--accent); }
`,

	cv: (o) => `
@page { size: ${o.paper}; margin: 16mm 16mm 18mm; ${margins(o)} }
html { font-size: 10.5pt; line-height: 1.6; }
h1 { font-size: 2.3em; margin-bottom: .1em; color: var(--accent); }
h1 + p { font-size: 1.1em; color: #555; margin-top: 0; padding-bottom: .6em; border-bottom: 2px solid var(--accent); }
h2 { font-size: 1.2em; margin: 1.1em 0 .4em; padding-bottom: .15em; border-bottom: 1px solid #ddd; color: var(--accent); }
h3 { font-size: 1.02em; margin: .8em 0 .1em; }
ul { padding-inline-start: 1.2em; margin: .3em 0; }
`,

	letter: (o) => `
@page { size: ${o.paper}; margin: 38mm 22mm 30mm;
  @top-center { content: ${cssString(o.header || ' ')}; font-size: 15pt; font-weight: 700; color: var(--accent);
    border-bottom: 2px solid var(--accent); vertical-align: bottom; padding-bottom: 4mm; }
  ${o.footer ? `@bottom-center { content: ${cssString(o.footer)}; font-size: 8.5pt; color: #777; border-top: 1px solid #ddd; padding-top: 2mm; }` : ''}
  ${o.pageNumbers ? `@bottom-right { content: counter(page${o.arabicDigits ? ', arabic-indic' : ''}); font-size: 8.5pt; color: #999; }` : ''}
}
h1 { font-size: 1.3em; text-align: center; text-decoration: underline; text-underline-offset: .3em; margin: 1.2em 0; }
p { text-align: justify; }
.letter-date { text-align: end; color: #555; margin-bottom: 1.5em; }
`
};

export function pageCss(o: PageOptions): string {
	return BASE(o) + TEMPLATES[o.template](o);
}

/** Template-specific front matter added before the content (cover page, letter date). */
export function frontMatter(o: PageOptions, title: string, lang: 'ar' | 'en'): string {
	const date = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'long' }).format(new Date());
	const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
	if (o.template === 'report' && title) return `<section class="cover" dir="auto"><h1>${esc(title)}</h1><p class="date">${date}</p></section>`;
	if (o.template === 'letter') return `<p class="letter-date" dir="auto">${date}</p>`;
	return '';
}
