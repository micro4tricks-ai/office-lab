import { ConvertError, type Adapter, type FileData } from '../../registry/types';
import { decodeImage } from './decode';
import { encodePng } from './encode';

/**
 * On-device image AI with transformers.js (ONNX): background removal and upscaling.
 * Models are served by this site (scripts/models.json → static/models), the ONNX runtime from
 * static/ort; WebGPU when the browser has it, else WASM. Nothing leaves the device.
 */

function base() {
	const href = self.location.href;
	const i = href.indexOf('/_app/');
	return (i >= 0 ? href.slice(0, i) : self.location.origin) + '/';
}

let lib: Promise<typeof import('@huggingface/transformers')> | undefined;
function transformers() {
	lib ??= import('@huggingface/transformers').then((t) => {
		t.env.allowRemoteModels = false;
		t.env.allowLocalModels = true;
		t.env.localModelPath = base() + 'models/';
		t.env.useBrowserCache = true;
		if (t.env.backends.onnx.wasm) t.env.backends.onnx.wasm.wasmPaths = base() + 'ort/';
		return t;
	});
	return lib;
}

let gpuCheck: Promise<'webgpu' | 'wasm'> | undefined;
/** WebGPU if there is a usable adapter (asked once; some headless browsers never answer). */
function device(): Promise<'webgpu' | 'wasm'> {
	gpuCheck ??= (async () => {
		try {
			const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
			if (!gpu) return 'wasm';
			const adapter = await Promise.race([gpu.requestAdapter(), new Promise((r) => setTimeout(() => r(null), 3000))]);
			return adapter ? 'webgpu' : 'wasm';
		} catch {
			return 'wasm';
		}
	})();
	return gpuCheck;
}

/** Each model once per worker; the browser keeps the files after the first download. */
const loaded = new Map<string, Promise<unknown>>();
function once<T>(key: string, make: () => Promise<T>): Promise<T> {
	let p = loaded.get(key) as Promise<T> | undefined;
	if (!p) {
		p = make();
		loaded.set(key, p);
		p.catch(() => loaded.delete(key));
	}
	return p;
}

type Progress = ((r: number) => void) | undefined;

function downloads(onProgress: Progress, share: number) {
	const bytes = new Map<string, [number, number]>();
	return (e: { status: string; file?: string; loaded?: number; total?: number }) => {
		if (e.status !== 'progress' || !e.file || !e.total) return;
		bytes.set(e.file, [e.loaded ?? 0, e.total]);
		let got = 0;
		let all = 0;
		for (const [l, t] of bytes.values()) {
			got += l;
			all += t;
		}
		onProgress?.((got / all) * share);
	};
}

// ---- background removal ---------------------------------------------------------------------

export const BG_MODELS = {
	/** MODNet (Apache-2.0, 7 MB): people — ID photos, profile pictures. Fast. */
	person: { repo: 'Xenova/modnet', dtype: 'q8', input: 'input', output: 'output', sigmoid: false },
	/** BiRefNet lite (MIT, 115 MB): any subject — products, objects, signatures. Slower. */
	any: { repo: 'onnx-community/BiRefNet_lite-ONNX', dtype: 'fp16', input: 'input_image', output: 'output_image', sigmoid: true }
} as const;
export type BgModel = keyof typeof BG_MODELS;

async function mask(image: ImageData, kind: BgModel, onProgress: Progress): Promise<Uint8ClampedArray> {
	const t = await transformers();
	const m = BG_MODELS[kind];
	const dev = kind === 'any' ? await device() : 'wasm';
	// BiRefNet takes minutes on the CPU: only with a graphics card.
	if (kind === 'any' && dev !== 'webgpu') throw new ConvertError('gpu');
	const [model, processor] = await once(`${kind}:${dev}`, () =>
		Promise.all([
			t.AutoModel.from_pretrained(m.repo, { dtype: m.dtype, device: dev, progress_callback: downloads(onProgress, 0.6) }),
			t.AutoProcessor.from_pretrained(m.repo, {})
		])
	);
	onProgress?.(0.65);
	const raw = new t.RawImage(new Uint8ClampedArray(image.data), image.width, image.height, 4).rgb();
	const { pixel_values } = await processor(raw);
	const out = await model({ [m.input]: pixel_values });
	let tensor = out[m.output][0];
	if (m.sigmoid) tensor = tensor.sigmoid();
	const small = t.RawImage.fromTensor(tensor.mul(255).to('uint8'));
	const full = await small.resize(image.width, image.height);
	return full.data as Uint8ClampedArray;
}

function hex(color: string): [number, number, number] {
	const m = /^#?([0-9a-f]{6})$/i.exec(color.trim());
	const n = m ? parseInt(m[1], 16) : 0xffffff;
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export async function removeBackground(file: FileData, kind: BgModel, background: string, onProgress: Progress): Promise<FileData> {
	const { image } = await decodeImage(file);
	const alpha = await mask(image, kind, onProgress);
	onProgress?.(0.9);
	const out = new ImageData(new Uint8ClampedArray(image.data), image.width, image.height);
	const d = out.data;
	const fill = background === 'transparent' ? null : hex(background === 'white' ? '#ffffff' : background);
	for (let i = 0, p = 0; p < alpha.length; i += 4, p++) {
		const a = (alpha[p] * d[i + 3]) / 255;
		if (fill) {
			const k = a / 255;
			d[i] = d[i] * k + fill[0] * (1 - k);
			d[i + 1] = d[i + 1] * k + fill[1] * (1 - k);
			d[i + 2] = d[i + 2] * k + fill[2] * (1 - k);
			d[i + 3] = 255;
		} else d[i + 3] = a;
	}
	const stem = file.name.replace(/\.[^.]+$/, '');
	return { name: `${stem}-no-bg.png`, type: 'image/png', bytes: await encodePng(out) };
}

// ---- upscaling --------------------------------------------------------------------------------

/**
 * Real-ESRGAN general x4v3 (BSD-3-Clause, 4.9 MB): a small all-convolution model for real photos
 * and scans. The ONNX file was checked against the official weights (max difference 4e-6).
 * ×2 = ×4 then a high-quality halving, which looks better than a ×2 model of the same size.
 */
const SR_MODEL = 'models/CoderViking/realesr-general-x4v3-onnx/realesr-general-x4v3.onnx';
/** Largest input side (the model runs on every pixel; ×4 of 1000 px is 4000 px). */
export const UPSCALE_MAX = 1000;
const TILE = 160;
const OVERLAP = 16;

let srSession: Promise<{ ort: typeof import('onnxruntime-web/webgpu'); session: import('onnxruntime-web/webgpu').InferenceSession }> | undefined;
function srModel(onProgress: Progress) {
	srSession ??= (async () => {
		const ort = await import('onnxruntime-web/webgpu');
		ort.env.wasm.wasmPaths = base() + 'ort/';
		const res = await fetch(base() + SR_MODEL);
		if (!res.ok) throw new Error(`model: ${res.status}`);
		const bytes = new Uint8Array(await res.arrayBuffer());
		onProgress?.(0.1);
		const providers = (await device()) === 'webgpu' ? ['webgpu', 'wasm'] : ['wasm'];
		const session = await ort.InferenceSession.create(bytes, { executionProviders: providers });
		return { ort, session };
	})();
	srSession.catch(() => (srSession = undefined));
	return srSession;
}

export async function upscale(file: FileData, factor: 2 | 4, onProgress: Progress): Promise<FileData> {
	const { image } = await decodeImage(file);
	const W = image.width;
	const H = image.height;
	if (Math.max(W, H) > UPSCALE_MAX) throw new ConvertError('too-big', 'image too large to upscale');
	const { ort, session } = await srModel(onProgress);
	const S = 4;
	const big = new ImageData(W * S, H * S);
	const tiles: [number, number][] = [];
	for (let y = 0; y < H; y += TILE) for (let x = 0; x < W; x += TILE) tiles.push([x, y]);
	let n = 0;
	for (const [x, y] of tiles) {
		// Each tile is read with a margin so its edges don't show; only the core is kept.
		const x0 = Math.max(0, x - OVERLAP);
		const y0 = Math.max(0, y - OVERLAP);
		const x1 = Math.min(W, x + TILE + OVERLAP);
		const y1 = Math.min(H, y + TILE + OVERLAP);
		const tw = x1 - x0;
		const th = y1 - y0;
		const plane = tw * th;
		const input = new Float32Array(3 * plane);
		for (let r = 0; r < th; r++)
			for (let c = 0; c < tw; c++) {
				const s = ((y0 + r) * W + x0 + c) * 4;
				const d = r * tw + c;
				input[d] = image.data[s] / 255;
				input[plane + d] = image.data[s + 1] / 255;
				input[2 * plane + d] = image.data[s + 2] / 255;
			}
		const result = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, th, tw]) });
		const out = result[session.outputNames[0]].data as Float32Array;
		const ow = tw * S;
		const oplane = ow * th * S;
		const cw = Math.min(TILE, W - x) * S;
		const ch = Math.min(TILE, H - y) * S;
		const ox = (x - x0) * S;
		const oy = (y - y0) * S;
		for (let r = 0; r < ch; r++)
			for (let c = 0; c < cw; c++) {
				const s = (oy + r) * ow + ox + c;
				const d = ((y * S + r) * W * S + x * S + c) * 4;
				big.data[d] = out[s] * 255;
				big.data[d + 1] = out[oplane + s] * 255;
				big.data[d + 2] = out[2 * oplane + s] * 255;
				// Transparency is enlarged plainly.
				big.data[d + 3] = image.data[((y + ((r / S) | 0)) * W + x + ((c / S) | 0)) * 4 + 3];
			}
		onProgress?.(0.15 + (0.8 * ++n) / tiles.length);
	}
	let result = big;
	if (factor === 2) {
		const canvas = new OffscreenCanvas(W * 2, H * 2);
		const ctx = canvas.getContext('2d')!;
		ctx.imageSmoothingQuality = 'high';
		ctx.drawImage(await createImageBitmap(big), 0, 0, W * 2, H * 2);
		result = ctx.getImageData(0, 0, W * 2, H * 2);
	}
	const stem = file.name.replace(/\.[^.]+$/, '');
	return { name: `${stem}-x${factor}.png`, type: 'image/png', bytes: await encodePng(result) };
}

const adapter: Adapter = {
	async convert(input, o, onProgress) {
		if (o.action === 'upscale') return [await upscale(input, Number(o.factor) === 4 ? 4 : 2, onProgress)];
		const kind: BgModel = o.model === 'any' ? 'any' : 'person';
		const bg = o.background === 'color' ? String(o.color || '#ffffff') : String(o.background || 'transparent');
		return [await removeBackground(input, kind, bg, onProgress)];
	}
};

export default adapter;
