/// <reference lib="webworker" />
/**
 * Offline translation (OPUS-MT en↔ar, ONNX, ~110 MB per direction) with transformers.js.
 * Models and the ONNX runtime are served by this site (scripts/fetch-models.mjs, copy-assets.mjs);
 * the browser caches them after the first use.
 */
import { env, pipeline } from '@huggingface/transformers';
import { fixNumbers, splitSentences, preEdit } from './text';

export type MtPair = 'en-ar' | 'ar-en';
export type MtRequest = { id: number; pair: MtPair; texts: string[] };
export type MtResponse =
	| { id: number; kind: 'loading'; ratio: number }
	| { id: number; kind: 'progress'; done: number }
	| { id: number; kind: 'done'; texts: string[] }
	| { id: number; kind: 'error'; message: string };

const MODELS: Record<MtPair, string> = { 'en-ar': 'Xenova/opus-mt-en-ar', 'ar-en': 'Xenova/opus-mt-ar-en' };

function base() {
	const href = self.location.href;
	const i = href.indexOf('/_app/');
	return (i >= 0 ? href.slice(0, i) : self.location.origin) + '/';
}
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = base() + 'models/';
env.useBrowserCache = true;
if (env.backends.onnx.wasm) env.backends.onnx.wasm.wasmPaths = base() + 'ort/';

type Translator = (texts: string[]) => Promise<{ translation_text: string }[]>;
const loaded = new Map<MtPair, Promise<Translator>>();

function load(pair: MtPair, onLoad: (r: number) => void): Promise<Translator> {
	let p = loaded.get(pair);
	if (!p) {
		const bytes = new Map<string, [number, number]>();
		p = pipeline('translation', MODELS[pair], {
			dtype: 'q8',
			device: 'wasm',
			progress_callback: (e: { status: string; file?: string; loaded?: number; total?: number }) => {
				if (e.status === 'progress' && e.file && e.total) {
					bytes.set(e.file, [e.loaded ?? 0, e.total]);
					let got = 0;
					let all = 0;
					for (const [l, t] of bytes.values()) {
						got += l;
						all += t;
					}
					onLoad(got / all);
				}
			}
		}) as unknown as Promise<Translator>;
		loaded.set(pair, p);
		p.catch(() => loaded.delete(pair));
	}
	return p;
}

const BATCH = 6;

self.onmessage = async ({ data }: MessageEvent<MtRequest>) => {
	const { id, pair, texts } = data;
	const post = (m: MtResponse) => self.postMessage(m);
	try {
		const tr = await load(pair, (ratio) => post({ id, kind: 'loading', ratio }));
		// Long paragraphs → sentences (the model reads up to ~512 tokens), translated in small batches.
		const pieces = texts.map((t) => splitSentences(t));
		const flat = pieces.flat();
		const out: string[] = [];
		for (let i = 0; i < flat.length; i += BATCH) {
			const chunk = flat.slice(i, i + BATCH);
			const input = chunk.map((s) => (pair === 'en-ar' ? '>>ara<< ' : '') + preEdit(s, pair));
			const res = await tr(input);
			res.forEach((r, k) => out.push(fixNumbers(chunk[k], r.translation_text)));
			post({ id, kind: 'progress', done: Math.min(flat.length, i + BATCH) / flat.length });
		}
		let k = 0;
		const joined = pieces.map((p) => p.map(() => out[k++]).join(' '));
		post({ id, kind: 'done', texts: joined });
	} catch (e) {
		post({ id, kind: 'error', message: e instanceof Error ? e.message : String(e) });
	}
};
