import { SHARE_CACHE } from './pwa';

/** Files the service worker received from the Share menu (empty when there are none). */
export async function readInbox(): Promise<File[]> {
	if (!('caches' in globalThis)) return [];
	const cache = await caches.open(SHARE_CACHE);
	const files: File[] = [];
	for (const req of await cache.keys()) {
		const res = await cache.match(req);
		if (!res) continue;
		const name = decodeURIComponent(res.headers.get('x-name') ?? 'file');
		files.push(new File([await res.blob()], name, { type: res.headers.get('content-type') ?? '' }));
	}
	return files;
}

export async function clearInbox() {
	if ('caches' in globalThis) await caches.delete(SHARE_CACHE);
}
