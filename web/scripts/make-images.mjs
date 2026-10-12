// Makes the Open Graph pictures (static/og/{home|category}-{lang}.jpg, 1200×630) and the PWA icons
// (static/icons/*.png) from the registry and favicon.svg, with the site's own font. The output is
// committed; run again after adding a category or renaming one:   node scripts/make-images.mjs
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = (...p) => join(root, 'static', ...p);
mkdirSync(out('og'), { recursive: true });
mkdirSync(out('icons'), { recursive: true });

// The registry is TypeScript (and imports Svelte modules): load it through Vite.
const vite = await createServer({ root, logLevel: 'error', server: { middlewareMode: true } });
const { tools } = await vite.ssrLoadModule('/src/lib/registry/tools.ts');
const { CATEGORIES } = await vite.ssrLoadModule('/src/lib/registry/types.ts');
await vite.close();
const dict = {
	ar: JSON.parse(readFileSync(join(root, 'src/lib/i18n/ar.json'), 'utf8')),
	en: JSON.parse(readFileSync(join(root, 'src/lib/i18n/en.json'), 'utf8'))
};
const t = (lang, key, n) => dict[lang][key].replace('{n}', String(n));

const font = (file) =>
	readFileSync(join(root, 'node_modules/@fontsource-variable/cairo/files', file)).toString('base64');
const FONTS = `
@font-face{font-family:Cairo;font-weight:200 1000;src:url(data:font/woff2;base64,${font('cairo-arabic-wght-normal.woff2')}) format('woff2');unicode-range:U+0600-06FF,U+0750-077F,U+0870-08FF,U+FB50-FDFF,U+FE70-FEFF,U+200C-200E,U+2010-2011,U+204F,U+2E41}
@font-face{font-family:Cairo;font-weight:200 1000;src:url(data:font/woff2;base64,${font('cairo-latin-wght-normal.woff2')}) format('woff2');unicode-range:U+0000-00FF,U+2000-206F,U+2190-21FF}`;

const FLASK = 'M9 3h6M10 3v6.5L4.6 18.3A2 2 0 0 0 6.3 21h11.4a2 2 0 0 0 1.7-2.7L14 9.5V3M7.5 15h9';
const SHIELD = 'M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6L12 3Zm-3 9 2 2 4-4';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const svg = (d, size, color) =>
	`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;

function card(lang, title, sub, chips) {
	return `<!doctype html><html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><style>${FONTS}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;font-family:Cairo,sans-serif;color:#fff;background:radial-gradient(circle at 85% 0%,#1d8d83 0,#0f6e66 45%,#0a4f4a 100%);padding:64px 72px;display:flex;flex-direction:column;justify-content:space-between}
.brand{display:flex;align-items:center;gap:20px;font-size:38px;font-weight:800}
.logo{width:76px;height:76px;border-radius:20px;background:#fff;display:grid;place-items:center}
.brand small{font-size:26px;font-weight:600;opacity:.75}
h1{font-size:${title.length > 34 ? 60 : 76}px;font-weight:900;line-height:1.2;max-width:1000px}
p.sub{font-size:34px;font-weight:600;opacity:.88;margin-top:14px}
.chips{display:flex;flex-wrap:wrap;gap:14px;margin-top:30px}
.chips span{background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.28);border-radius:999px;padding:6px 22px;font-size:26px;font-weight:600}
.foot{display:flex;align-items:center;gap:14px;font-size:28px;font-weight:700;color:#bff0e8}
</style></head><body>
<div class="brand"><span class="logo">${svg(FLASK, 48, '#0f6e66')}</span><span>${esc(dict[lang]['app.name'])} <small>· ${lang === 'ar' ? 'Office Lab' : 'المعمل'}</small></span></div>
<div><h1>${esc(title)}</h1>${sub ? `<p class="sub">${esc(sub)}</p>` : ''}<div class="chips">${chips.map((c) => `<span>${esc(c)}</span>`).join('')}</div></div>
<div class="foot">${svg(SHIELD, 34, '#bff0e8')}<span>${esc(dict[lang]['tool.privacy'])}</span></div>
</body></html>`;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
async function shot(html, file) {
	await page.setContent(html);
	await page.evaluate(() => document.fonts.ready);
	await page.screenshot({ path: file, type: 'jpeg', quality: 86 });
	console.log('wrote', file.slice(root.length + 1));
}

for (const lang of ['ar', 'en']) {
	const browserTools = tools.filter((x) => x.runtime === 'browser').length;
	await shot(
		card(lang, dict[lang]['app.tagline'], t(lang, 'og.tools', tools.length), [
			'PDF',
			dict[lang]['cat.image'],
			'Word · Excel',
			'OCR',
			t(lang, 'og.local', browserTools)
		]),
		out('og', `home-${lang}.jpg`)
	);
	for (const cat of CATEGORIES) {
		const list = tools.filter((x) => x.category === cat);
		if (!list.length) continue;
		await shot(
			card(lang, dict[lang][`cat.${cat}`], t(lang, 'og.tools', list.length), list.slice(0, 5).map((x) => x.i18n[lang].title)),
			out('og', `${cat}-${lang}.jpg`)
		);
	}
}

// Icons: "any" keeps the rounded square; maskable and Apple fill the whole square (the OS cuts the shape).
const logo = (size, pad, rounded) => `<!doctype html><html><head><style>*{margin:0}body{width:${size}px;height:${size}px;display:grid;place-items:center;background:${rounded ? 'transparent' : '#0f6e66'}}
div{width:${size}px;height:${size}px;border-radius:${rounded ? size * 0.22 : 0}px;background:#0f6e66;display:grid;place-items:center}</style></head>
<body><div>${svg(FLASK, Math.round(size * (1 - 2 * pad)), '#fff')}</div></body></html>`;
for (const [file, size, pad, rounded] of [
	['icon-192.png', 192, 0.18, true],
	['icon-512.png', 512, 0.18, true],
	['maskable-512.png', 512, 0.3, false],
	['apple-touch-icon.png', 180, 0.22, false]
]) {
	await page.setViewportSize({ width: size, height: size });
	await page.setContent(logo(size, pad, rounded));
	await page.screenshot({ path: out('icons', file), omitBackground: rounded });
	console.log('wrote', `static/icons/${file}`);
}
await browser.close();
