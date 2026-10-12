import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * The server version (docker compose up, then E2E_URL=http://localhost/).
 * Skipped on the GitHub Pages build, which has no API.
 */
const fx = (name: string) => fileURLToPath(new URL(`../../../server/tests/fixtures/${name}`, import.meta.url));

test.describe('server tools', () => {
	test.describe.configure({ timeout: 180_000 });

	test.beforeEach(async ({ request }) => {
		const r = await request.get('api/capabilities').catch(() => null);
		test.skip(!r?.ok(), 'no API here (GitHub Pages build)');
	});

	async function convert(page: Page, tool: string, file: string, lang = 'en') {
		await page.goto(`${lang}/${tool}/`);
		await page.getByTestId('file-input').setInputFiles(fx(file));
		await page.getByRole('button', { name: lang === 'en' ? 'Convert' : 'حوّل', exact: true }).click();
		await expect(page.locator('[data-status="waiting"], [data-status="working"]')).toHaveCount(0, { timeout: 150_000 });
	}

	async function grab(page: Page) {
		const dl = page.waitForEvent('download');
		await page.getByRole('button', { name: /^Download (?!all)/ }).first().click();
		const file = await dl;
		return { name: file.suggestedFilename(), bytes: readFileSync((await file.path())!) };
	}

	test('Word → PDF through Gotenberg', async ({ page }) => {
		await convert(page, 'word-to-pdf', 'report.docx');
		const out = await grab(page);
		expect(out.name).toBe('report.pdf');
		expect(out.bytes.subarray(0, 4).toString()).toBe('%PDF');
	});

	test('an old AVI → MP4 with FFmpeg, and a voice note → MP3', async ({ page }) => {
		await convert(page, 'media-convert', 'clip.avi');
		const mp4 = await grab(page);
		expect(mp4.name).toBe('clip.mp4');
		expect(mp4.bytes.subarray(4, 8).toString()).toBe('ftyp');
		await page.goto('en/media-convert/');
		await page.getByTestId('file-input').setInputFiles(fx('voice.ogg'));
		await page.getByLabel('Convert to').selectOption('mp3');
		await page.getByRole('button', { name: 'Convert', exact: true }).click();
		await expect(page.locator('[data-status="done"]')).toHaveCount(1, { timeout: 150_000 });
		expect((await grab(page)).name).toBe('voice.mp3');
	});

	test('strong compression to a target size', async ({ page }) => {
		await page.goto('en/compress-pdf-strong/');
		await page.getByTestId('file-input').setInputFiles(fx('photo.pdf'));
		await page.getByLabel('Method').selectOption('target');
		await page.getByLabel('Target size').fill('0.3');
		await page.getByRole('button', { name: 'Convert', exact: true }).click();
		await expect(page.locator('[data-status="done"]')).toHaveCount(1, { timeout: 150_000 });
		const out = await grab(page);
		expect(out.bytes.length).toBeLessThanOrEqual(0.3 * 1024 * 1024);
	});

	test('a locked PDF explains the password', async ({ page }) => {
		await convert(page, 'pdf-to-word', 'locked.pdf');
		await expect(page.getByRole('alert')).toContainText('password');
	});

	test('website screenshot', async ({ page }) => {
		await page.goto('ar/url-to-image/');
		await page.getByTestId('web-url').fill('example.com');
		await page.getByRole('button', { name: 'حوّل' }).click();
		await expect(page.getByTestId('web-result').locator('img')).toBeVisible({ timeout: 90_000 });
		const dl = page.waitForEvent('download');
		await page.getByTestId('web-result').getByRole('button').click();
		expect((await dl).suggestedFilename()).toBe('example.com.png');
	});

	test('internal addresses are refused with a clear message', async ({ page }) => {
		await page.goto('en/url-to-pdf/');
		await page.getByTestId('web-url').fill('http://gotenberg:3000/health');
		await page.getByRole('button', { name: 'Convert' }).click();
		await expect(page.getByRole('alert')).toContainText("can't be opened");
	});

	test('Markdown studio: one-click PDF from the server', async ({ page }) => {
		await page.goto('ar/markdown-to-pdf/');
		const button = page.getByTestId('md-direct');
		await expect(button).toBeVisible();
		const dl = page.waitForEvent('download', { timeout: 120_000 });
		await button.click();
		const file = await dl;
		const bytes = readFileSync((await file.path())!);
		expect(bytes.subarray(0, 4).toString()).toBe('%PDF');
		expect(file.suggestedFilename()).toMatch(/\.pdf$/);
		// The self-hosted Arabic font was sent along and embedded.
		expect(bytes.includes(Buffer.from('Cairo'))).toBe(true);
	});
});
