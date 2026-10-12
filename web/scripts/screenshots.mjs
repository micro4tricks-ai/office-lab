// README screenshots → docs/screenshots/*.png, taken from a running build:
//   (build, then) npm run preview  →  node scripts/screenshots.mjs http://localhost:4173/office-lab/
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from '@playwright/test';

const site = process.argv[2] ?? 'http://localhost:4173/office-lab/';
const out = (name) => fileURLToPath(new URL(`../../docs/screenshots/${name}`, import.meta.url));
const fixture = (name) => fileURLToPath(new URL(`../tests/fixtures/${name}`, import.meta.url));
mkdirSync(out(''), { recursive: true });

const browser = await chromium.launch();
const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const page = await desktop.newPage();

await page.goto(site + 'ar/');
await page.screenshot({ path: out('home-ar.png') });

await page.goto(site + 'ar/merge-pdf/');
await page.getByTestId('file-input').setInputFiles([fixture('pdf/text3.pdf'), fixture('pdf/photo.pdf')]);
await page.getByRole('button', { name: 'تحويل', exact: true }).click();
await page.getByRole('button', { name: /^تنزيل (?!الكل)/ }).first().waitFor();
await page.screenshot({ path: out('tool-ar.png') });

await page.goto(site + 'ar/pipelines/');
await page.getByRole('button', { name: /صور الآيفون/ }).click();
await page.screenshot({ path: out('chains-ar.png') });

await page.goto(site + 'en/');
await page.getByRole('button', { name: 'Dark mode' }).click();
await page.screenshot({ path: out('home-en-dark.png') });

const phone = await (await browser.newContext({ ...devices['Pixel 7'] })).newPage();
await phone.goto(site + 'ar/compress-image/');
await phone.screenshot({ path: out('phone-ar.png') });

await browser.close();
console.log('screenshots → docs/screenshots/');
