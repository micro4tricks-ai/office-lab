import type { FileData } from './registry/types';
import { safeEntryName } from './zip-names';

function save(blob: Blob, name: string) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = name;
	document.body.append(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const downloadFile = (f: FileData) =>
	save(new Blob([f.bytes as Uint8Array<ArrayBuffer>], { type: f.type }), f.name);

/** Zips everything (fflate is loaded only when asked) and saves it. */
export async function downloadZip(files: FileData[], name = 'office-lab.zip') {
	const { zipSync } = await import('fflate');
	const entries: Record<string, Uint8Array> = {};
	for (const f of files) {
		// Names can come from inside user files: keep every entry inside the archive.
		const safe = safeEntryName(f.name);
		let n = safe;
		for (let i = 2; n in entries; i++) n = safe.replace(/(\.[^./]+)?$/, ` (${i})$1`);
		entries[n] = f.bytes;
	}
	save(new Blob([zipSync(entries, { level: 6 }) as Uint8Array<ArrayBuffer>], { type: 'application/zip' }), name);
}
