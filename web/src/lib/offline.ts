/** Talks to the service worker: "save every browser tool for offline use". */

const FLAG = 'offline-all';

export const offlineSupported = () => typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'caches' in globalThis;

export type CacheProgress = { done: number; total: number; bytes: number };

export async function cacheAll(onProgress?: (p: CacheProgress) => void): Promise<{ failed: number; bytes: number }> {
	const reg = await navigator.serviceWorker.ready;
	const sw = reg.active;
	if (!sw) throw new Error('no service worker');
	return new Promise((resolve) => {
		const channel = new MessageChannel();
		channel.port1.onmessage = ({ data }) => {
			if (data.kind === 'progress') onProgress?.(data);
			else {
				if (!data.failed) remember(true);
				else console.warn('[office-lab] offline: could not save', data.failed, 'files, e.g.', data.missed);
				resolve({ failed: data.failed, bytes: data.bytes });
			}
		};
		sw.postMessage({ type: 'cache-all' }, [channel.port2]);
	});
}

function remember(on: boolean) {
	try {
		if (on) localStorage.setItem(FLAG, '1');
		else localStorage.removeItem(FLAG);
	} catch {}
}

export function offlineChosen() {
	try {
		return localStorage.getItem(FLAG) === '1';
	} catch {
		return false;
	}
}

/**
 * Once the visitor chose "all tools offline" (or runs the installed app), keep that complete:
 * after an update only the new files are fetched. Runs quietly in the background.
 */
export function keepOfflineCurrent() {
	if (!offlineSupported()) return;
	const installed = matchMedia('(display-mode: standalone)').matches;
	if (!installed && !offlineChosen()) return;
	const run = () => cacheAll().catch(() => {});
	if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 10_000 });
	else setTimeout(run, 3000);
}
