/**
 * Offline use and the phone's Share menu.
 * - Pages: network first, then the saved copy, then the app shell (404.html renders any route).
 * - Hashed build files and the engine files in static/: saved the first time they are used, so a
 *   tool that worked once keeps working offline. 'cache-all' (About page, or the installed app's
 *   first start) saves every browser tool at once.
 * - Never touched: the API, the translation models (transformers.js keeps its own cache), files.
 */
import { version } from '$app/env';
import { assets, immutable, prerendered } from '$app/manifest';
import { self } from '$app/service-worker';

const SHELL = `shell-${version}`;
const PAGES = 'pages';
const FILES = 'files';
const INBOX = 'share-inbox';
const KEEP = [SHELL, PAGES, FILES, INBOX];

const scope = new URL(self.registration.scope);
const at = (path: string) => new URL(path, scope).href;

/** The first visit saves only what is needed to open the site again: home pages and the app shell. */
const SHELL_FILES = ['', 'ar/', 'en/', '404.html', 'manifest.webmanifest', 'favicon.svg', 'icons/icon-192.png'].map(at);

/** Engine files worth saving for "all tools offline" (the rest of static/ is fetched when needed). */
const OFFLINE_STATIC = /^(pdfjs\/|pagedjs\/|tesseract\/(worker|lang\/|tesseract-core[\w-]*-lstm|tesseract-core-lstm)|icons\/|favicon)/;
/** transformers.js' copy of the ONNX runtime is unused (it loads static/ort): don't save 21 MB for nothing. */
const UNUSED = /ort-wasm/;

/** Worker files (codecs, engines): not in Kit's manifest, listed by the offline-files.json route. */
async function workerFiles(): Promise<string[]> {
	const res = await fetch(at('offline-files.json'), { cache: 'no-cache' });
	if (!res.ok) throw new Error(`offline-files.json: ${res.status}`);
	return ((await res.json()) as { files: string[] }).files;
}

async function offlineList(): Promise<string[]> {
	return [
		...(await workerFiles()),
		...immutable.map((f) => f.path).filter((p) => !UNUSED.test(p)),
		...prerendered.map((f) => f.path).filter((p) => !/\.(xml|txt|json)$/.test(p)),
		...assets.map((f) => f.path).filter((p) => OFFLINE_STATIC.test(p))
	].map(at);
}

/**
 * Fetches a file to keep. The app shell (404.html) is served with status 404 by some hosts, but
 * its body is what we want: keep it as a normal answer.
 */
async function fetchToKeep(href: string): Promise<Response> {
	const res = await fetch(href, { cache: 'no-cache' });
	if (res.ok) return res;
	if (href.endsWith('/404.html') && res.headers.get('content-type')?.includes('text/html')) {
		return new Response(await res.blob(), { headers: { 'content-type': 'text/html; charset=utf-8' } });
	}
	throw new Error(`${res.status} ${href}`);
}

self.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(SHELL);
			await Promise.all(SHELL_FILES.map(async (href) => cache.put(href, await fetchToKeep(href))));
			await self.skipWaiting();
		})()
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) if (!KEEP.includes(key)) await caches.delete(key);
			// Drop build files and static files this version no longer has (keep all if the list is unreachable).
			const workers = await workerFiles().catch(() => null);
			if (workers) {
				const current = new Set([...immutable.map((f) => f.path), ...assets.map((f) => f.path), ...workers].map(at));
				const files = await caches.open(FILES);
				for (const req of await files.keys()) if (!current.has(req.url)) await files.delete(req);
			}
			await self.clients.claim();
		})()
	);
});

const isFileAsset = (url: URL) => {
	const path = url.href.slice(scope.href.length);
	if (path.startsWith('_app/immutable/')) return true;
	return assets.some((f) => f.path === path) && !path.startsWith('models/');
};

// ignoreVary: servers send "Vary: Origin", and module scripts are requested with an Origin header.
async function cacheFirst(req: Request) {
	const cache = await caches.open(FILES);
	const hit = await cache.match(req, { ignoreSearch: true, ignoreVary: true });
	if (hit) return hit;
	const res = await fetch(req);
	if (res.ok && res.type === 'basic') cache.put(req, res.clone());
	return res;
}

async function page(req: Request) {
	const cache = await caches.open(PAGES);
	try {
		const res = await fetch(req);
		if (res.ok && res.type === 'basic') cache.put(req, res.clone());
		return res;
	} catch {
		return (
			(await cache.match(req, { ignoreSearch: true, ignoreVary: true })) ??
			(await caches.match(req, { ignoreSearch: true, ignoreVary: true })) ??
			(await caches.match(at('404.html'), { ignoreVary: true })) ??
			new Response('Offline', { status: 503, headers: { 'content-type': 'text/plain' } })
		);
	}
}

/** Files from the Share menu wait in a cache until the share page takes them. */
async function receiveShare(req: Request) {
	const form = await req.formData();
	const inbox = await caches.open(INBOX);
	for (const old of await inbox.keys()) await inbox.delete(old);
	let i = 0;
	for (const f of form.getAll('files')) {
		if (!(f instanceof File)) continue;
		const headers = { 'content-type': f.type || 'application/octet-stream', 'x-name': encodeURIComponent(f.name) };
		await inbox.put(at(`share-inbox/${i++}`), new Response(f, { headers }));
	}
	return Response.redirect(at('share/'), 303);
}

self.addEventListener('fetch', (event) => {
	const req = event.request;
	const url = new URL(req.url);
	if (url.origin !== scope.origin || !url.href.startsWith(scope.href)) return;
	if (req.method === 'POST' && url.href === at('share-target/')) return event.respondWith(receiveShare(req));
	if (req.method !== 'GET' || req.headers.has('range')) return;
	if (req.mode === 'navigate') return event.respondWith(page(req));
	if (isFileAsset(url)) return event.respondWith(cacheFirst(req));
});

/** 'cache-all': save every browser tool, reporting progress to the page that asked. */
async function cacheAll(port: MessagePort) {
	let list: string[];
	try {
		list = [...(await offlineList()), ...SHELL_FILES];
	} catch {
		port.postMessage({ kind: 'done', failed: 1, bytes: 0 });
		return;
	}
	const files = await caches.open(FILES);
	const pages = await caches.open(PAGES);
	let done = 0;
	let failed = 0;
	const missed: string[] = [];
	let bytes = 0;
	const queue = [...new Set(list)];
	async function next(): Promise<void> {
		const href = queue.shift();
		if (!href) return;
		try {
			const target = href.endsWith('/') || href.endsWith('.html') ? pages : files;
			if (!(await target.match(href, { ignoreVary: true }))) {
				const res = await fetchToKeep(href);
				const body = await res.clone().arrayBuffer();
				bytes += body.byteLength;
				await target.put(href, res);
			}
		} catch {
			failed++;
			if (missed.length < 5) missed.push(href);
		}
		done++;
		if (done % 10 === 0 || done === list.length) port.postMessage({ kind: 'progress', done, total: queue.length + done, bytes });
		return next();
	}
	await Promise.all(Array.from({ length: 6 }, next));
	port.postMessage({ kind: 'done', failed, bytes, missed });
}

self.addEventListener('message', (event) => {
	if (event.data?.type === 'cache-all' && event.ports[0]) event.waitUntil(cacheAll(event.ports[0]));
});
