/// <reference lib="webworker" />
import { engines } from '../adapters';
import { ConvertError, type FileData, type Options } from '../registry/types';

export type WorkerRequest = { id: number; engine: string; files: FileData[]; combine: boolean; options: Options };
export type WorkerResponse =
	| { id: number; kind: 'progress'; ratio: number }
	| { id: number; kind: 'done'; files: FileData[] }
	| { id: number; kind: 'error'; code: ConvertError['code']; message: string };

const post = (msg: WorkerResponse, transfer: Transferable[] = []) =>
	(self as DedicatedWorkerGlobalScope).postMessage(msg, transfer);

self.onmessage = async ({ data }: MessageEvent<WorkerRequest>) => {
	const { id, engine, files: inputs, combine, options } = data;
	try {
		const load = engines[engine];
		if (!load) throw new Error(`Unknown engine: ${engine}`);
		const adapter = await load();
		const progress = (ratio: number) => post({ id, kind: 'progress', ratio });
		if (combine && !adapter.combine) throw new Error(`${engine} cannot combine files`);
		const files = combine
			? await adapter.combine!(inputs, options, progress)
			: await adapter.convert(inputs[0], options, progress);
		post({ id, kind: 'done', files }, [...new Set(files.map((f) => f.bytes.buffer as ArrayBuffer))]);
	} catch (e) {
		const code = e instanceof ConvertError ? e.code : 'unknown';
		post({ id, kind: 'error', code, message: e instanceof Error ? (code === 'unknown' && e.stack) || e.message : String(e) });
	}
};
