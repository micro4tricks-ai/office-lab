import { expect, test, type Page } from '@playwright/test';
import { unzipSync } from 'fflate';
import { readFileSync } from 'node:fs';

const done = (page: Page) => expect(page.locator('[data-status="waiting"], [data-status="working"]')).toHaveCount(0, { timeout: 60_000 });

test.describe('QR, barcode and file tools', () => {
	test('a QR code made here (Arabic) is read back by the reader tool', async ({ page }) => {
		await page.goto('en/qr-code/');
		await page.getByTestId('qr-text').fill('مرحبا من المعمل https://example.com');
		await expect(page.getByTestId('qr-svg').locator('svg')).toBeVisible();
		const dl = page.waitForEvent('download');
		await page.getByRole('button', { name: 'PNG' }).click();
		const png = readFileSync((await (await dl).path())!);

		await page.goto('en/read-qr/');
		await page.getByTestId('file-input').setInputFiles({ name: 'qr.png', mimeType: 'image/png', buffer: png });
		await page.getByRole('button', { name: 'Convert', exact: true }).click();
		await done(page);
		const out = page.waitForEvent('download');
		await page.getByRole('button', { name: 'Download qr-qr.txt' }).click();
		expect(readFileSync((await (await out).path())!, 'utf8').trim()).toBe('مرحبا من المعمل https://example.com');
	});

	test('barcode: valid EAN13 draws, a bad one explains why', async ({ page }) => {
		await page.goto('en/barcode/');
		await expect(page.getByTestId('bc-svg').locator('rect').first()).toBeAttached();
		await page.getByTestId('bc-value').fill('12');
		await expect(page.getByRole('alert')).toContainText('EAN13');
	});

	test('zip, then unzip, then batch-rename', async ({ page }) => {
		const files = ['a.txt', 'b.txt'].map((name) => ({ name, mimeType: 'text/plain', buffer: Buffer.from(`content of ${name}`) }));
		await page.goto('en/create-zip/');
		await page.getByTestId('file-input').setInputFiles(files);
		await page.getByRole('button', { name: 'Convert', exact: true }).click();
		await done(page);
		let dl = page.waitForEvent('download');
		await page.getByRole('button', { name: 'Download archive.zip' }).click();
		const archive = readFileSync((await (await dl).path())!);
		expect(Object.keys(unzipSync(archive)).sort()).toEqual(['a.txt', 'b.txt']);

		await page.goto('en/extract-zip/');
		await page.getByTestId('file-input').setInputFiles({ name: 'archive.zip', mimeType: 'application/zip', buffer: archive });
		await page.getByRole('button', { name: 'Convert', exact: true }).click();
		await done(page);
		await expect(page.getByRole('button', { name: 'Download a.txt' })).toBeVisible();

		await page.goto('en/batch-rename/');
		await page.getByTestId('file-input').setInputFiles(files);
		await page.getByLabel('New name').fill('invoice-{n}');
		await page.getByRole('button', { name: 'Convert', exact: true }).click();
		await done(page);
		await expect(page.getByRole('button', { name: 'Download invoice-001.txt' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Download invoice-002.txt' })).toBeVisible();
		dl = page.waitForEvent('download');
		await page.getByRole('button', { name: 'Download invoice-002.txt' }).click();
		expect(readFileSync((await (await dl).path())!, 'utf8')).toBe('content of b.txt');
	});
});
