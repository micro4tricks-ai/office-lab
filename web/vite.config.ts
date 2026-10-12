/// <reference types="vitest/config" />
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// '/office-lab' on GitHub Pages, '' on the VPS.
const base = (process.env.BASE_PATH ?? '') as '' | `/${string}`;

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter({ fallback: '404.html' }),
			paths: { base },
			prerender: { entries: ['*'] },
			// Small stylesheets go inline: a tool page linked ~16 of them, which delayed the first paint.
			inlineStyleThreshold: 8192
		})
	],
	// Workers code-split their lazy codecs, which needs ES-module workers.
	worker: { format: 'es' },
	// The WASM codecs load their .wasm via import.meta.url; pre-bundling would break that in dev.
	optimizeDeps: {
		exclude: ['@jsquash/avif', '@jsquash/jpeg', '@jsquash/jxl', '@jsquash/oxipng', '@jsquash/png', '@jsquash/webp']
	},
	define: {
		// Empty = no server: server tools show the "server version" badge.
		__API_URL__: JSON.stringify(process.env.PUBLIC_API_URL ?? ''),
		// Origin for canonical links, sitemap and og:image (e.g. https://micro4tricks-ai.github.io).
		__SITE_ORIGIN__: JSON.stringify(process.env.PUBLIC_SITE_ORIGIN ?? ''),
		// The base path as a plain string ($app/paths has no `base` in Kit 3, and SSR paths are relative).
		__BASE_PATH__: JSON.stringify(base)
	},
	test: {
		include: ['tests/unit/**/*.test.ts']
	}
});
