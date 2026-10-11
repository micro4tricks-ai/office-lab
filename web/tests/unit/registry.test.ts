import { describe, expect, it } from 'vitest';
import ar from '../../src/lib/i18n/ar.json';
import en from '../../src/lib/i18n/en.json';
import { engines } from '../../src/lib/adapters';
import { tools } from '../../src/lib/registry/tools';
import { CATEGORIES } from '../../src/lib/registry/types';

describe('registry', () => {
	it('has unique, url-safe ids', () => {
		const ids = tools.map((t) => t.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
	});

	it('every tool is complete in both languages', () => {
		for (const t of tools) {
			expect(CATEGORIES).toContain(t.category);
			expect(t.from.length).toBeGreaterThan(0);
			expect(t.maxMB).toBeGreaterThan(0);
			for (const l of ['ar', 'en'] as const) {
				expect(t.i18n[l].title, `${t.id} ${l} title`).toBeTruthy();
				expect(t.i18n[l].desc, `${t.id} ${l} desc`).toBeTruthy();
			}
			for (const o of t.options ?? []) {
				expect(o.label.ar && o.label.en, `${t.id}.${o.id} label`).toBeTruthy();
			}
		}
	});

	it('every engine exists and loads', async () => {
		for (const t of tools) {
			expect(engines[t.engine], t.engine).toBeTypeOf('function');
			const a = await t.load();
			expect(a.convert).toBeTypeOf('function');
		}
	});

	it('ar.json and en.json have the same keys', () => {
		expect(Object.keys(en).sort()).toEqual(Object.keys(ar).sort());
	});
});
