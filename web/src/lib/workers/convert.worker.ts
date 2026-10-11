/// <reference lib="webworker" />
import { engines } from '../adapters';
import { ConvertError, type FileData, type Options } from '../registry/types';

export type WorkerRequest = { id: number; engine: string; file: FileData; options: Options };
export type WorkerResponse =
	| { id: number; kind: 'progress'; ratio: number }
	| { id: number; kind: 'done'; files: FileData[] }
	| { id: number; kind: 'error'; code: ConvertError['code']; message: string };

const post = (msg: WorkerResponse, transfer: Transferable[] = []) =>
	(self as DedicatedWorkerGlobalScope).postMessage(msg, transfer);

self.onmessage = async ({ data }: MessageEvent<WorkerRequest>) => {
	const { id, engine, file, options } = data;
	try {
		const load = engines[engine];
		if (!load) throw new Error(`Unknown engine: ${engine}`);
		const adapter = await load();
		const files = await adapter.convert(file, options, (ratio) =>
			post({ id, kind: 'progress', ratio })
		);
		post({ id, kind: 'done', files }, files.map((f) => f.bytes.buffer as ArrayBuffer));
	} catch (e) {
		const code = e instanceof ConvertError ? e.code : 'unknown';
		post({ id, kind: 'error', code, message: e instanceof Error ? e.message : String(e) });
	}
};
