/** Builds a .ico file from square PNG images (Vista+ PNG-in-ICO, read by every current browser and OS). */
export function writeIco(entries: { size: number; png: Uint8Array }[]): Uint8Array {
	const header = 6 + 16 * entries.length;
	const total = header + entries.reduce((s, e) => s + e.png.length, 0);
	const out = new Uint8Array(total);
	const v = new DataView(out.buffer);
	v.setUint16(0, 0, true); // reserved
	v.setUint16(2, 1, true); // type: icon
	v.setUint16(4, entries.length, true);
	let offset = header;
	entries.forEach((e, i) => {
		const d = 6 + 16 * i;
		out[d] = e.size >= 256 ? 0 : e.size; // 0 means 256
		out[d + 1] = e.size >= 256 ? 0 : e.size;
		out[d + 2] = 0; // palette
		out[d + 3] = 0; // reserved
		v.setUint16(d + 4, 1, true); // colour planes
		v.setUint16(d + 6, 32, true); // bits per pixel
		v.setUint32(d + 8, e.png.length, true);
		v.setUint32(d + 12, offset, true);
		out.set(e.png, offset);
		offset += e.png.length;
	});
	return out;
}

/** Reads the directory of a .ico file: size and byte length of each image. */
export function readIcoDirectory(b: Uint8Array) {
	const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
	const n = v.getUint16(4, true);
	return Array.from({ length: n }, (_, i) => {
		const d = 6 + 16 * i;
		return { size: b[d] || 256, bytes: v.getUint32(d + 8, true), offset: v.getUint32(d + 12, true) };
	});
}
