import ar from './i18n/ar.json';
import { tools } from './registry/tools';

/** Where the phone's Share menu posts files (the service worker answers it). */
export const SHARE_ACTION = 'share-target/';
/** Cache the service worker puts shared files in, until the share page picks them up. */
export const SHARE_CACHE = 'share-inbox';

/** File types the installed app offers to open from the Share menu: what the file tools take. */
export function shareAccept(): string[] {
	const out = new Set<string>(['image/*']);
	for (const t of tools) {
		if (t.widget || t.from.includes('*')) continue;
		for (const f of t.from) out.add(f.includes('/') ? f : `.${f}`);
	}
	return [...out];
}

const SHORTCUTS = ['merge-pdf', 'compress-pdf', 'image-to-pdf', 'compress-image'];

/** manifest.webmanifest (Arabic first; the app opens on the visitor's chosen language). */
export function manifest(base: string) {
	const icon = (src: string, size: number, purpose: string) => ({
		src: `${base}/icons/${src}`,
		sizes: `${size}x${size}`,
		type: 'image/png',
		purpose
	});
	return {
		id: `${base}/`,
		name: `${ar['app.name']} · Office Lab`,
		short_name: ar['app.name'],
		description: ar['app.description'],
		lang: 'ar',
		dir: 'rtl',
		start_url: `${base}/`,
		scope: `${base}/`,
		display: 'standalone',
		background_color: '#f6f5f1',
		theme_color: '#0f6e66',
		categories: ['productivity', 'utilities'],
		icons: [icon('icon-192.png', 192, 'any'), icon('icon-512.png', 512, 'any'), icon('maskable-512.png', 512, 'maskable')],
		shortcuts: SHORTCUTS.map((id) => {
			const tool = tools.find((t) => t.id === id)!;
			return { name: tool.i18n.ar.title, url: `${base}/ar/${id}/`, icons: [icon('icon-192.png', 192, 'any')] };
		}),
		share_target: {
			action: `${base}/${SHARE_ACTION}`,
			method: 'POST',
			enctype: 'multipart/form-data',
			params: { files: [{ name: 'files', accept: shareAccept() }] }
		}
	};
}
