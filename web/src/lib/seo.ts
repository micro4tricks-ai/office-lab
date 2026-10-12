import { tools } from './registry/tools';
import { LANGS, type Lang } from './registry/types';

declare const __SITE_ORIGIN__: string;
declare const __BASE_PATH__: string;

/** '/office-lab' on Pages, '' on the VPS: for absolute URLs (canonical, sitemap, og:url). */
export const BASE: string = __BASE_PATH__;

/**
 * PUBLIC_SITE_ORIGIN at build time, e.g. https://micro4tricks-ai.github.io (Pages) or
 * https://example.com (VPS). Empty = absolute URLs (canonical, sitemap, og:image) are left out.
 */
export const SITE_ORIGIN: string = __SITE_ORIGIN__.replace(/\/+$/, '');

/** Pages outside the tool list, under /{lang}/ (no leading slash, trailing slash). */
export const EXTRA_PAGES = ['pipelines/', 'about/', 'privacy/'] as const;

/** Every indexable path after /{lang}/: '' is the home page. */
export const sitePaths = (): string[] => ['', ...tools.map((t) => `${t.id}/`), ...EXTRA_PAGES];

export const OG_LOCALE: Record<Lang, string> = { ar: 'ar_EG', en: 'en_US' };

/** `path` already includes the base path. */
export const absolute = (path: string) => SITE_ORIGIN + path;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** sitemap.xml with ar/en alternates for every page. */
export function sitemap(base = BASE): string {
	const url = (lang: Lang, path: string) => esc(absolute(`${base}/${lang}/${path}`));
	const rows = sitePaths().flatMap((path) =>
		LANGS.map((lang) => {
			const alts = LANGS.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${url(l, path)}"/>`);
			alts.push(`<xhtml:link rel="alternate" hreflang="x-default" href="${url('ar', path)}"/>`);
			return `<url><loc>${url(lang, path)}</loc>${alts.join('')}</url>`;
		})
	);
	return (
		'<?xml version="1.0" encoding="UTF-8"?>\n' +
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
		rows.join('\n') +
		'\n</urlset>\n'
	);
}

export function robots(base = BASE): string {
	const lines = ['User-agent: *', 'Allow: /'];
	if (SITE_ORIGIN) lines.push(`Sitemap: ${absolute(`${base}/sitemap.xml`)}`);
	return lines.join('\n') + '\n';
}

/** JSON for <script type="application/ld+json">, safe inside HTML. */
export const jsonLd = (data: object) => JSON.stringify(data).replace(/</g, '\\u003c');
