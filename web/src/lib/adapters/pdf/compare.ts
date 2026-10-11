import { diffWordsWithSpace } from 'diff';
import type { Adapter } from '../../registry/types';
import { openPdf, pageTexts } from './pdfjs';

const esc = (s: string) =>
	s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

const LABELS = {
	ar: { title: 'مقارنة ملفين PDF', page: 'صفحة', same: 'لا توجد اختلافات في النص.', pages: 'عدد الصفحات', added: 'مضاف', removed: 'محذوف', none: 'بدون تغييرات' },
	en: { title: 'PDF comparison', page: 'Page', same: 'No differences in the text.', pages: 'Pages', added: 'added', removed: 'removed', none: 'no changes' }
};

/** Two PDFs → an HTML report of text changes, page by page. */
const adapter: Adapter = {
	async convert(input) {
		return [input];
	},
	async combine(inputs, options, progress) {
		const [a, b] = inputs;
		const texts: string[][] = [];
		for (const f of [a, b]) {
			const doc = await openPdf(f);
			texts.push(await pageTexts(doc));
			await doc.loadingTask.destroy();
			progress?.(texts.length / 3);
		}
		const ar = options.uiLang === 'ar';
		const L = LABELS[ar ? 'ar' : 'en'];
		let changed = 0;
		const sections: string[] = [];
		const count = Math.max(texts[0].length, texts[1].length);
		for (let i = 0; i < count; i++) {
			const parts = diffWordsWithSpace(texts[0][i] ?? '', texts[1][i] ?? '');
			const diff = parts.some((p) => p.added || p.removed);
			if (diff) changed++;
			const body = parts
				.map((p) => (p.added ? `<ins>${esc(p.value)}</ins>` : p.removed ? `<del>${esc(p.value)}</del>` : esc(p.value)))
				.join('');
			sections.push(
				diff
					? `<section class="diff"><h2>${L.page} ${i + 1}</h2><div dir="auto">${body}</div></section>`
					: `<section class="same"><h2>${L.page} ${i + 1} — ${L.none}</h2></section>`
			);
		}
		const html = `<!doctype html>
<html lang="${ar ? 'ar' : 'en'}" dir="${ar ? 'rtl' : 'ltr'}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${L.title}</title>
<style>
body{font-family:system-ui,"Segoe UI",Tahoma,sans-serif;max-width:60rem;margin:2rem auto;padding:0 1rem;line-height:1.9;color:#1d2321}
header{border-bottom:2px solid #0f6e66;margin-bottom:1rem}h1{color:#0f6e66}
section{border:1px solid #dcd9d0;border-radius:10px;padding:.5rem 1rem;margin:.75rem 0}
section.same{color:#59625f;padding:.1rem 1rem}h2{font-size:1rem;margin:.4rem 0}div{white-space:pre-wrap}
ins{background:#d9f2df;color:#14532d;text-decoration:none;border-radius:3px}
del{background:#fbe1df;color:#7f1d1d;border-radius:3px}.key ins,.key del{padding:0 .4em}
</style></head><body>
<header><h1>${L.title}</h1>
<p>A: <b dir="auto">${esc(a.name)}</b> (${L.pages}: ${texts[0].length})<br>B: <b dir="auto">${esc(b.name)}</b> (${L.pages}: ${texts[1].length})</p>
<p class="key"><del>A — ${L.removed}</del> <ins>B — ${L.added}</ins></p>
${changed ? '' : `<p><b>${L.same}</b></p>`}</header>
${sections.join('\n')}
</body></html>
`;
		return [
			{
				name: 'compare-report.html',
				type: 'text/html',
				bytes: new TextEncoder().encode(html),
				...(changed ? {} : { note: 'identical' as const })
			}
		];
	}
};

export default adapter;
