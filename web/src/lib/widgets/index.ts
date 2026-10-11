import type { Component } from 'svelte';
import type { Lang, WidgetKey } from '../registry/types';

type Widget = Component<{ lang: Lang }>;

/** Widget key → lazy component (each loads only on its own tool page). */
export const widgets: Partial<Record<WidgetKey, () => Promise<{ default: Widget }>>> = {
	markdown: () => import('./MarkdownStudio.svelte')
};
