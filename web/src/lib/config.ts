declare const __API_URL__: string;

/** Empty on GitHub Pages (no server). */
export const API_URL: string = __API_URL__;

export const REPO_URL = 'https://github.com/micro4tricks-ai/office-lab';

let caps: Promise<Set<string>> | null = null;

/** Tool ids the server says it can run; empty set when there is no server. */
export function serverCapabilities(): Promise<Set<string>> {
	if (!API_URL) return Promise.resolve(new Set());
	caps ??= fetch(`${API_URL}/api/capabilities`)
		.then((r) => (r.ok ? r.json() : { tools: [] }))
		.then((j: { tools?: string[] }) => new Set(j.tools ?? []))
		.catch(() => new Set<string>());
	return caps;
}
