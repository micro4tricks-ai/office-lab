declare const __API_URL__: string;

/**
 * PUBLIC_API_URL at build time: '' = no server (GitHub Pages), 'self' = same site (the Docker
 * version, Caddy proxies /api), or another origin such as https://api.example.com.
 */
const RAW: string = __API_URL__;
export const HAS_SERVER = RAW !== '';
export const API_URL = RAW === 'self' ? '' : RAW.replace(/\/+$/, '');

export const REPO_URL = 'https://github.com/micro4tricks-ai/office-lab';

let caps: Promise<Set<string>> | null = null;

/** Tool ids the server says it can run; empty set when there is no server. */
export function serverCapabilities(): Promise<Set<string>> {
	if (!HAS_SERVER) return Promise.resolve(new Set());
	caps ??= fetch(`${API_URL}/api/capabilities`)
		.then((r) => (r.ok ? r.json() : { tools: [] }))
		.then((j: { tools?: string[] }) => new Set(j.tools ?? []))
		.catch(() => new Set<string>());
	return caps;
}
