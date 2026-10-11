import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('office widgets', () => {
	test('invoice: totals, VAT, amount in words and the preview', async ({ page }) => {
		await page.goto('ar/invoice-maker/');
		await page.getByTestId('inv-seller').fill('شركة النور');
		await page.getByTestId('inv-buyer').fill('العميل <b>X</b>');
		await page.getByTestId('inv-desc').fill('صيانة وحدات التكييف');
		await page.getByTestId('inv-qty').fill('2');
		await page.getByTestId('inv-price').fill('500');
		await expect(page.getByTestId('inv-total')).toContainText('EGP');
		await expect(page.getByTestId('inv-total')).toContainText('١٬١٤٠٫٠٠');
		const doc = page.frameLocator('[data-testid="inv-preview"]');
		await expect(doc.locator('h1')).toHaveText('فاتورة ضريبية');
		await expect(doc.locator('.words')).toContainText('فقط ألف ومائة وأربعون جنيهًا مصريًا لا غير');
		await expect(doc.locator('.party')).toContainText('العميل <b>X</b>'); // typed text shown as text
		await expect(doc.locator('.grand')).toContainText('1,140.00 EGP');
	});

	test('password generator: length, count, all character groups', async ({ page }) => {
		await page.goto('en/password-generator/');
		const items = page.getByTestId('passwords').locator('code');
		await expect(items).toHaveCount(1);
		const pw = await items.first().textContent();
		expect(pw).toHaveLength(16);
		expect(pw).toMatch(/[a-z]/);
		expect(pw).toMatch(/[A-Z]/);
		expect(pw).toMatch(/[2-9]/);
		expect(pw).not.toMatch(/[01lIO]/);
		await page.getByLabel('How many').fill('5');
		await expect(items).toHaveCount(5);
	});

	test('tafqeet writes the amount in Arabic and English', async ({ page }) => {
		await page.goto('ar/tafqeet/');
		await expect(page.getByTestId('taf-ar')).toHaveText('فقط ألف وخمسمائة جنيه مصري وخمسون قرشًا لا غير');
		await page.getByTestId('taf-amount').fill('١٠٫٠٣');
		await page.getByLabel('العملة').selectOption('SAR');
		await expect(page.getByTestId('taf-ar')).toHaveText('فقط عشرة ريالات سعودية وثلاث هللات لا غير');
		await expect(page.getByText('Ten Saudi riyals and three halalas only')).toBeVisible();
	});

	test('Hijri ↔ Gregorian both ways', async ({ page }) => {
		await page.goto('en/hijri-date/');
		await page.getByTestId('greg').fill('2023-03-23');
		await expect(page.getByTestId('g2h-out')).toContainText('Ramadan 1, 1444');
		await page.getByTestId('hd').fill('1');
		await page.getByTestId('hm').selectOption('1');
		await page.getByTestId('hy').fill('1446');
		await expect(page.getByTestId('h2g-out')).toContainText('7 July 2024');
	});

	test('Arabic text clean-up', async ({ page }) => {
		await page.goto('ar/arabic-text/');
		await page.getByTestId('ar-in').fill('مُحَمَّدٌ جمـــيل ١٢٣');
		await page.getByLabel('الأرقام').selectOption('western');
		await expect(page.getByTestId('ar-out')).toHaveValue('محمد جميل 123');
	});

	test('VAT: add and extract', async ({ page }) => {
		await page.goto('en/vat-calculator/');
		await page.getByTestId('vat-amount').fill('1000');
		await expect(page.getByTestId('vat-total')).toHaveText('1,140.00');
		await page.getByTestId('vat-mode').selectOption('remove');
		await page.getByTestId('vat-amount').fill('1150');
		await page.getByRole('button', { name: /Saudi Arabia/ }).click();
		await expect(page.getByTestId('vat-net')).toHaveText('1,000.00');
		await expect(page.getByTestId('vat-vat')).toHaveText('150.00');
	});

	for (const path of ['ar/tafqeet/', 'ar/vat-calculator/', 'ar/hijri-date/']) {
		test(`no serious a11y problems on ${path}`, async ({ page }) => {
			await page.goto(path);
			const { violations } = await new AxeBuilder({ page }).analyze();
			expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);
		});
	}
});
