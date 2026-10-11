/**
 * Lossless metadata removal: drops EXIF (camera, GPS, date), XMP, IPTC and comments
 * without re-encoding the pixels. Colour profiles are kept so colours don't shift.
 */
export type Stripped = { bytes: Uint8Array; removed: boolean; orientation: number };

const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u32be = (b: Uint8Array, i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
const u32le = (b: Uint8Array, i: number) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
const tag = (b: Uint8Array, i: number) => String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]);

function concat(parts: Uint8Array[]) {
	const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
	let o = 0;
	for (const p of parts) {
		out.set(p, o);
		o += p.length;
	}
	return out;
}

/** EXIF orientation (1–8) from an APP1 "Exif" payload; 1 when absent. */
export function exifOrientation(app1: Uint8Array): number {
	if (tag(app1, 0) !== 'Exif') return 1;
	const t = 6; // TIFF header start
	const le = app1[t] === 0x49;
	const r16 = (i: number) => (le ? app1[t + i] | (app1[t + i + 1] << 8) : u16be(app1, t + i));
	const r32 = (i: number) => (le ? u32le(app1, t + i) : u32be(app1, t + i));
	const ifd = r32(4);
	if (t + ifd + 2 > app1.length) return 1;
	const n = r16(ifd);
	for (let k = 0; k < n; k++) {
		const e = ifd + 2 + k * 12;
		if (t + e + 10 > app1.length) break;
		if (r16(e) === 0x0112) return r16(e + 8) || 1;
	}
	return 1;
}

// APP1 (EXIF/XMP), APP3–APP12, APP13 (IPTC), APP15 and COM go; APP0 (JFIF), APP2 (ICC), APP14 (Adobe) stay.
const dropJpegMarker = (m: number) => m === 0xe1 || (m >= 0xe3 && m <= 0xec) || m === 0xed || m === 0xef || m === 0xfe;

export function stripJpeg(b: Uint8Array): Stripped {
	const keep: Uint8Array[] = [b.subarray(0, 2)];
	let i = 2;
	let removed = false;
	let orientation = 1;
	while (i + 4 <= b.length) {
		if (b[i] !== 0xff) throw new Error('bad JPEG marker');
		const m = b[i + 1];
		if (m === 0xff) {
			i++; // fill byte
			continue;
		}
		if (m === 0xda) {
			keep.push(b.subarray(i)); // start of scan: the rest is image data
			return { bytes: concat(keep), removed, orientation };
		}
		const len = u16be(b, i + 2);
		const seg = b.subarray(i, i + 2 + len);
		if (m === 0xe1) orientation = Math.max(orientation, exifOrientation(seg.subarray(4)));
		if (dropJpegMarker(m)) removed = true;
		else keep.push(seg);
		i += 2 + len;
	}
	throw new Error('JPEG ended before image data');
}

const PNG_DROP = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME']);

export function stripPng(b: Uint8Array): Stripped {
	const keep: Uint8Array[] = [b.subarray(0, 8)];
	let i = 8;
	let removed = false;
	while (i + 12 <= b.length) {
		const len = u32be(b, i);
		const type = tag(b, i + 4);
		const chunk = b.subarray(i, i + 12 + len);
		if (PNG_DROP.has(type)) removed = true;
		else keep.push(chunk);
		i += 12 + len;
		if (type === 'IEND') break;
	}
	return { bytes: concat(keep), removed, orientation: 1 };
}

export function stripWebp(b: Uint8Array): Stripped {
	const keep: Uint8Array[] = [];
	let i = 12;
	let removed = false;
	while (i + 8 <= b.length) {
		const len = u32le(b, i + 4);
		const type = tag(b, i);
		const chunk = b.slice(i, i + 8 + len + (len & 1));
		if (type === 'EXIF' || type === 'XMP ') removed = true;
		else {
			if (type === 'VP8X') chunk[8] &= ~(0x08 | 0x04); // clear the EXIF and XMP flags
			keep.push(chunk);
		}
		i += 8 + len + (len & 1);
	}
	const body = concat(keep);
	const out = new Uint8Array(12 + body.length);
	out.set(b.subarray(0, 12));
	new DataView(out.buffer).setUint32(4, 4 + body.length, true);
	out.set(body, 12);
	return { bytes: out, removed, orientation: 1 };
}
