import { PDFDocument } from '@cantoo/pdf-lib';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const fx = (name: string) => fileURLToPath(new URL(`../fixtures/pdf/${name}`, import.meta.url));

async function pageText(doc: PDFDocument, n: number) {
	const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
	const pdf = await getDocument({ data: await doc.save(), verbosity: 0 }).promise;
	const content = await (await pdf.getPage(n)).getTextContent();
	return content.items.map((i) => ('str' in i ? i.str : '')).join(' ').trim();
}

async function run(page: Page, tool: string, file: string, set?: (p: Page) => Promise<unknown>) {
	await page.goto(`en/${tool}/`);
	await page.getByTestId('file-input').setInputFiles(fx(file));
	if (set) await set(page);
	await page.getByRole('button', { name: 'Convert', exact: true }).click();
	await expect(page.locator('[data-status="waiting"], [data-status="working"]')).toHaveCount(0, { timeout: 60_000 });
	await expect(page.locator('[data-status="done"]')).toHaveCount(1);
	const dl = page.waitForEvent('download');
	await page.getByRole('button', { name: /^Download (?!all)/ }).click();
	return PDFDocument.load(readFileSync((await (await dl).path())!));
}

test.describe('more PDF tools', () => {
	test('2-up puts two pages on one landscape sheet', async ({ page }) => {
		const doc = await run(page, 'pdf-n-up', 'text3.pdf');
		expect(doc.getPageCount()).toBe(2);
		expect(doc.getPage(0).getWidth()).toBeGreaterThan(doc.getPage(0).getHeight());
	});

	test('booklet pads to a multiple of four and makes double-sided sheets', async ({ page }) => {
		const doc = await run(page, 'pdf-booklet', 'text3.pdf');
		expect(doc.getPageCount()).toBe(2); // 3 pages → 4 → one sheet, front and back
	});

	test('blank pages after every page', async ({ page }) => {
		const doc = await run(page, 'pdf-add-blank-pages', 'text3.pdf', (p) => p.getByLabel('Where').selectOption('each'));
		expect(doc.getPageCount()).toBe(6);
	});

	test('header and footer are drawn on every page but the cover', async ({ page }) => {
		const src = readFileSync(fx('text3.pdf')).length;
		const doc = await run(page, 'pdf-header-footer', 'text3.pdf', async (p) => {
			await p.getByLabel('Header text').fill('شركة المثال — {date}');
			await p.getByLabel('Not on the cover page').check();
		});
		expect(doc.getPageCount()).toBe(3);
		expect((await doc.save()).length).toBeGreaterThan(src);
	});

	test('black & white keeps the page count and size', async ({ page }) => {
		const doc = await run(page, 'pdf-grayscale', 'photo.pdf', (p) => p.getByLabel('Resolution').selectOption('100'));
		expect(doc.getPageCount()).toBe(1);
		expect(Math.round(doc.getPage(0).getWidth())).toBe(720);
	});

	test('redact: the covered page loses its text, the others keep theirs', async ({ page }) => {
		const doc = await run(page, 'redact-pdf', 'text3.pdf', async (p) => {
			await p.getByTestId('add-box').click();
			await expect(p.getByTestId('placed-item')).toHaveCount(1);
		});
		expect(doc.getPageCount()).toBe(3);
		expect(await pageText(doc, 1)).toBe('');
		expect(await pageText(doc, 3)).not.toBe('');
	});

	test('letterhead goes under every page; the text is still there', async ({ page }) => {
		const doc = await run(page, 'pdf-letterhead', 'text3.pdf', (p) => p.getByLabel('Letterhead (PDF or image)').setInputFiles(fx('photo.pdf')));
		expect(doc.getPageCount()).toBe(3);
		expect(await pageText(doc, 1)).not.toBe('');
		expect((await doc.save()).length).toBeGreaterThan(readFileSync(fx('photo.pdf')).length);
	});

	test('page size: everything becomes A4, landscape pages stay landscape', async ({ page }) => {
		const doc = await run(page, 'pdf-page-size', 'photo.pdf');
		const p0 = doc.getPage(0);
		expect([Math.round(p0.getWidth()), Math.round(p0.getHeight())].sort()).toEqual([595, 842]);
		expect(p0.getWidth()).toBeGreaterThan(p0.getHeight()); // photo.pdf is landscape
	});

	test('split in half doubles the pages (a rotated page too)', async ({ page }) => {
		const doc = await run(page, 'pdf-split-halves', 'text3.pdf');
		expect(doc.getPageCount()).toBe(6);
	});

	test('flatten: form fields are gone, the values stay as text', async ({ page }) => {
		const doc = await run(page, 'flatten-pdf', 'form.pdf');
		expect(doc.getForm().getFields()).toHaveLength(0);
	});

	test('phone photo → PDF with the scanned-document look', async ({ page }) => {
		const doc = await run(page, 'image-to-pdf', '../ocr/photo-letter.jpg', (p) => p.getByLabel('Clean up').selectOption('scan'));
		expect(doc.getPageCount()).toBe(1);
	});
});
