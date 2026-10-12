import { expect, test, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const fx = (name: string) => fileURLToPath(new URL(`../fixtures/ai/${name}`, import.meta.url));

async function run(page: Page, tool: string, file: string, setOptions?: () => Promise<void>) {
	page.on('console', (m) => m.type() === 'error' && console.log(m.text().slice(0, 600)));
	await page.goto(`en/${tool}/`);
	await page.getByTestId('file-input').setInputFiles(fx(file));
	if (setOptions) await setOptions();
	const t0 = Date.now();
	await page.getByRole('button', { name: 'Convert', exact: true }).click();
	await expect(page.locator('[data-status="done"]')).toHaveCount(1, { timeout: 240_000 });
	const seconds = (Date.now() - t0) / 1000;
	const dl = page.waitForEvent('download');
	await page.getByRole('button', { name: /^Download (?!all)/ }).first().click();
	const d = await dl;
	const bytes = readFileSync((await d.path())!);
	if (process.env.DUMP) writeFileSync(`${process.env.DUMP}/${d.suggestedFilename()}`, bytes);
	console.log(`${tool} ${file}: ${seconds.toFixed(1)} s`);
	return { name: d.suggestedFilename(), png: await decode(page, bytes) };
}

/** Decodes the PNG in the page; `at(x, y)` gives [r, g, b, a]. */
async function decode(page: Page, bytes: Buffer) {
	const { width, height, data } = await page.evaluate(async (b64) => {
		const blob = await (await fetch('data:image/png;base64,' + b64)).blob();
		const bmp = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
		const c = new OffscreenCanvas(bmp.width, bmp.height);
		const ctx = c.getContext('2d')!;
		ctx.drawImage(bmp, 0, 0);
		return { width: bmp.width, height: bmp.height, data: Array.from(ctx.getImageData(0, 0, bmp.width, bmp.height).data) };
	}, bytes.toString('base64'));
	const at = (x: number, y: number) => {
		const i = (Math.floor(y) * width + Math.floor(x)) * 4;
		return data.slice(i, i + 4);
	};
	return { width, height, alpha: (x: number, y: number) => at(x, y)[3], rgb: (x: number, y: number) => at(x, y).slice(0, 3) };
}

// Big model downloads and minutes of CPU: one browser is enough.
test.describe('on-device image AI', () => {
	test.setTimeout(300_000);

	test.skip(() => test.info().project.name !== 'desktop', 'desktop only');

	test('portrait: the background goes, the person stays', async ({ page }) => {
		const out = await run(page, 'remove-background', 'portrait.jpg');
		expect(out.name).toBe('portrait-no-bg.png');
		const { width, height } = out.png;
		expect([width, height]).toEqual([500, 625]);
		// Top corners are background, the spacesuit is not.
		expect(out.png.alpha(5, 5)).toBeLessThan(40);
		expect(out.png.alpha(width - 5, 5)).toBeLessThan(40);
		expect(out.png.alpha(width * 0.6, height * 0.6)).toBeGreaterThan(200);
	});

	test('"anything" without WebGPU says so instead of running for minutes', async ({ page }) => {
		await page.goto('en/remove-background/');
		await page.getByTestId('file-input').setInputFiles(fx('portrait.jpg'));
		await page.getByLabel('What is in the picture').selectOption('any');
		await page.getByRole('button', { name: 'Convert', exact: true }).click();
		await expect(page.getByText('This option needs a browser with WebGPU')).toBeVisible({ timeout: 30_000 });
	});

	test('a white background for ID photos', async ({ page }) => {
		const out = await run(page, 'remove-background', 'portrait.jpg', async () => {
			await page.getByLabel('New background').selectOption('white');
		});
		expect(out.png.alpha(5, 5)).toBe(255);
		expect(out.png.rgb(5, 5)).toEqual([255, 255, 255]);
	});

	test('upscale ×2 and ×4', async ({ page }) => {
		const x2 = await run(page, 'upscale-image', 'small.png');
		expect([x2.png.width, x2.png.height]).toEqual([250, 312]);
		const x4 = await run(page, 'upscale-image', 'small.png', async () => {
			await page.getByLabel('Enlarge').selectOption('4');
		});
		expect([x4.png.width, x4.png.height]).toEqual([500, 624]);
	});
});
