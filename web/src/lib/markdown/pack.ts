import type { FileData } from '../registry/types';

/**
 * Makes a built document self-contained for the server's Chromium (it can't reach this site):
 * every same-site font/script it uses is fetched and sent along, and the document points at
 * them by bare file name. Only WOFF2 fonts are sent; browsers pick them before the fallbacks.
 */
export async function packDocument(html: string, base = location.href): Promise<{ index: FileData; assets: FileData[] }> {
	const origin = new URL(base).origin;
	const names = new Map<string, string>(); // absolute URL → file name in the upload
	const used = new Set<string>();
	const math = html.includes('class="katex');

	const nameFor = (abs: string) => {
		let n = names.get(abs);
		if (n) return n;
		const file = new URL(abs).pathname.split('/').pop() || 'asset';
		const [stem, ext] = [file.replace(/\.[^.]+$/, ''), file.match(/\.[^.]+$/)?.[0] ?? ''];
		n = (stem.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 60) || 'asset') + ext.replace(/[^A-Za-z0-9.]/g, '');
		for (let i = 2; used.has(n); i++) n = `${i}-${n}`;
		used.add(n);
		names.set(abs, n);
		return n;
	};

	const wanted = (u: string) => {
		if (u.startsWith('data:') || u.startsWith('#')) return null;
		const abs = new URL(u, base);
		if (abs.origin !== origin) return null;
		if (/KaTeX_/.test(abs.pathname) && !math) return null;
		return /\.(woff2|js)$/.test(abs.pathname) ? abs.href : null;
	};

	let out = html.replace(/url\((["']?)([^)"']+)\1\)/g, (m, q: string, u: string) => {
		const abs = wanted(u);
		return abs ? `url(${q}${nameFor(abs)}${q})` : m;
	});
	out = out.replace(/<script src="([^"]+)"/g, (m, u: string) => {
		const abs = wanted(u);
		return abs ? `<script src="${nameFor(abs)}"` : m;
	});

	const assets = await Promise.all(
		[...names].map(async ([abs, name]) => {
			const r = await fetch(abs);
			if (!r.ok) throw new Error(`asset ${r.status}`);
			return { name, type: r.headers.get('content-type') ?? '', bytes: new Uint8Array(await r.arrayBuffer()) };
		})
	);
	return { index: { name: 'index.html', type: 'text/html', bytes: new TextEncoder().encode(out) }, assets };
}
