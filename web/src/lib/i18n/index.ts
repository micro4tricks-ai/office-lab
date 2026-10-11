import ar from './ar.json';
import en from './en.json';
import type { Lang } from '../registry/types';

export type Key = keyof typeof ar;
const dict: Record<Lang, Record<Key, string>> = { ar, en };

/** Translate `key`, filling `{name}` placeholders from `vars`. */
export function t(lang: Lang, key: Key, vars: Record<string, string | number> = {}) {
	return dict[lang][key].replace(/\{(\w+)\}/g, (_, v) => String(vars[v] ?? ''));
}

export const isLang = (s: string | undefined): s is Lang => s === 'ar' || s === 'en';

/** Byte count → "12.3 KB" with the language's digits. */
export function formatSize(lang: Lang, bytes: number) {
	const units = lang === 'ar' ? ['بايت', 'ك.ب', 'م.ب', 'ج.ب'] : ['B', 'KB', 'MB', 'GB'];
	let i = 0;
	let n = bytes;
	while (n >= 1024 && i < units.length - 1) {
		n /= 1024;
		i++;
	}
	const num = new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en', {
		maximumFractionDigits: i === 0 ? 0 : 1
	}).format(n);
	return `${num} ${units[i]}`;
}
