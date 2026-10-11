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
