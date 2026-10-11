import type { FileData } from '../registry/types';

/** Longest side an SVG is drawn at when it is smaller (vectors scale up for free). */
const SVG_MIN_SIDE = 1024;

export const isSvg = (file: { name: string; type: string }) =>
	file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);

/**
 * Workers have no DOM, so SVG is drawn to PNG here before conversion.
 * Everything else passes through untouched.
 */
export async function prepare(file: File): Promise<FileData> {
	const bytes = new Uint8Array(await file.arrayBuffer());
	if (!isSvg(file)) return { name: file.name, type: file.type, bytes };
	return { name: file.name, type: 'image/png', bytes: await rasterSvg(bytes) };
}

async function rasterSvg(bytes: Uint8Array): Promise<Uint8Array> {
	const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'image/svg+xml' }));
	try {
		const img = new Image();
		img.decoding = 'async';
		img.src = url;
		await img.decode();
		let w = img.naturalWidth || SVG_MIN_SIDE;
		let h = img.naturalHeight || SVG_MIN_SIDE;
		const s = Math.max(1, SVG_MIN_SIDE / Math.max(w, h));
		w = Math.round(w * s);
		h = Math.round(h * s);
		const canvas = document.createElement('canvas');
		canvas.width = w;
		canvas.height = h;
		canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
		const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
		if (!blob) throw new Error('SVG could not be drawn');
		return new Uint8Array(await blob.arrayBuffer());
	} finally {
		URL.revokeObjectURL(url);
	}
}
