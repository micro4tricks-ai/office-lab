import { describe, expect, it } from 'vitest';
import { tools } from '../../src/lib/registry/tools';
import { CATEGORIES } from '../../src/lib/registry/types';
import { existsSync } from 'node:fs';
import { EXTRA_PAGES, jsonLd, robots, sitemap, sitePaths } from '../../src/lib/seo';

describe('SEO', () => {
	it('lists every tool and page in both languages, with alternates', () => {
		const xml = sitemap('/office-lab');
		const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
		expect(locs).toHaveLength(sitePaths().length * 2);
		expect(sitePaths()).toHaveLength(1 + tools.length + EXTRA_PAGES.length);
		for (const t of tools) for (const l of ['ar', 'en']) expect(locs).toContain(`/office-lab/${l}/${t.id}/`);
		expect(xml).toContain('hreflang="x-default" href="/office-lab/ar/merge-pdf/"');
		expect(new Set(locs).size).toBe(locs.length);
	});

	it('robots.txt allows crawling', () => {
		expect(robots('')).toMatch(/^User-agent: \*\nAllow: \/\n/);
	});

	it('JSON-LD cannot close its script tag', () => {
		expect(jsonLd({ name: '</script><script>alert(1)</script>' })).not.toContain('<');
	});

	it('has an Open Graph picture for home and every category in use, in both languages', () => {
		const used = CATEGORIES.filter((c) => tools.some((t) => t.category === c));
		for (const name of ['home', ...used])
			for (const l of ['ar', 'en']) expect(existsSync(`static/og/${name}-${l}.jpg`), `${name}-${l}`).toBe(true);
	});
});

describe('routes', () => {
	it('no tool id collides with a fixed page under /{lang}/', () => {
		const fixed = [...EXTRA_PAGES.map((p) => p.replace('/', '')), 'share'];
		for (const t of tools) expect(fixed, t.id).not.toContain(t.id);
	});
});
