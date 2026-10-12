// Downloads the translation models (OPUS-MT en↔ar, Apache-2.0, ONNX q8 by Xenova) into static/models/,
// pinned to a revision and checked against SHA-256 — the site then serves them itself (no runtime CDN).
// Runs before dev/build; files already present and correct are skipped.
//   node scripts/fetch-models.mjs            (fills in missing hashes with --update)
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(root, 'scripts', 'models.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const update = process.argv.includes('--update');
const sha = (buf) => createHash('sha256').update(buf).digest('hex');

let changed = false;
for (const [repo, { revision, files }] of Object.entries(manifest)) {
	for (const [file, hash] of Object.entries(files)) {
		const dest = join(root, 'static', 'models', repo, file);
		if (existsSync(dest) && hash && sha(readFileSync(dest)) === hash) continue;
		const url = `https://huggingface.co/${repo}/resolve/${revision}/${file}`;
		const res = await fetch(url);
		if (!res.ok) throw new Error(`${url}: ${res.status}`);
		const buf = Buffer.from(await res.arrayBuffer());
		const got = sha(buf);
		if (hash && got !== hash) throw new Error(`${repo}/${file}: sha256 ${got} ≠ ${hash}`);
		if (!hash) {
			if (!update) throw new Error(`${repo}/${file}: no hash in models.json (run with --update once)`);
			files[file] = got;
			changed = true;
		}
		mkdirSync(dirname(dest), { recursive: true });
		writeFileSync(dest, buf);
		console.log(`model ${repo}/${file} (${(buf.length / 1e6).toFixed(1)} MB)`);
	}
}
if (changed) writeFileSync(manifestPath, JSON.stringify(manifest, null, '\t') + '\n');
