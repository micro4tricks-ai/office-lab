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
			prerender: { entries: ['*'] }
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
		__API_URL__: JSON.stringify(process.env.PUBLIC_API_URL ?? '')
	},
	test: {
		include: ['tests/unit/**/*.test.ts']
	}
});
