import { expect, test, type Page } from '@playwright/test';

/** Waits until the service worker controls the page (it claims clients when it activates). */
async function controlled(page: Page) {
	await page.waitForFunction(async () => {
		await navigator.serviceWorker.ready;
		return !!navigator.serviceWorker.controller;
	});
}

test('the manifest makes the site installable, with a share target', async ({ page, request }) => {
	await page.goto('ar/');
	const href = await page.locator('link[rel="manifest"]').getAttribute('href');
	const url = new URL(href!, page.url()).href;
	const manifest = await (await request.get(url)).json();
	expect(manifest).toMatchObject({ display: 'standalone', lang: 'ar', dir: 'rtl', short_name: 'المعمل' });
	expect(manifest.start_url).toMatch(/\/$/);
	for (const icon of manifest.icons) expect((await request.get(new URL(icon.src, url).href)).ok(), icon.src).toBe(true);
	expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
	expect(manifest.share_target.params.files[0].accept).toEqual(expect.arrayContaining(['application/pdf', 'image/*', '.docx']));
	await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#0f6e66');
});

test('a page visited once opens offline', async ({ page, context }) => {
	await page.goto('en/compress-image/');
	await controlled(page);
	await page.reload(); // now through the service worker, which keeps a copy
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	await context.setOffline(true);
	await page.reload();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Compress/);
	await context.setOffline(false);
});

test('"all tools offline" saves every browser tool', async ({ page, context }, info) => {
	test.skip(info.project.name !== 'desktop', 'one run is enough (downloads ~30 MB)');
	test.setTimeout(180_000);
	await page.goto('en/about/');
	await controlled(page);
	await page.getByRole('button', { name: 'Make all tools work offline' }).click();
	await expect(page.getByText('Done: every browser tool now works offline.')).toBeVisible({ timeout: 150_000 });

	await context.setOffline(true);
	// A tool page never opened before: comes from the saved copy, and its engine runs.
	await page.goto('ar/txt-to-html/');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('نص إلى HTML');
	await page.getByTestId('file-input').setInputFiles({ name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('مرحبا') });
	await page.getByRole('button', { name: 'تحويل', exact: true }).click();
	await expect(page.getByRole('button', { name: /تنزيل a\.html/ })).toBeVisible();
	await context.setOffline(false);
});

test('files from the Share menu reach the chosen tool', async ({ page }) => {
	await page.goto('en/');
	await controlled(page);
	await page.reload(); // a page claimed mid-visit may still send some requests past the worker
	// What the phone does: a multipart POST to the share target, answered by the service worker.
	const landed = await page.evaluate(async () => {
		const form = new FormData();
		form.append('files', new File(['hello'], 'note.txt', { type: 'text/plain' }));
		const res = await fetch(new URL('../share-target/', location.href), { method: 'POST', body: form });
		return res.url;
	});
	expect(landed).toMatch(/\/share\/$/);
	await page.goto('en/share/');
	await expect(page.getByTestId('shared-files')).toContainText('note.txt');
	await page.getByRole('link', { name: /Text to HTML/ }).click();
	await expect(page).toHaveURL(/\/en\/txt-to-html\/$/);
	await expect(page.getByText('note.txt')).toBeVisible();
});

test('the share page explains when nothing was shared', async ({ page }) => {
	await page.goto('ar/share/');
	await expect(page.getByText('لا توجد ملفات مُشارَكة الآن.', { exact: false })).toBeVisible();
});
