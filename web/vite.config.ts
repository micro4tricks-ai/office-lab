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
	define: {
		// Empty = no server: server tools show the "server version" badge.
		__API_URL__: JSON.stringify(process.env.PUBLIC_API_URL ?? '')
	},
	test: {
		include: ['tests/unit/**/*.test.ts']
	}
});
