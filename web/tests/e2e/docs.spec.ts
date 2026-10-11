import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const fx = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

async function run(page: Page, tool: string, file: string) {
	await page.goto(`en/${tool}/`);
	await page.getByTestId('file-input').setInputFiles(fx(file));
	await page.getByRole('button', { name: 'Convert', exact: true }).click();
	await expect(page.locator('[data-status="waiting"], [data-status="working"]')).toHaveCount(0, { timeout: 60_000 });
	await expect(page.locator('[data-status="done"]')).toHaveCount(1);
	const dl = page.waitForEvent('download');
	await page.getByRole('button', { name: /^Download (?!all)/ }).first().click();
	const d = await dl;
	return { name: d.suggestedFilename(), bytes: readFileSync((await d.path())!) };
}

test.describe('documents and data through the UI', () => {
	for (const [tool, file, name, check] of [
		['word-to-html', 'doc/report.docx', 'report.html', 'تقرير الزيارة'],
		['word-to-markdown', 'doc/report.docx', 'report.md', '# تقرير الزيارة'],
		['markdown-to-html', 'doc/notes.md', 'notes.html', 'ملاحظات الاجتماع'],
		['excel-to-csv', 'data/sales.xlsx', 'sales-Sales.csv', 'شركة النور'],
		['convert-to-yaml', 'data/sample.json', 'sample.yaml', 'company: المعمل']
	] as const) {
		test(`${tool}`, async ({ page }) => {
			const out = await run(page, tool, file);
			expect(out.name).toBe(name);
			expect(out.bytes.toString('utf8')).toContain(check);
		});
	}

	test('markdown-to-word and convert-to-excel produce Office files', async ({ page }) => {
		const docx = await run(page, 'markdown-to-word', 'doc/notes.md');
		expect(docx.name).toBe('notes.docx');
		expect(docx.bytes.subarray(0, 2).toString()).toBe('PK');
		const xlsx = await run(page, 'convert-to-excel', 'data/arabic-1256.csv');
		expect(xlsx.name).toBe('arabic-1256.xlsx');
		expect(xlsx.bytes.subarray(0, 2).toString()).toBe('PK');
	});
});

test.describe('Markdown studio', () => {
	test('live preview, paged preview, print', async ({ page }) => {
		await page.goto('ar/markdown-to-pdf/');
		const preview = page.frameLocator('[data-testid="md-preview"]');
		await expect(preview.locator('h1')).toHaveText('تقرير الزيارة الشهرية', { timeout: 30_000 });

		await page.getByTestId('md-source').fill('# عنوان جديد\n\nنص $x^2$');
		await expect(preview.locator('h1')).toHaveText('عنوان جديد');
		await expect(preview.locator('.katex').first()).toBeVisible();

		await page.getByLabel('معاينة بالصفحات').check();
		await expect(preview.locator('html[data-paged="done"]')).toHaveCount(1, { timeout: 60_000 });
		expect(await preview.locator('.pagedjs_page').count()).toBeGreaterThan(0);

		// The print frame paginates, then opens the print dialog (a no-op in a headless browser).
		await page.getByTestId('md-print').click();
		const printFrame = page.frameLocator('iframe[title="طباعة / حفظ PDF"]');
		await expect(printFrame.locator('html[data-paged="done"]')).toHaveCount(1, { timeout: 60_000 });
	});

	test('the editor page has no serious accessibility problems', async ({ page }) => {
		await page.goto('ar/markdown-to-pdf/');
		await expect(page.frameLocator('[data-testid="md-preview"]').locator('h1')).toBeVisible({ timeout: 30_000 });
		const { violations } = await new AxeBuilder({ page }).exclude('[data-testid="md-preview"]').analyze();
		const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
		expect(serious.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
	});
});
