import { defineConfig, devices } from '@playwright/test';

// Tests run against the built site under the same base path as GitHub Pages,
// or against a running server version: E2E_URL=http://localhost/ (docker compose up).
const base = process.env.BASE_PATH ?? '/office-lab';
const external = process.env.E2E_URL;

export default defineConfig({
	testDir: 'tests/e2e',
	fullyParallel: true,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? 'github' : 'list',
	use: { baseURL: external ?? `http://localhost:4173${base}/` },
	projects: [
		{ name: 'desktop', use: { ...devices['Desktop Chrome'] } },
		{ name: 'mobile', use: { ...devices['Pixel 7'] } }
	],
	webServer: external
		? undefined
		: {
				command: 'npm run preview -- --port 4173 --strictPort',
				port: 4173,
				reuseExistingServer: !process.env.CI
			}
});
