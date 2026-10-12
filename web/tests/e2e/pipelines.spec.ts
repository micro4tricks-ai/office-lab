import { PDFDocument } from '@cantoo/pdf-lib';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const fx = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

async function grab(page: Page) {
	const dl = page.waitForEvent('download');
	await page.getByRole('button', { name: /^(Download|تنزيل) (?!all|الكل)/ }).first().click();
	const file = await dl;
	return { name: file.suggestedFilename(), bytes: readFileSync((await file.path())!) };
}

const finished = (page: Page) =>
	expect(page.locator('[data-status="waiting"], [data-status="working"]')).toHaveCount(0, { timeout: 120_000 });

test.describe('tool chains', () => {
	test.describe.configure({ timeout: 120_000 });

	test('ready-made: iPhone photos → one compact PDF', async ({ page }) => {
		await page.goto('en/pipelines/');
		await page.getByRole('button', { name: 'iPhone photos → one compact PDF' }).click();
		await expect(page.getByRole('heading', { level: 3 })).toHaveCount(3);
		await expect(page.getByRole('heading', { level: 3 }).first()).toContainText('HEIC');
		await page.getByTestId('file-input').setInputFiles([fx('images/photo.heic'), fx('images/photo.heic')]);
		await page.getByRole('button', { name: 'Run the chain' }).click();
		await finished(page);
		const out = await grab(page);
		expect(out.name).toMatch(/\.pdf$/);
		expect((await PDFDocument.load(out.bytes)).getPageCount()).toBe(2);
	});

	test('build a chain, save it, and run it after a reload', async ({ page }) => {
		await page.goto('en/pipelines/');
		await page.getByTestId('add-step').selectOption('merge-pdf');
		await page.getByTestId('add-step').selectOption('pdf-page-numbers');
		await page.getByLabel('Chain name').fill('Merge and number');
		await page.getByRole('button', { name: 'Save the chain' }).click();
		await expect(page.getByText('Saved in this browser.')).toBeVisible();

		await page.reload();
		await page.getByRole('button', { name: 'Merge and number', exact: true }).click();
		await page.getByTestId('file-input').setInputFiles([fx('pdf/text3.pdf'), fx('pdf/photo.pdf')]);
		await page.getByRole('button', { name: 'Run the chain' }).click();
		await finished(page);
		const merged = await PDFDocument.load((await grab(page)).bytes);
		const parts = await Promise.all(['pdf/text3.pdf', 'pdf/photo.pdf'].map((f) => PDFDocument.load(readFileSync(fx(f)))));
		expect(merged.getPageCount()).toBe(parts.reduce((n, d) => n + d.getPageCount(), 0));

		await page.getByRole('button', { name: 'Delete “Merge and number”' }).click();
		await expect(page.getByRole('button', { name: 'Merge and number', exact: true })).toHaveCount(0);
	});

	test('a required option (the password) is asked for before running', async ({ page }) => {
		await page.goto('ar/pipelines/');
		await page.getByRole('button', { name: /حماية بكلمة مرور/ }).click();
		await page.getByTestId('file-input').setInputFiles(fx('pdf/text3.pdf'));
		await page.getByRole('button', { name: 'شغّل السلسلة' }).click();
		await expect(page.getByRole('alert')).toBeVisible();
		await page.getByLabel('كلمة المرور').fill('1234');
		await page.getByRole('button', { name: 'شغّل السلسلة' }).click();
		await finished(page);
		const out = await grab(page);
		await expect(PDFDocument.load(out.bytes)).rejects.toThrow();
		expect((await PDFDocument.load(out.bytes, { password: '1234' })).getPageCount()).toBeGreaterThan(0);
	});
});
