// Regenerates the OCR fixtures: text drawn by Chromium (system Arabic font), saved as a
// grayscale PNG, plus the same image inside a PDF ("a scan"). Run from web/:
//   node tests/fixtures/ocr/make_fixtures.mjs
import { PDFDocument } from '@cantoo/pdf-lib';
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const here = new URL('.', import.meta.url);
const lines = readFileSync(new URL('arabic.txt', here), 'utf8').trim().split('\n');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 300 }, deviceScaleFactor: 1 });
await p.setContent(`<html dir="rtl"><body style="margin:0;padding:28px 36px;background:#fff;color:#111;font:30px/1.9 Arial,'Segoe UI',sans-serif">${lines.map((l) => `<div>${l}</div>`).join('')}</body></html>`);
const png = await p.screenshot({ fullPage: true });
await b.close();
writeFileSync(new URL('arabic.png', here), png);

const doc = await PDFDocument.create();
const img = await doc.embedPng(png);
doc.addPage([img.width * 0.75, img.height * 0.75]).drawImage(img, { x: 0, y: 0, width: img.width * 0.75, height: img.height * 0.75 });
writeFileSync(new URL('scan.pdf', here), await doc.save());
console.log('ocr fixtures written');
