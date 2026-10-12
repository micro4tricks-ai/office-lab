import { unzlibSync } from 'fflate';

/**
 * WOFF 1.0 → plain TrueType/OpenType bytes. PDF readers want the raw font (FontFile2): a WOFF
 * embedded as-is renders in pdf.js but not in Acrobat or MuPDF. The tables are only zlib-packed.
 */
export function woffToSfnt(woff: Uint8Array): Uint8Array {
	const v = new DataView(woff.buffer, woff.byteOffset, woff.byteLength);
	if (v.getUint32(0) !== 0x774f4646) return woff; // not 'wOFF': already a TTF/OTF
	const flavor = v.getUint32(4);
	const numTables = v.getUint16(12);
	const tables: { tag: number; checksum: number; data: Uint8Array }[] = [];
	for (let i = 0; i < numTables; i++) {
		const at = 44 + i * 20;
		const tag = v.getUint32(at);
		const offset = v.getUint32(at + 4);
		const compLength = v.getUint32(at + 8);
		const origLength = v.getUint32(at + 12);
		const checksum = v.getUint32(at + 16);
		const raw = woff.subarray(offset, offset + compLength);
		const data = compLength < origLength ? unzlibSync(raw) : raw;
		if (data.length !== origLength) throw new Error('bad WOFF table');
		tables.push({ tag, checksum, data });
	}
	tables.sort((a, b) => a.tag - b.tag);
	const pad = (n: number) => (n + 3) & ~3;
	let size = 12 + 16 * numTables;
	for (const t of tables) size += pad(t.data.length);
	const out = new Uint8Array(size);
	const o = new DataView(out.buffer);
	const pow = 2 ** Math.floor(Math.log2(numTables));
	o.setUint32(0, flavor);
	o.setUint16(4, numTables);
	o.setUint16(6, pow * 16);
	o.setUint16(8, Math.log2(pow));
	o.setUint16(10, numTables * 16 - pow * 16);
	let offset = 12 + 16 * numTables;
	tables.forEach((t, i) => {
		const at = 12 + i * 16;
		o.setUint32(at, t.tag);
		o.setUint32(at + 4, t.checksum);
		o.setUint32(at + 8, offset);
		o.setUint32(at + 12, t.data.length);
		out.set(t.data, offset);
		offset += pad(t.data.length);
	});
	return out;
}
