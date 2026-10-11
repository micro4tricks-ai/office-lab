import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const fx = (name: string) => fileURLToPath(new URL(`../fixtures/images/${name}`, import.meta.url));
const ALL_INPUTS = ['photo.jpg', 'alpha.png', 'photo.webp', 'photo.avif', 'anim.gif', 'photo.bmp', 'photo.tiff', 'logo.svg', 'icon.ico', 'photo.heic', 'photo.jxl'];

const magic = {
	png: [0x89, 0x50, 0x4e, 0x47],
	jpg: [0xff, 0xd8, 0xff],
	ico: [0, 0, 1, 0],
	pdf: [0x25, 0x50, 0x44, 0x46]
};
const starts = (b: Buffer, m: number[]) => m.every((v, i) => b[i] === v);
const pngSize = (b: Buffer) => [b.readUInt32BE(16), b.readUInt32BE(20)];

/** Opens a tool, adds files, applies options, converts, waits for every row to finish. */
async function convert(page: Page, tool: string, files: string[], setOptions?: (p: Page) => Promise<void>) {
	await page.goto(`en/${tool}/`);
	await page.getByTestId('file-input').setInputFiles(files.map(fx));
	if (setOptions) await setOptions(page);
	await page.getByRole('button', { name: 'Convert', exact: true }).click();
	await expect(page.locator('[data-status="waiting"], [data-status="working"]')).toHaveCount(0, { timeout: 90_000 });
}

/** Clicks a result's download button and returns the file's bytes. */
async function grab(page: Page, name: string | RegExp) {
	const dl = page.waitForEvent('download');
	await page.getByRole('button', { name: typeof name === 'string' ? `Download ${name}` : name }).first().click();
	const file = await dl;
	return { name: file.suggestedFilename(), bytes: readFileSync((await file.path())!) };
}

test.describe('image tools', () => {
	test.describe.configure({ timeout: 120_000 });

	test('every input format converts to PNG (orientation applied)', async ({ page }) => {
		await convert(page, 'convert-to-png', ALL_INPUTS);
		await expect(page.locator('[data-status="done"]')).toHaveCount(ALL_INPUTS.length);
		// Rows keep the input order; several inputs share a name (photo.*), so download row by row.
		const rows = page.locator('[data-status="done"]');
		for (const [i, f] of ALL_INPUTS.entries()) {
			const dl = page.waitForEvent('download');
			await rows.nth(i).getByRole('button', { name: /^Download / }).click();
			const out = readFileSync((await (await dl).path())!);
			expect(starts(out, magic.png), f).toBe(true);
			if (f === 'photo.jpg') expect(pngSize(out)).toEqual([128, 96]); // stored sideways, EXIF says rotate
		}
	});

	for (const [tool, ext, check] of [
		['convert-to-jpg', 'jpg', (b: Buffer) => starts(b, magic.jpg)],
		['convert-to-webp', 'webp', (b: Buffer) => b.toString('latin1', 8, 12) === 'WEBP'],
		['convert-to-avif', 'avif', (b: Buffer) => b.toString('latin1', 4, 12).startsWith('ftypavi')],
		['convert-to-ico', 'ico', (b: Buffer) => starts(b, magic.ico)],
		['image-to-pdf', 'pdf', (b: Buffer) => starts(b, magic.pdf)],
		['heic-to-jpg', 'jpg', (b: Buffer) => starts(b, magic.jpg)]
	] as const) {
		test(`${tool} writes ${ext}`, async ({ page }) => {
			const input = tool === 'heic-to-jpg' ? 'photo.heic' : 'alpha.png';
			await convert(page, tool, [input]);
			const out = await grab(page, /^Download /);
			expect(out.name).toBe(input.replace(/\.\w+$/, `.${ext}`));
			expect(check(out.bytes)).toBe(true);
		});
	}

	test('compress shows the saving', async ({ page }) => {
		await convert(page, 'compress-image', ['photo.bmp'], async (p) => {
			await p.getByLabel('Output format').selectOption('jpg');
		});
		const out = await grab(page, 'photo.jpg');
		expect(starts(out.bytes, magic.jpg)).toBe(true);
		expect(out.bytes.length).toBeLessThan(readFileSync(fx('photo.bmp')).length);
		await expect(page.locator('.pct.down')).toBeVisible();
	});

	test('resize by pixels and to a target size in KB', async ({ page }) => {
		await convert(page, 'resize-image', ['alpha.png'], async (p) => {
			await p.getByLabel('Max width').fill('64');
		});
		expect(pngSize((await grab(page, 'alpha.png')).bytes)).toEqual([64, 48]);

		// The default max width (1280) must not enlarge a small image.
		await convert(page, 'resize-image', ['alpha.png']);
		expect(pngSize((await grab(page, 'alpha.png')).bytes)).toEqual([128, 96]);

		await convert(page, 'resize-image', ['photo.bmp'], async (p) => {
			await p.getByLabel('Resize by').selectOption('kb');
			await p.getByLabel('Target size').fill('3');
			await p.getByLabel('Output format').selectOption('jpg');
		});
		const small = await grab(page, 'photo.jpg');
		expect(small.bytes.length).toBeLessThanOrEqual(3 * 1024);
	});

	test('crop & rotate', async ({ page }) => {
		await convert(page, 'crop-rotate-image', ['alpha.png'], async (p) => {
			await p.getByLabel('Rotate').selectOption('90');
			await p.getByLabel('Crop to ratio (centred)').selectOption('1:1');
		});
		expect(pngSize((await grab(page, 'alpha.png')).bytes)).toEqual([96, 96]);
	});

	test('remove metadata (JPEG with GPS + rotation, PNG text)', async ({ page }) => {
		await convert(page, 'remove-image-metadata', ['photo.jpg', 'meta.png']);
		await expect(page.getByText('Metadata removed and rotation applied')).toBeVisible();
		await expect(page.getByText('Metadata (EXIF/location) removed')).toBeVisible();
		const jpg = await grab(page, 'photo.jpg');
		expect(jpg.bytes.includes('Exif')).toBe(false);
		expect(jpg.bytes.includes('FixtureCam')).toBe(false);
		const png = await grab(page, 'meta.png');
		expect(png.bytes.includes('Fixture Person')).toBe(false);
	});

	test('watermark: Arabic text, and a logo that must be chosen first', async ({ page }) => {
		await convert(page, 'watermark-image', ['photo.webp'], async (p) => {
			await p.getByLabel('Text', { exact: true }).fill('سري للغاية');
			await p.getByLabel('Position').selectOption('tile');
		});
		const out = await grab(page, 'photo.webp');
		expect(out.bytes.equals(readFileSync(fx('photo.webp')))).toBe(false);

		await page.goto('en/watermark-image/');
		await page.getByTestId('file-input').setInputFiles(fx('photo.jpg'));
		await page.getByLabel('Watermark').selectOption('logo');
		await page.getByRole('button', { name: 'Convert', exact: true }).click();
		await expect(page.getByRole('alert')).toHaveText('Choose the logo image first.');
		await page.getByLabel('Logo image').setInputFiles(fx('logo.svg'));
		await page.getByRole('button', { name: 'Convert', exact: true }).click();
		await expect(page.locator('[data-status="done"]')).toHaveCount(1, { timeout: 60_000 });
	});

	test('favicon pack has every file', async ({ page }) => {
		await convert(page, 'favicon-generator', ['alpha.png']);
		for (const name of ['favicon.ico', 'favicon-16x16.png', 'favicon-32x32.png', 'apple-touch-icon.png', 'android-chrome-192x192.png', 'android-chrome-512x512.png', 'site.webmanifest', 'favicon-snippet.html']) {
			await expect(page.getByRole('button', { name: `Download ${name}` })).toBeVisible();
		}
		expect(starts((await grab(page, 'favicon.ico')).bytes, magic.ico)).toBe(true);
		expect(pngSize((await grab(page, 'android-chrome-512x512.png')).bytes)).toEqual([512, 512]);
		const dl = page.waitForEvent('download');
		await page.getByRole('button', { name: 'Download all (ZIP)' }).click();
		expect((await dl).suggestedFilename()).toBe('office-lab.zip');
	});

	test('image to SVG', async ({ page }) => {
		await convert(page, 'image-to-svg', ['alpha.png']);
		const out = await grab(page, 'alpha.svg');
		expect(out.bytes.toString('utf8')).toContain('<svg');
		expect(out.bytes.toString('utf8')).toContain('<path');
	});

	test('a broken image gives a clear Arabic error', async ({ page }) => {
		await page.goto('ar/convert-to-png/');
		await page.getByTestId('file-input').setInputFiles([fx('broken.jpg'), fx('photo.jpg')]);
		await page.getByRole('button', { name: 'تحويل', exact: true }).click();
		await expect(page.locator('[data-status="done"]')).toHaveCount(1, { timeout: 60_000 });
		await expect(page.getByRole('alert')).toContainText('الملف تالف');
	});
});

test('20-image batch on a slow phone keeps the page responsive', async ({ page }, info) => {
	test.skip(info.project.name !== 'mobile', 'phone-only check');
	test.setTimeout(180_000);
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
	await page.goto('ar/compress-image/');
	const jpg = readFileSync(fx('photo.jpg'));
	const files = Array.from({ length: 20 }, (_, i) => ({ name: `photo-${i + 1}.jpg`, mimeType: 'image/jpeg', buffer: jpg }));
	await page.getByTestId('file-input').setInputFiles(files);
	await page.evaluate(() => {
		(window as unknown as { longest: number }).longest = 0;
		new PerformanceObserver((list) => {
			for (const e of list.getEntries()) {
				const w = window as unknown as { longest: number };
				w.longest = Math.max(w.longest, e.duration);
			}
		}).observe({ type: 'longtask', buffered: false });
	});
	const started = Date.now();
	await page.getByRole('button', { name: 'تحويل', exact: true }).click();
	// The page must still react while the workers are busy.
	await page.getByRole('button', { name: /الوضع/ }).click();
	await expect(page.locator('[data-status="done"]')).toHaveCount(20, { timeout: 150_000 });
	const longest = await page.evaluate(() => (window as unknown as { longest: number }).longest);
	console.log(`20 images in ${Date.now() - started} ms; longest main-thread task ${Math.round(longest)} ms (4x CPU throttling)`);
	expect(longest).toBeLessThan(1000);
});
