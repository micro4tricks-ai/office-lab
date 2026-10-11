import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const fx = (name: string) => fileURLToPath(new URL(`../fixtures/ocr/${name}`, import.meta.url));
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Share of characters right: 1 − edit distance / length of the expected text. */
function accuracy(expected: string, got: string) {
	const a = [...norm(expected)];
	const b = [...norm(got)];
	let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
	for (let i = 1; i <= a.length; i++) {
		const row = [i];
		for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
		prev = row;
	}
	return 1 - prev[b.length] / a.length;
}

async function ocr(page: Page, tool: string, file: string, output: 'txt' | 'pdf') {
	await page.goto(`en/${tool}/`);
	await page.getByTestId('file-input').setInputFiles(fx(file));
	await page.getByLabel('Text language').selectOption('ara');
	await page.getByLabel('Output').selectOption(output);
	await page.getByRole('button', { name: 'Convert', exact: true }).click();
	await expect(page.locator('[data-status="waiting"], [data-status="working"]')).toHaveCount(0, { timeout: 150_000 });
	await expect(page.locator('[data-status="done"]')).toHaveCount(1);
	const dl = page.waitForEvent('download');
	await page.getByRole('button', { name: /^Download (?!all)/ }).click();
	return readFileSync((await (await dl).path())!);
}

test.describe('OCR', () => {
	test.describe.configure({ timeout: 180_000 });
	test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'one run is enough (OCR is slow)'));

	test('Arabic image → text, at least 85% of characters right', async ({ page }) => {
		const text = (await ocr(page, 'ocr-image', 'arabic.png', 'txt')).toString('utf8');
		const score = accuracy(readFileSync(fx('arabic.txt'), 'utf8'), text);
		console.log(`OCR accuracy: ${(score * 100).toFixed(1)}%\n${text}`);
		expect(score).toBeGreaterThanOrEqual(0.85);
	});

	test('scanned PDF → searchable PDF (the words can be found)', async ({ page }) => {
		const pdf = await ocr(page, 'ocr-pdf', 'scan.pdf', 'pdf');
		const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
		const doc = await getDocument({ data: new Uint8Array(pdf), verbosity: 0 }).promise;
		const content = await (await doc.getPage(1)).getTextContent();
		const text = content.items.map((i) => ('str' in i ? i.str : '')).join(' ');
		expect(text).toContain('الصيانة');
		expect(text).toContain('التكييف');
	});
});
