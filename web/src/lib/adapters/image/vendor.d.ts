// Minimal types for libraries that ship none.
declare module 'libheif-js/libheif-wasm/libheif-bundle.mjs' {
	type HeifImage = {
		get_width(): number;
		get_height(): number;
		display(target: ImageData, done: (result: ImageData | null) => void): void;
		free?(): void;
	};
	type LibHeif = { HeifDecoder: new () => { decode(data: Uint8Array): HeifImage[] } };
	const factory: (options?: object) => Promise<LibHeif> | LibHeif;
	export default factory;
}

declare module 'imagetracerjs' {
	const ImageTracer: {
		imagedataToSVG(data: ImageData, options?: Record<string, unknown> | string): string;
	};
	export default ImageTracer;
}

// pdf.js's worker entry, loaded into our own worker as its "fake worker".
declare module 'pdfjs-dist/build/pdf.worker.mjs' {
	export const WorkerMessageHandler: unknown;
}


declare module 'gifenc' {
	type Palette = number[][];
	export function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number, options?: { format?: 'rgb565' | 'rgb444' | 'rgba4444' }): Palette;
	export function applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: Palette, format?: string): Uint8Array;
	export function GIFEncoder(options?: { auto?: boolean }): {
		writeFrame(index: Uint8Array, width: number, height: number, options?: { palette?: Palette; delay?: number; repeat?: number; transparent?: boolean }): void;
		finish(): void;
		bytes(): Uint8Array;
	};
}

// The WebGPU (JSEP) build, the same as transformers.js and static/ort; its types are onnxruntime-common's.
declare module 'onnxruntime-web/webgpu' {
	export * from 'onnxruntime-common';
}
