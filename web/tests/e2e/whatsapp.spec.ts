import { expect, test, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const fx = (name: string) => fileURLToPath(new URL(`../fixtures/whatsapp/${name}`, import.meta.url));

async function toPdf(page: Page, lang: 'ar' | 'en', file: string, me = '') {
	await page.goto(`${lang}/whatsapp-to-pdf/`);
	await page.getByTestId('file-input').setInputFiles(fx(file));
	if (me) await page.getByRole('textbox').first().fill(me);
	await page.getByRole('button', { name: lang === 'ar' ? 'تحويل' : 'Convert', exact: true }).click();
	await expect(page.locator('[data-status="done"]')).toHaveCount(1, { timeout: 60_000 });
	const dl = page.waitForEvent('download');
	await page.getByRole('button', { name: /^(Download|تنزيل) (?!all|الكل)/ }).first().click();
	const d = await dl;
	const bytes = readFileSync((await d.path())!);
	// DUMP=<folder> keeps the PDFs to look at.
	if (process.env.DUMP) writeFileSync(`${process.env.DUMP}/${lang}-${d.suggestedFilename()}`, bytes);
	return { name: d.suggestedFilename(), bytes };
}

async function pdfText(bytes: Buffer) {
	const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
	const doc = await getDocument({ data: new Uint8Array(bytes), verbosity: 0 }).promise;
	const pages: string[] = [];
	for (let n = 1; n <= doc.numPages; n++) {
		const content = await (await doc.getPage(n)).getTextContent();
		pages.push(content.items.map((i) => ('str' in i ? i.str : '')).join(' '));
	}
	return pages;
}

test.describe('WhatsApp chat to PDF', () => {
	test('an Arabic Android export becomes a searchable, paged PDF', async ({ page }) => {
		const out = await toPdf(page, 'ar', 'محادثة واتساب مع فريق الصيانة.txt', 'أحمد');
		expect(out.name).toBe('محادثة واتساب مع فريق الصيانة.pdf');
		const pages = await pdfText(out.bytes);
		expect(pages.length).toBeGreaterThan(1);
		const all = pages.join(' ');
		expect(all).toContain('فريق الصيانة');
		expect(all).toContain('رسالة رقم');
		expect(all).toContain('INV-2026');
		expect(pages[0]).toContain('صفحة');
	});

	test('an iPhone ZIP keeps the photo and the chat name', async ({ page }) => {
		const out = await toPdf(page, 'en', 'WhatsApp Chat - Office Team.zip');
		expect(out.name).toBe('WhatsApp Chat - Office Team.pdf');
		const [first] = await pdfText(out.bytes);
		expect(first).toContain('WhatsApp chat: Office Team');
		expect(first).toContain('Here is the site photo');
		// The page is one picture; the chat photo is drawn into it, not left as "attached file".
		expect(first).not.toContain('attached file');
	});

	test('a text file that is not a chat is refused', async ({ page }) => {
		await page.goto('en/whatsapp-to-pdf/');
		await page.getByTestId('file-input').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('just some notes') });
		await page.getByRole('button', { name: 'Convert', exact: true }).click();
		await expect(page.getByText("This file type isn't supported by this tool.")).toBeVisible({ timeout: 30_000 });
	});
});
