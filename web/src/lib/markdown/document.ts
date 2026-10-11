/**
 * Builds the full HTML document for the preview and for printing (main thread only:
 * it uses page URLs for self-hosted fonts and draws Mermaid diagrams with the DOM).
 */
import naskh400 from '@fontsource/noto-naskh-arabic/files/noto-naskh-arabic-arabic-400-normal.woff2?url';
import naskh700 from '@fontsource/noto-naskh-arabic/files/noto-naskh-arabic-arabic-700-normal.woff2?url';
import amiri400 from '@fontsource/amiri/files/amiri-arabic-400-normal.woff2?url';
import amiri700 from '@fontsource/amiri/files/amiri-arabic-700-normal.woff2?url';
import amiriLatin400 from '@fontsource/amiri/files/amiri-latin-400-normal.woff2?url';
import amiriLatin700 from '@fontsource/amiri/files/amiri-latin-700-normal.woff2?url';
import cairoArabic from '@fontsource-variable/cairo/files/cairo-arabic-wght-normal.woff2?url';
import cairoLatin from '@fontsource-variable/cairo/files/cairo-latin-wght-normal.woff2?url';
import hljsCss from 'highlight.js/styles/github.min.css?inline';
import katexCss from 'katex/dist/katex.min.css?inline';
import type { Rendered } from './render';
import { frontMatter, pageCss, type PageOptions } from './templates';
import { tocHtml } from './render';

const ARABIC = 'U+0600-06FF,U+0750-077F,U+0870-08FF,U+200C-200E,U+FB50-FDFF,U+FE70-FEFC';
const LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+2000-206F,U+20AC,U+2122';

/** Absolute URL in the page or worker (unit tests have no `location`: keep it as is). */
const abs = (u: string) => (typeof location === 'undefined' ? u : new URL(u, location.href).href);
const face = (family: string, url: string, weight: string, range: string) =>
	`@font-face{font-family:"${family}";src:url(${abs(url)}) format("woff2");font-weight:${weight};font-display:block;unicode-range:${range}}`;

/** @font-face rules for every font the templates offer, pointing at this site's own files. */
export function fontFaces(): string {
	return [
		face('Cairo Variable', cairoArabic, '200 1000', ARABIC),
		face('Cairo Variable', cairoLatin, '200 1000', LATIN),
		face('Amiri', amiri400, '400', ARABIC),
		face('Amiri', amiri700, '700', ARABIC),
		face('Amiri', amiriLatin400, '400', LATIN),
		face('Amiri', amiriLatin700, '700', LATIN),
		face('Noto Naskh Arabic', naskh400, '400', ARABIC),
		face('Noto Naskh Arabic', naskh700, '700', ARABIC)
	].join('\n');
}

const unescapeHtml = (s: string) =>
	s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');

/** Replaces ```mermaid blocks with SVG. Mermaid (large) is only loaded when a diagram exists. */
export async function drawDiagrams(html: string): Promise<string> {
	if (!html.includes('class="mermaid"')) return html;
	const mermaid = (await import('mermaid')).default;
	mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral', fontFamily: 'Cairo Variable, sans-serif' });
	const parts = html.split(/(<div class="mermaid" dir="ltr">[\s\S]*?<\/div>)/);
	let n = 0;
	for (let i = 1; i < parts.length; i += 2) {
		const code = unescapeHtml(parts[i].replace(/^<div class="mermaid" dir="ltr">|<\/div>$/g, ''));
		try {
			const { svg } = await mermaid.render(`mmd-${Date.now()}-${n++}`, code);
			parts[i] = `<div class="mermaid" dir="ltr">${svg}</div>`;
		} catch (e) {
			parts[i] = `<pre class="hljs" dir="ltr"><code>Mermaid: ${String(e instanceof Error ? e.message : e).replace(/</g, '&lt;')}</code></pre>`;
		}
	}
	return parts.join('');
}

export type Mode = 'screen' | 'preview' | 'print';

/**
 * screen  — live preview, no pagination.
 * preview — paginated by Paged.js, as it will print.
 * print   — paginated, then the print dialog opens ("Save as PDF").
 */
export function buildDocument(
	r: Rendered,
	o: PageOptions,
	mode: Mode,
	lang: 'ar' | 'en',
	tocLabel: string,
	/** URL of static/pagedjs/paged.polyfill.min.js (needed for preview/print). */
	pagedUrl = ''
): string {
	const rtl = /[؀-ۿ]/.test(r.html.replace(/<[^>]+>/g, '').slice(0, 2000));
	const front = frontMatter(o, r.title, lang);
	// The report cover shows the main title; don't repeat it on the next page.
	const body = o.template === 'report' && front ? r.html.replace(/<h1[^>]*>[\s\S]*?<\/h1>/, '') : r.html;
	// With a report cover, the main title lives on the cover, not in the contents.
	const listed = o.template === 'report' && front ? r.headings.filter((h, i) => !(h.level === 1 && i === r.headings.findIndex((x) => x.level === 1))) : r.headings;
	const toc = o.toc ? tocHtml(listed, tocLabel) : '';
	const paged = mode !== 'screen';
	const screenCss = paged
		? ''
		: `body{max-width:46rem;margin:0 auto;padding:24px 28px;background:#fff}.cover{height:auto;padding:40px 28px;border-radius:12px;margin-bottom:24px}.toc{border-bottom:1px dashed #ccc;margin-bottom:24px}`;
	const script = paged
		? `<script>window.PagedConfig={auto:true,after:function(){document.documentElement.dataset.paged='done';${
				mode === 'print' ? 'setTimeout(function(){window.print()},50);' : ''
			}}};</script><script src="${abs(pagedUrl)}"></script>`
		: '';
	return `<!doctype html>
<html lang="${rtl ? 'ar' : 'en'}" dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8">
<title>${(r.title || 'document').replace(/</g, '&lt;')}</title>
<style>${fontFaces()}\n${katexCss}\n${hljsCss}\n${pageCss(o)}\n${screenCss}</style>
${script}
</head><body>
${front}${toc}
${body}
</body></html>`;
}
