import { expect, test, type Page } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const fx = (p: string) => fileURLToPath(new URL(`../fixtures/${p}`, import.meta.url));
const serverFx = (p: string) => fileURLToPath(new URL(`../../../server/tests/fixtures/${p}`, import.meta.url));

/** Stands in for Chrome's built-in Translator: "[ar] text" — enough to check the document plumbing. */
async function fakeChromeTranslator(page: Page) {
	await page.addInitScript(() => {
		(globalThis as unknown as { Translator: unknown }).Translator = {
			availability: async () => 'available',
			create: async ({ targetLanguage }: { targetLanguage: string }) => ({
				translate: async (s: string) => `[${targetLanguage}] ${s}`,
				destroy() {}
			})
		};
	});
}

async function translateFile(page: Page, path: string, to = 'ar') {
	await page.goto('en/translate-document/');
	await page.getByTestId('tr-from').selectOption(to === 'en' ? 'ar' : 'en');
	await page.getByTestId('tr-to').selectOption(to);
	await page.getByTestId('tr-file').setInputFiles(path);
	await page.getByTestId('tr-go').click();
	await expect(page.getByTestId('tr-result')).toBeVisible({ timeout: 120_000 });
	const dl = page.waitForEvent('download');
	await page.getByTestId('tr-result').getByRole('button').click();
	const file = await dl;
	return { name: file.suggestedFilename(), bytes: readFileSync((await file.path())!) };
}

test.describe('translate documents (Chrome translator mocked)', () => {
	test.beforeEach(({ page }) => fakeChromeTranslator(page));

	test('Word: text replaced paragraph by paragraph, Arabic turns right-to-left, tables flip', async ({ page }) => {
		const out = await translateFile(page, fx('doc/report.docx'));
		expect(out.name).toBe('report-ar.docx');
		const xml = strFromU8(unzipSync(new Uint8Array(out.bytes))['word/document.xml']);
		expect(xml).toContain('[ar] ');
		expect(xml).toContain('<w:bidi/>');
		expect(xml).toContain('<w:rtl/>');
		// pPr stays the first child of every paragraph (Word refuses the file otherwise).
		expect(xml).not.toMatch(/<w:p(?: [^>]*)?>(?:(?!<\/w:p>).)*?<w:r>(?:(?!<\/w:p>).)*?<w:pPr>/s);
	});

	test('PowerPoint and Excel keep their structure', async ({ page }) => {
		const pptx = unzipSync(new Uint8Array((await translateFile(page, serverFx('slides.pptx'), 'en')).bytes));
		const slide = strFromU8(pptx['ppt/slides/slide1.xml']);
		expect(slide).toContain('[en] ');
		const xlsx = unzipSync(new Uint8Array((await translateFile(page, fx('data/sales.xlsx'))).bytes));
		// This workbook keeps its text in the cells (inline strings), not in sharedStrings.xml.
		const sheet = strFromU8(xlsx['xl/worksheets/sheet1.xml']);
		expect(sheet).toContain('[ar] ');
		expect(sheet).toContain('rightToLeft="1"');
	});

	test('pasted text, with a copy button', async ({ page }) => {
		await page.goto('ar/translate-document/');
		await page.getByRole('tab', { name: 'ترجمة نص' }).click();
		await page.getByTestId('tr-input').fill('Hello team');
		await page.getByTestId('tr-go').click();
		await expect(page.getByTestId('tr-output')).toHaveValue('[ar] Hello team');
	});
});

test('the downloadable model really translates English → Arabic (no Chrome translator)', async ({ page }, info) => {
	test.skip(info.project.name !== 'desktop', 'one run is enough (the model is ~110 MB)');
	test.setTimeout(240_000);
	await page.goto('ar/translate-document/');
	await page.getByRole('tab', { name: 'ترجمة نص' }).click();
	await page.getByTestId('tr-input').fill('Please send the invoice before the end of the month. Total: 4,750 EGP.');
	await page.getByTestId('tr-go').click();
	const out = page.getByTestId('tr-output');
	await expect(out).toHaveValue(/[؀-ۿ]{3}/, { timeout: 200_000 });
	const text = await out.inputValue();
	console.log('MT:', text);
	expect(text).toContain('4,750');
	expect(text).toMatch(/فاتورة|الفاتورة/);
});
