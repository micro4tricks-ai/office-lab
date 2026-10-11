// Copies runtime assets from node_modules into static/, so the site never calls a CDN.
// Runs before `dev` and `build` (see package.json). The copies are git-ignored.
import { cpSync, mkdirSync, rmSync } from 'node:fs';
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
