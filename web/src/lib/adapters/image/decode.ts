import { ConvertError, type FileData } from '../../registry/types';
import { sniff, type InKind } from './formats';

/** Anything bigger is refused: canvases fail (or eat the phone's memory) beyond this. */
export const MAX_PIXELS = 50_000_000;

export type Decoded = { image: ImageData; kind: InKind };

function guard(w: number, h: number) {
	if (!w || !h) throw new ConvertError('corrupted');
	if (w * h > MAX_PIXELS) throw new ConvertError('too-big', 'image dimensions');
}

/** Browser decoders: JPEG (EXIF orientation applied), PNG, WebP, GIF (first frame), BMP, ICO, AVIF. */
async function viaBitmap(bytes: Uint8Array, type: string): Promise<ImageData> {
	const bmp = await createImageBitmap(new Blob([bytes as Uint8Array<ArrayBuffer>], { type }));
	guard(bmp.width, bmp.height);
	const ctx = new OffscreenCanvas(bmp.width, bmp.height).getContext('2d')!;
	ctx.drawImage(bmp, 0, 0);
	bmp.close();
	return ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
}

async function viaTiff(bytes: Uint8Array): Promise<ImageData> {
	const UTIF = (await import('utif2')).default;
	const buf = bytes.slice().buffer;
	const ifds = UTIF.decode(buf);
	// width/height are only filled in by decodeImage; before that they live in tags 256/257.
	const dim = (p: (typeof ifds)[number], tag: string) => Number((p[tag] as number[] | undefined)?.[0]) || 0;
	const page = ifds.find((p) => dim(p, 't256') && dim(p, 't257'));
	if (!page) throw new ConvertError('corrupted');
	guard(dim(page, 't256'), dim(page, 't257'));
	UTIF.decodeImage(buf, page);
	const rgba = UTIF.toRGBA8(page);
	return new ImageData(new Uint8ClampedArray(rgba), page.width as number, page.height as number);
}

async function viaHeic(bytes: Uint8Array): Promise<ImageData> {
	const factory = (await import('libheif-js/libheif-wasm/libheif-bundle.mjs')).default;
	const libheif = await factory();
	const decoder = new libheif.HeifDecoder();
	const [img] = decoder.decode(bytes);
	if (!img) throw new ConvertError('corrupted');
	const width = img.get_width();
	const height = img.get_height();
	guard(width, height);
	const out = new ImageData(width, height);
	await new Promise<void>((resolve, reject) =>
		img.display(out, (d: unknown) => (d ? resolve() : reject(new ConvertError('corrupted'))))
	);
	img.free?.();
	return out;
}

async function viaJxl(bytes: Uint8Array): Promise<ImageData> {
	const decode = (await import('@jsquash/jxl/decode.js')).default;
	const img = await decode(bytes.slice().buffer);
	guard(img.width, img.height);
	return img;
}

async function viaAvif(bytes: Uint8Array): Promise<ImageData> {
	try {
		return await viaBitmap(bytes, 'image/avif');
	} catch (e) {
		if (e instanceof ConvertError) throw e;
		const decode = (await import('@jsquash/avif/decode.js')).default;
		const img = await decode(bytes.slice().buffer);
		if (!img) throw new ConvertError('corrupted');
		guard(img.width, img.height);
		return img;
	}
}

export async function decodeImage(file: FileData): Promise<Decoded> {
	const kind = sniff(file.bytes);
	if (!kind) throw new ConvertError('wrong-type');
	try {
		switch (kind) {
			case 'tiff':
				return { kind, image: await viaTiff(file.bytes) };
			case 'heic':
				return { kind, image: await viaHeic(file.bytes) };
			case 'jxl':
				return { kind, image: await viaJxl(file.bytes) };
			case 'avif':
				return { kind, image: await viaAvif(file.bytes) };
			case 'svg':
				// SVG needs the DOM; the runner rasterises it on the main thread first.
				throw new ConvertError('wrong-type');
			default:
				return { kind, image: await viaBitmap(file.bytes, file.type || `image/${kind}`) };
		}
	} catch (e) {
		if (e instanceof ConvertError) throw e;
		throw new ConvertError('corrupted', e instanceof Error ? e.message : String(e));
	}
}
