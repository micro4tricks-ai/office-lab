import { PDFDocument, StandardFonts } from '@cantoo/pdf-lib';
import { expect, test, type Page } from '@playwright/test';
import { unzipSync } from 'fflate';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const fx = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));
const pdf = (name: string) => fx(`pdf/${name}`);
const open = (b: Buffer, password?: string) => PDFDocument.load(b, { password, updateMetadata: false });

async function run(page: Page, tool: string, files: (string | { name: string; mimeType: string; buffer: Buffer })[], setOptions?: (p: Page) => Promise<unknown>) {
	await page.goto(`en/${tool}/`);
	await page.getByTestId('file-input').setInputFiles(files as string[]);
	if (setOptions) await setOptions(page);
	await page.getByRole('button', { name: 'Convert', exact: true }).click();
	await expect(page.locator('[data-status="waiting"], [data-status="working"]')).toHaveCount(0, { timeout: 120_000 });
}

/** Downloads one result (by file name) or, with no name, the only/first result. */
async function grab(page: Page, name?: string) {
	const dl = page.waitForEvent('download');
	await page.getByRole('button', { name: name ? `Download ${name}` : /^Download (?!all)/ }).first().click();
	const file = await dl;
	return { name: file.suggestedFilename(), bytes: readFileSync((await file.path())!) };
}

async function grabZip(page: Page) {
	const dl = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Download all (ZIP)' }).click();
	return Object.entries(unzipSync(readFileSync((await (await dl).path())!)));
}

test.describe('pdf tools', () => {
	test.describe.configure({ timeout: 120_000 });

	test('merge in the chosen order', async ({ page }) => {
		await page.goto('en/merge-pdf/');
		await page.getByTestId('file-input').setInputFiles([pdf('text3.pdf'), pdf('photo.pdf')]);
		await page.getByRole('button', { name: 'Move photo.pdf up' }).click();
		await page.getByRole('button', { name: 'Convert', exact: true }).click();
		const doc = await open((await grab(page)).bytes);
		expect(doc.getPageCount()).toBe(4);
		expect(doc.getPage(0).getWidth()).toBe(720); // photo.pdf moved first
	});

	test('merge needs at least two files', async ({ page }) => {
		await page.goto('en/merge-pdf/');
		await page.getByTestId('file-input').setInputFiles([pdf('text3.pdf')]);
		await page.getByRole('button', { name: 'Convert', exact: true }).click();
		await expect(page.getByRole('alert')).toContainText('at least 2');
	});

	test('split by ranges', async ({ page }) => {
		await run(page, 'split-pdf', [pdf('text3.pdf')], async (p) => {
			await p.getByLabel('Ranges (one file each)').fill('1, 2-3');
		});
		expect((await open((await grab(page, 'text3-p1.pdf')).bytes)).getPageCount()).toBe(1);
		expect((await open((await grab(page, 'text3-p2-3.pdf')).bytes)).getPageCount()).toBe(2);
	});

	test('extract, delete, rotate', async ({ page }) => {
		await run(page, 'extract-pdf-pages', [pdf('text3.pdf')], (p) => p.getByLabel('Pages').fill('3,1'));
		expect((await open((await grab(page)).bytes)).getPageCount()).toBe(2);

		await run(page, 'delete-pdf-pages', [pdf('text3.pdf')], (p) => p.getByLabel('Pages').fill('2'));
		expect((await open((await grab(page)).bytes)).getPageCount()).toBe(2);

		await run(page, 'rotate-pdf', [pdf('text3.pdf')]);
		const rotated = await open((await grab(page)).bytes);
		expect(rotated.getPages().map((p) => p.getRotation().angle)).toEqual([90, 180, 90]);
	});

	test('bad page numbers give a clear error', async ({ page }) => {
		await run(page, 'extract-pdf-pages', [pdf('text3.pdf')], (p) => p.getByLabel('Pages').fill('9'));
		await expect(page.getByRole('alert')).toContainText("page numbers don't fit");
	});

	test('crop margins', async ({ page }) => {
		await run(page, 'crop-pdf', [pdf('text3.pdf')]);
		const box = (await open((await grab(page)).bytes)).getPage(0).getCropBox();
		expect(Math.round(box.width)).toBe(Math.round(595 - (2 * 10 * 72) / 25.4));
	});

	test('page numbers and watermark change the pages', async ({ page }) => {
		const src = readFileSync(pdf('text3.pdf'));
		await run(page, 'pdf-page-numbers', [pdf('text3.pdf')], (p) => p.getByLabel('Digits').selectOption('arabic'));
		const numbered = (await grab(page)).bytes;
		expect(numbered.length).toBeGreaterThan(src.length);
		expect((await open(numbered)).getPageCount()).toBe(3);

		await run(page, 'watermark-pdf', [pdf('text3.pdf')], async (p) => {
			await p.getByLabel('Text', { exact: true }).fill('سري للغاية');
			await p.getByLabel('Position').selectOption('tile');
		});
		expect((await grab(page)).bytes.length).toBeGreaterThan(src.length);
	});

	test('images to one PDF', async ({ page }) => {
		await run(page, 'image-to-pdf', [fx('images/alpha.png'), fx('images/photo.jpg')]);
		const doc = await open((await grab(page)).bytes);
		expect(doc.getPageCount()).toBe(2);
		expect(Math.round(doc.getPage(0).getWidth())).toBe(842); // A4, landscape for a wide image
	});

	test('PDF to images at 72 DPI', async ({ page }) => {
		await run(page, 'pdf-to-image', [pdf('text3.pdf')], (p) => p.getByLabel('Resolution').selectOption('72'));
		const entries = await grabZip(page);
		expect(entries.map(([n]) => n)).toEqual(['text3-p1.jpg', 'text3-p2.jpg', 'text3-p3.jpg']);
		expect(Buffer.from(entries[0][1]).subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))).toBe(true);
	});

	test('extract images and text', async ({ page }) => {
		await run(page, 'extract-pdf-images', [pdf('photo.pdf')]);
		const png = (await grab(page)).bytes;
		expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([960, 720]);

		await run(page, 'pdf-to-text', [pdf('text3.pdf')]);
		const text = (await grab(page)).bytes.toString('utf8');
		expect(text).toContain('Invoice total is 1500 pounds.');
		expect(text).toContain('--- 3 ---');
	});

	test('compress makes a photo PDF smaller', async ({ page }) => {
		await run(page, 'compress-pdf', [pdf('photo.pdf')], (p) => p.getByLabel('Compression').selectOption('strong'));
		const out = (await grab(page)).bytes;
		expect(out.length).toBeLessThan(readFileSync(pdf('photo.pdf')).length);
		expect((await open(out)).getPageCount()).toBe(1);
	});

	test('compare two versions', async ({ page }) => {
		await run(page, 'compare-pdf', [pdf('text3.pdf'), pdf('text3-changed.pdf')]);
		const html = (await grab(page, 'compare-report.html')).bytes.toString('utf8');
		expect(html).toContain('<del>1500</del>');
		expect(html).toContain('<ins>1750</ins>');
	});

	test('protect, then unlock', async ({ page }) => {
		await run(page, 'protect-pdf', [pdf('text3.pdf')], (p) => p.getByLabel('Password').fill('s3cret'));
		const locked = (await grab(page)).bytes;
		await expect(open(locked)).rejects.toThrow();
		expect((await open(locked, 's3cret')).getPageCount()).toBe(3);

		await run(page, 'unlock-pdf', [pdf('locked.pdf')], (p) => p.getByLabel('Password (if any)').fill('1234'));
		expect((await open((await grab(page)).bytes)).getPageCount()).toBe(1);

		await run(page, 'unlock-pdf', [pdf('locked.pdf')], (p) => p.getByLabel('Password (if any)').fill('wrong'));
		await expect(page.getByRole('alert')).toContainText('password-protected');
	});

	test('a locked file in another tool asks for the password', async ({ page }) => {
		await run(page, 'rotate-pdf', [pdf('locked.pdf')]);
		await expect(page.getByRole('alert')).toContainText('password-protected');
	});

	test('edit and wipe metadata', async ({ page }) => {
		await run(page, 'pdf-metadata', [pdf('text3.pdf')], (p) => p.getByLabel('Title').fill('عقد صيانة 2026'));
		expect((await open((await grab(page)).bytes)).getTitle()).toBe('عقد صيانة 2026');

		await run(page, 'pdf-metadata', [pdf('text3.pdf')], (p) => p.getByLabel('Remove all metadata').check());
		const wiped = await open((await grab(page)).bytes);
		expect(wiped.getAuthor() ?? '').toBe('');
	});
});

test('merging a 200-page PDF keeps the page responsive', async ({ page }, info) => {
	test.skip(info.project.name !== 'desktop', 'one run is enough');
	test.setTimeout(180_000);
	const doc = await PDFDocument.create();
	const font = await doc.embedFont(StandardFonts.Helvetica);
	for (let i = 1; i <= 200; i++) doc.addPage([595, 842]).drawText(`Page ${i}`, { x: 60, y: 760, size: 28, font });
	const big = Buffer.from(await doc.save());

	await page.goto('en/merge-pdf/');
	await page.getByTestId('file-input').setInputFiles([
		{ name: 'big-200.pdf', mimeType: 'application/pdf', buffer: big },
		{ name: 'text3.pdf', mimeType: 'application/pdf', buffer: readFileSync(pdf('text3.pdf')) }
	]);
	await page.evaluate(() => {
		const w = window as unknown as { longest: number };
		w.longest = 0;
		new PerformanceObserver((l) => l.getEntries().forEach((e) => (w.longest = Math.max(w.longest, e.duration)))).observe({ type: 'longtask' });
	});
	const t0 = Date.now();
	await page.getByRole('button', { name: 'Convert', exact: true }).click();
	await page.getByRole('button', { name: /mode/ }).click(); // the page still reacts while merging
	await expect(page.locator('[data-status="done"]')).toHaveCount(1, { timeout: 150_000 });
	const longest = await page.evaluate(() => (window as unknown as { longest: number }).longest);
	console.log(`200+3 pages merged in ${Date.now() - t0} ms; longest main-thread task ${Math.round(longest)} ms`);
	expect((await open((await grab(page)).bytes)).getPageCount()).toBe(203);
	expect(longest).toBeLessThan(500);
});

/** All text on the pages, read with pdf.js (as a reader would see it). */
async function pdfText(bytes: Buffer) {
	const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
	const doc = await getDocument({ data: new Uint8Array(bytes), verbosity: 0 }).promise;
	let text = '';
	for (let n = 1; n <= doc.numPages; n++) {
		const content = await (await doc.getPage(n)).getTextContent();
		text += content.items.map((i) => ('str' in i ? i.str : '')).join(' ') + '\n';
	}
	return text;
}

/** How many images each page draws (XObjects in its resources). */
async function imagesPerPage(bytes: Buffer) {
	const { PDFName, PDFDict } = await import('@cantoo/pdf-lib');
	const doc = await open(bytes);
	return doc.getPages().map((p) => {
		const xo = p.node.Resources()?.lookup(PDFName.of('XObject'), PDFDict);
		return xo ? xo.keys().length : 0;
	});
}

test.describe('interactive pdf editors', () => {
	test.describe.configure({ timeout: 120_000 });

	test('organize: delete, reorder, rotate', async ({ page }) => {
		await page.goto('en/organize-pdf/');
		await page.getByTestId('file-input').setInputFiles(pdf('text3.pdf'));
		await expect(page.getByTestId('page-card')).toHaveCount(3, { timeout: 30_000 });
		await page.getByRole('button', { name: 'Delete Page 2' }).click();
		await page.getByRole('button', { name: 'Move Page 3 earlier' }).click();
		await page.getByRole('button', { name: 'Rotate Page 1 right' }).click();
		await page.getByRole('button', { name: 'Convert', exact: true }).click();
		const doc = await open((await grab(page)).bytes);
		expect(doc.getPageCount()).toBe(2);
		expect(doc.getPages().map((p) => p.getRotation().angle)).toEqual([0, 90]);
	});

	test('sign: draw, type in Ruqaa, date — and one on every page', async ({ page }) => {
		await page.goto('ar/sign-pdf/');
		await page.getByTestId('file-input').setInputFiles(pdf('text3.pdf'));
		await expect(page.getByRole('img', { name: 'صفحة 1 من 3' })).toBeVisible({ timeout: 30_000 });

		await page.getByRole('button', { name: 'ارسم التوقيع' }).click();
		const pad = await page.getByTestId('sign-pad').boundingBox();
		await page.mouse.move(pad!.x + 40, pad!.y + 60);
		await page.mouse.down();
		for (let i = 1; i <= 10; i++) await page.mouse.move(pad!.x + 40 + i * 25, pad!.y + 60 + (i % 2) * 30);
		await page.mouse.up();
		await page.getByRole('button', { name: 'إضافة للصفحة' }).click();

		await page.getByRole('button', { name: 'اكتب التوقيع' }).click();
		await page.getByLabel('اسمك').fill('أحمد علي');
		await page.getByRole('button', { name: 'إضافة للصفحة' }).click();
		await page.getByLabel('على كل الصفحات').check();

		await page.getByRole('button', { name: 'تاريخ اليوم' }).click();
		await expect(page.getByTestId('placed-item')).toHaveCount(3);

		// Nudge the date with the keyboard.
		await page.getByTestId('placed-item').last().press('ArrowUp');
		await page.getByRole('button', { name: 'تحويل', exact: true }).click();
		const dl = page.waitForEvent('download');
		await page.getByRole('button', { name: /^تنزيل/ }).click();
		const counts = await imagesPerPage(readFileSync((await (await dl).path())!));
		expect(counts).toEqual([3, 1, 1]); // drawn + typed + date on page 1; typed on every page
	});

	test('fill a form in Arabic: flattened and editable', async ({ page }) => {
		const fill = async (flatten: boolean) => {
			await page.goto('en/fill-pdf-form/');
			await page.getByTestId('file-input').setInputFiles(pdf('form.pdf'));
			await page.getByLabel('name', { exact: true }).fill('أحمد علي');
			await page.getByLabel('city', { exact: true }).fill('Cairo');
			await page.getByLabel('agree').check();
			await page.getByLabel('kind').selectOption('Visit');
			if (!flatten) await page.getByLabel('Flatten (values can no longer be edited)').uncheck();
			await page.getByRole('button', { name: 'Convert', exact: true }).click();
			return (await grab(page)).bytes;
		};
		const flat = await fill(true);
		expect((await open(flat)).getForm().getFields()).toHaveLength(0);
		// Latin values become real text; the Arabic one is drawn as an image — never as "????".
		const text = await pdfText(flat);
		expect(text).toContain('Cairo');
		expect(text).not.toContain('?');

		const editable = await open(await fill(false));
		const form = editable.getForm();
		expect(form.getTextField('name').getText()).toBe('أحمد علي');
		expect(form.getTextField('city').getText()).toBe('Cairo');
		expect(form.getCheckBox('agree').isChecked()).toBe(true);
		expect(form.getDropdown('kind').getSelected()).toEqual(['Visit']);
	});

	test('a PDF without a form says so', async ({ page }) => {
		await page.goto('en/fill-pdf-form/');
		await page.getByTestId('file-input').setInputFiles(pdf('text3.pdf'));
		await expect(page.getByRole('alert')).toHaveText('This file has no fillable form fields.');
	});

	test('edit: Arabic text and an image', async ({ page }) => {
		await page.goto('en/edit-pdf/');
		await page.getByTestId('file-input').setInputFiles(pdf('text3.pdf'));
		await expect(page.getByRole('img', { name: 'Page 1 of 3' })).toBeVisible({ timeout: 30_000 });
		await page.getByRole('button', { name: 'Convert', exact: true }).click();
		await expect(page.getByRole('alert')).toHaveText('Add at least one item first.');

		await page.getByRole('button', { name: 'Text', exact: true }).click();
		await page.getByLabel('Text', { exact: true }).fill('تمت المراجعة');
		await page.getByRole('button', { name: 'Add to page' }).click();
		await page.getByRole('button', { name: 'Next page' }).click();
		await page.getByTestId('place-image').setInputFiles(fx('images/logo.svg'));
		await page.getByRole('button', { name: 'Convert', exact: true }).click();
		expect(await imagesPerPage((await grab(page)).bytes)).toEqual([1, 1, 0]);
	});
});
