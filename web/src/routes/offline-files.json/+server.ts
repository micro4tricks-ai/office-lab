import { readdirSync, type Dirent } from 'node:fs';
import { join, sep } from 'node:path';

export const prerender = true;

/**
 * The worker files (codecs, engines) for "all tools offline": SvelteKit's service-worker manifest
 * leaves them out. Prerendering runs after the client build, so they are on disk by then.
 */
export function GET() {
	const root = join(process.cwd(), '.svelte-kit', 'output', 'client');
	const dir = join(root, '_app', 'immutable', 'workers');
	let files: string[] = [];
	try {
		files = (readdirSync(dir, { recursive: true, withFileTypes: true }) as Dirent[])
			.filter((d) => d.isFile())
			.map((d) => join(d.parentPath, d.name).slice(root.length + 1).split(sep).join('/'))
			// transformers.js' own copy of the ONNX runtime is unused (it loads static/ort).
			.filter((p) => !/ort-wasm/.test(p))
			.sort();
	} catch {
		// dev server: nothing built yet
	}
	return new Response(JSON.stringify({ files }), { headers: { 'content-type': 'application/json' } });
}
