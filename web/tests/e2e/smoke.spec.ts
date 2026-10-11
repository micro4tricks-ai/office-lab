import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

test('root sends visitors to Arabic', async ({ page }) => {
	await page.goto('./');
	await expect(page).toHaveURL(/\/ar\/$/);
	await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
});

test('home works in both languages', async ({ page }) => {
	await page.goto('ar/');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('المعمل');
	await page.getByRole('link', { name: 'Switch to English' }).click();
	await expect(page).toHaveURL(/\/en\/$/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Office Lab');
	await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
});

test('search filters the tool grid', async ({ page }) => {
	await page.goto('en/');
	await page.getByRole('searchbox').fill('html');
	await expect(page.getByRole('link', { name: /Text to HTML/ })).toBeVisible();
	await page.getByRole('searchbox').fill('zzzz');
	await expect(page.getByRole('status')).toBeVisible();
});

test('theme toggle switches and persists', async ({ page }) => {
	await page.goto('en/');
	await page.getByRole('button', { name: 'Dark mode' }).click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	await page.reload();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('txt-to-html converts, downloads, and zips', async ({ page }) => {
	await page.goto('ar/txt-to-html/');
	await page.getByTestId('file-input').setInputFiles([fixture('sample.txt'), fixture('wrong.pdf')]);
	await expect(page.getByRole('alert')).toContainText('نوع الملف غير مدعوم');
	await page.getByRole('button', { name: 'تحويل', exact: true }).click();
	const dl = page.waitForEvent('download');
	await page.getByRole('button', { name: /تنزيل sample\.html/ }).click();
	const file = await dl;
	expect(file.suggestedFilename()).toBe('sample.html');
	await page.getByRole('button', { name: 'تحويل ملفات أخرى' }).click();
	await expect(page.getByRole('button', { name: 'اختر ملفات' })).toBeVisible();
});

test('download all as ZIP with two outputs', async ({ page }) => {
	await page.goto('en/txt-to-html/');
	await page.getByTestId('file-input').setInputFiles([fixture('sample.txt'), fixture('sample.txt')]);
	await page.getByRole('button', { name: 'Convert', exact: true }).click();
	const dl = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Download all (ZIP)' }).click();
	expect((await dl).suggestedFilename()).toBe('office-lab.zip');
});

for (const path of ['ar/', 'en/', 'ar/txt-to-html/']) {
	test(`no serious a11y violations on ${path}`, async ({ page }) => {
		await page.goto(path);
		const { violations } = await new AxeBuilder({ page }).analyze();
		const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
		expect(serious.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
	});
}
