// Copies runtime assets from node_modules into static/, so the site never calls a CDN.
// Runs before `dev` and `build` (see package.json). The copies are git-ignored.
import { cpSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pdfjs = join(root, 'node_modules', 'pdfjs-dist');
const out = join(root, 'static', 'pdfjs');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const dir of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
	cpSync(join(pdfjs, dir), join(out, dir), { recursive: true });
}
console.log('copy-assets: pdf.js cmaps, fonts, wasm → static/pdfjs');

// Paged.js polyfill (paginates Markdown → PDF before printing); its package hides dist/ from imports.
const paged = join(root, 'static', 'pagedjs');
rmSync(paged, { recursive: true, force: true });
mkdirSync(paged, { recursive: true });
cpSync(join(root, 'node_modules', 'pagedjs', 'dist', 'paged.polyfill.min.js'), join(paged, 'paged.polyfill.min.js'));
console.log('copy-assets: Paged.js → static/pagedjs');

// Tesseract OCR: worker, the four core builds it picks between, and Arabic + English models
// (best_int: about as small as tessdata_fast, more accurate).
const tess = join(root, 'static', 'tesseract');
rmSync(tess, { recursive: true, force: true });
mkdirSync(join(tess, 'lang'), { recursive: true });
cpSync(join(root, 'node_modules', 'tesseract.js', 'dist', 'worker.min.js'), join(tess, 'worker.min.js'));
// Every *.wasm.js build: v7 also picks "relaxedsimd" variants its docs don't list.
const core = join(root, 'node_modules', 'tesseract.js-core');
for (const f of readdirSync(core).filter((n) => /^tesseract-core.*\.wasm\.js$/.test(n))) cpSync(join(core, f), join(tess, f));
for (const l of ['ara', 'eng']) {
	cpSync(join(root, 'node_modules', '@tesseract.js-data', l, '4.0.0_best_int', `${l}.traineddata.gz`), join(tess, 'lang', `${l}.traineddata.gz`));
}
console.log('copy-assets: Tesseract worker, cores, ara+eng models → static/tesseract');
