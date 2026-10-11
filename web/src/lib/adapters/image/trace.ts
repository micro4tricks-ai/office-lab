import type { Adapter } from '../../registry/types';
import { decodeImage } from './decode';
import { rename } from './formats';
import { flatten, resize } from './pixels';

/** Tracing time grows fast with size; this keeps it to seconds on a phone. */
const MAX_SIDE = 1000;

const DETAIL = {
	low: { ltres: 2, qtres: 2, pathomit: 16, blurradius: 2 },
	medium: { ltres: 1, qtres: 1, pathomit: 8, blurradius: 0 },
	high: { ltres: 0.5, qtres: 0.5, pathomit: 2, blurradius: 0 }
};

/** Raster → SVG with imagetracerjs (public domain), in colour or black & white. */
const adapter: Adapter = {
	async convert(input, options, progress) {
		const mod = await import('imagetracerjs');
		const tracer = mod.default ?? (self as unknown as { ImageTracer: typeof mod.default }).ImageTracer;
		let { image } = await decodeImage(input);
		const s = Math.min(1, MAX_SIDE / Math.max(image.width, image.height));
		if (s < 1) image = await resize(image, image.width * s, image.height * s);
		progress?.(0.3);

		const bw = options.style === 'bw';
		const detail = DETAIL[String(options.detail) as keyof typeof DETAIL] ?? DETAIL.medium;
		const svg = tracer.imagedataToSVG(bw ? flatten(image) : image, {
			...detail,
			numberofcolors: bw ? 2 : Math.max(2, Math.min(64, Number(options.colors) || 16)),
			colorsampling: bw ? 0 : 2,
			colorquantcycles: bw ? 1 : 3,
			roundcoords: 1,
			viewbox: true,
			desc: false,
			...(bw ? { pal: [{ r: 0, g: 0, b: 0, a: 255 }, { r: 255, g: 255, b: 255, a: 255 }] } : {})
		});
		return [{ name: rename(input.name, 'svg'), type: 'image/svg+xml', bytes: new TextEncoder().encode(svg) }];
	}
};

export default adapter;
