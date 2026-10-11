import type { Component } from 'svelte';
import type { Lang, Tool, WidgetKey } from '../registry/types';

type Widget = Component<{ lang: Lang; tool: Tool }>;

/** Widget key → lazy component (each loads only on its own tool page). */
export const widgets: Partial<Record<WidgetKey, () => Promise<{ default: Widget }>>> = {
	markdown: () => import('./MarkdownStudio.svelte'),
	tafqeet: () => import('./Tafqeet.svelte'),
	hijri: () => import('./HijriDate.svelte'),
	'arabic-text': () => import('./ArabicText.svelte'),
	vat: () => import('./VatCalculator.svelte'),
	qr: () => import('./QrMaker.svelte'),
	barcode: () => import('./BarcodeMaker.svelte'),
	'web-capture': () => import('./WebCapture.svelte'),
	invoice: () => import('./InvoiceMaker.svelte'),
	password: () => import('./PasswordMaker.svelte')
};
