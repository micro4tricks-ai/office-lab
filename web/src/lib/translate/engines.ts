import { API_URL, HAS_SERVER } from '../config';
import { ConvertError } from '../registry/types';
import type { MtPair, MtRequest, MtResponse } from './mt.worker';
import { translatable } from './text';

export type Lang3 = 'en' | 'ar' | 'fr';
export type EngineChoice = 'free' | 'pro';
export type Progress = (stage: 'loading' | 'translating', ratio: number) => void;
type Batch = (texts: string[], progress: Progress) => Promise<string[]>;

// ---- Chrome's built-in translator (on-device, free; desktop Chrome 138+) ---------------------

type ChromeTranslator = { translate(s: string): Promise<string>; destroy?(): void };
type TranslatorStatic = {
	availability(o: { sourceLanguage: string; targetLanguage: string }): Promise<string>;
	create(o: { sourceLanguage: string; targetLanguage: string; monitor?: (m: EventTarget) => void }): Promise<ChromeTranslator>;
};
const chromeApi = () => (globalThis as unknown as { Translator?: TranslatorStatic }).Translator;

/** Rejects when `p` takes longer than `ms` (some Chrome builds never answer, e.g. headless). */
const within = <T>(p: Promise<T>, ms: number) =>
	Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

const chromeChecks = new Map<string, Promise<boolean>>();
export function chromeCan(src: Lang3, tgt: Lang3): Promise<boolean> {
	const T = chromeApi();
	if (!T) return Promise.resolve(false);
	const key = `${src}-${tgt}`;
	let check = chromeChecks.get(key);
	if (!check) {
		check = within(T.availability({ sourceLanguage: src, targetLanguage: tgt }), 3000)
			.then((a) => a !== 'unavailable')
			.catch(() => false);
		chromeChecks.set(key, check);
	}
	return check;
}

function chromeBatch(src: Lang3, tgt: Lang3): Batch {
	return async (texts, progress) => {
		// Chrome may need to download its language pack first (minutes on a slow line).
		const t = await within(
			chromeApi()!.create({
				sourceLanguage: src,
				targetLanguage: tgt,
				monitor: (m) => m.addEventListener('downloadprogress', (e) => progress('loading', (e as ProgressEvent).loaded))
			}),
			180_000
		);
		const out: string[] = [];
		for (const [i, s] of texts.entries()) {
			out.push(await within(t.translate(s), 60_000));
			progress('translating', (i + 1) / texts.length);
		}
		t.destroy?.();
		return out;
	};
}

// ---- OPUS-MT in a worker (any browser; en↔ar only) ---------------------------------------

let worker: Worker | null = null;
let seq = 0;
function mtBatch(pair: MtPair): Batch {
	return (texts, progress) =>
		new Promise((resolve, reject) => {
			worker ??= new Worker(new URL('./mt.worker.ts', import.meta.url), { type: 'module' });
			const id = ++seq;
			const w = worker;
			const onMessage = ({ data }: MessageEvent<MtResponse>) => {
				if (data.id !== id) return;
				if (data.kind === 'loading') progress('loading', data.ratio);
				else if (data.kind === 'progress') progress('translating', data.done);
				else {
					w.removeEventListener('message', onMessage);
					if (data.kind === 'done') resolve(data.texts);
					else reject(new ConvertError('unknown', data.message));
				}
			};
			w.addEventListener('message', onMessage);
			w.postMessage({ id, pair, texts } satisfies MtRequest);
		});
}

export const mtCan = (src: Lang3, tgt: Lang3) => (src === 'en' && tgt === 'ar') || (src === 'ar' && tgt === 'en');

// ---- Claude on the server (optional, paid by the site owner) -----------------------------

export async function proAvailable(): Promise<boolean> {
	if (!HAS_SERVER) return false;
	try {
		const r = await fetch(`${API_URL}/api/translate/status`);
		return r.ok && (await r.json()).pro === true;
	} catch {
		return false;
	}
}

function proBatch(src: Lang3, tgt: Lang3): Batch {
	return async (texts, progress) => {
		const out: string[] = [];
		// Requests of ≤ 60 strings / ≤ 12,000 characters (the service caps 20,000).
		let i = 0;
		while (i < texts.length) {
			const chunk: string[] = [];
			let chars = 0;
			while (i < texts.length && chunk.length < 60 && (chunk.length === 0 || chars + texts[i].length <= 12_000)) {
				chars += texts[i].length;
				chunk.push(texts[i++].slice(0, 19_000));
			}
			const r = await fetch(`${API_URL}/api/translate`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ texts: chunk, source: src, target: tgt, engine: 'pro' })
			}).catch(() => null);
			if (!r) throw new ConvertError('offline');
			if (r.status === 429 || r.status === 503) throw new ConvertError('busy');
			if (r.status === 413) throw new ConvertError('too-big');
			if (!r.ok) throw new ConvertError('unknown', `translate ${r.status}`);
			out.push(...((await r.json()) as { texts: string[] }).texts);
			progress('translating', out.length / texts.length);
		}
		return out;
	};
}

/** Which engine will run: Chrome's on-device translator first, then the downloadable model. */
export async function pickEngine(src: Lang3, tgt: Lang3, choice: EngineChoice): Promise<{ run: Batch; kind: 'chrome' | 'mt' | 'pro' } | null> {
	if (choice === 'pro') return (await proAvailable()) ? { run: proBatch(src, tgt), kind: 'pro' } : null;
	const mt = mtCan(src, tgt) ? mtBatch(`${src}-${tgt}` as MtPair) : null;
	if (await chromeCan(src, tgt)) {
		const chrome = chromeBatch(src, tgt);
		// If Chrome's translator fails or stalls, the downloadable model takes over (en↔ar).
		const run: Batch = mt ? (texts, progress) => chrome(texts, progress).catch(() => mt(texts, progress)) : chrome;
		return { run, kind: 'chrome' };
	}
	if (mt) return { run: mt, kind: 'mt' };
	return null;
}

/**
 * Translates many strings: skips ones with nothing to translate, sends each distinct string once,
 * and returns the list in the same order.
 */
export async function translateAll(texts: string[], run: Batch, progress: Progress): Promise<string[]> {
	const unique = [...new Set(texts.filter(translatable).map((t) => t.trim()))];
	if (!unique.length) return texts;
	const done = await run(unique, progress);
	const map = new Map(unique.map((t, i) => [t, done[i] ?? t]));
	return texts.map((t) => map.get(t.trim()) ?? t);
}
