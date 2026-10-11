/** Formats the image tools read, and how to recognise them from their first bytes. */

export type InKind =
	| 'jpg' | 'png' | 'webp' | 'avif' | 'gif' | 'bmp' | 'tiff' | 'svg' | 'ico' | 'heic' | 'jxl';
export type OutFormat = 'jpg' | 'png' | 'webp' | 'avif' | 'ico' | 'pdf';

/** Extensions + MIME types for the registry's `from`. */
export const IMAGE_INPUTS = [
	'jpg', 'jpeg', 'jfif', 'png', 'webp', 'avif', 'gif', 'bmp', 'tif', 'tiff', 'svg', 'ico', 'heic', 'heif', 'jxl',
	'image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/bmp', 'image/tiff',
	'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/heic', 'image/heif', 'image/jxl'
];

export const MIME: Record<OutFormat, string> = {
	jpg: 'image/jpeg',
	png: 'image/png',
	webp: 'image/webp',
	avif: 'image/avif',
	ico: 'image/x-icon',
	pdf: 'application/pdf'
};

const ascii = (b: Uint8Array, at: number, len: number) =>
	String.fromCharCode(...b.subarray(at, at + len));

/** Detects the real format from the file's bytes (extensions lie). */
export function sniff(b: Uint8Array): InKind | null {
	if (b.length < 12) return null;
	if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
	if (b[0] === 0x89 && ascii(b, 1, 3) === 'PNG') return 'png';
	if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return 'webp';
	if (ascii(b, 0, 4) === 'GIF8') return 'gif';
	if (b[0] === 0x42 && b[1] === 0x4d) return 'bmp';
	if (ascii(b, 0, 4) === 'II*\0' || ascii(b, 0, 4) === 'MM\0*') return 'tiff';
	if (b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0) return 'ico';
	if (b[0] === 0xff && b[1] === 0x0a) return 'jxl';
	if (ascii(b, 4, 8) === 'JXL \r\n\x87\n') return 'jxl';
	if (ascii(b, 4, 4) === 'ftyp') {
		// Major brand plus compatible brands decide AVIF vs HEIC.
		const size = Math.min(b.length, (b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]);
		const brands = [ascii(b, 8, 4)];
		for (let i = 16; i + 4 <= size; i += 4) brands.push(ascii(b, i, 4));
		if (brands.some((x) => x === 'avif' || x === 'avis')) return 'avif';
		if (brands.some((x) => ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'].includes(x))) return 'heic';
		return null;
	}
	const head = ascii(b, 0, Math.min(b.length, 512)).trimStart().toLowerCase();
	if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) return 'svg';
	return null;
}

/** "photo.HEIC" + "jpg" → "photo.jpg". */
export const rename = (name: string, ext: string) => name.replace(/\.[^.]+$/, '') + '.' + ext;

/** Output format that keeps the input's kind when the browser can write it. */
export function sameFormat(kind: InKind | null): OutFormat {
	if (kind === 'png' || kind === 'webp' || kind === 'avif' || kind === 'jpg') return kind;
	if (kind === 'gif' || kind === 'bmp' || kind === 'ico' || kind === 'svg') return 'png';
	return 'jpg';
}
