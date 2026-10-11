import { ConvertError, type FileData, type Options, type Tool } from '../registry/types';
import type { WorkerRequest, WorkerResponse } from './convert.worker';

const ext = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';

/** Checks done on the main thread before a file is sent to a worker. */
export function validate(tool: Tool, file: File): ConvertError | null {
	if (!tool.from.includes(ext(file.name)) && !tool.from.includes(file.type)) {
		return new ConvertError('wrong-type');
	}
	if (file.size > tool.maxMB * 1024 * 1024) return new ConvertError('too-big');
	return null;
}

/** Accept attribute for <input type=file>. */
export const acceptOf = (tool: Tool) =>
	tool.from.map((f) => (f.includes('/') ? f : '.' + f)).join(',');

/**
 * Runs conversions one by one in a dedicated worker, so the UI never freezes.
 * Call `dispose()` when finished.
 */
export function createRunner() {
	let worker: Worker | null = null;
	let seq = 0;
	const pending = new Map<
		number,
		{ resolve: (f: FileData[]) => void; reject: (e: ConvertError) => void; progress?: (r: number) => void }
	>();

	function getWorker() {
		if (worker) return worker;
		worker = new Worker(new URL('./convert.worker.ts', import.meta.url), { type: 'module' });
		worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
			const job = pending.get(data.id);
			if (!job) return;
			if (data.kind === 'progress') return job.progress?.(data.ratio);
			pending.delete(data.id);
			if (data.kind === 'done') job.resolve(data.files);
			else job.reject(new ConvertError(data.code, data.message));
		};
		return worker;
	}

	async function run(tool: Tool, file: File, options: Options, progress?: (r: number) => void) {
		const bytes = new Uint8Array(await file.arrayBuffer());
		const id = ++seq;
		const req: WorkerRequest = {
			id,
			engine: tool.engine,
			file: { name: file.name, type: file.type, bytes },
			options: $state.snapshot(options) as Options
		};
		return new Promise<FileData[]>((resolve, reject) => {
			pending.set(id, { resolve, reject, progress });
			getWorker().postMessage(req, [bytes.buffer]);
		});
	}

	function dispose() {
		worker?.terminate();
		worker = null;
		for (const job of pending.values()) job.reject(new ConvertError('unknown', 'cancelled'));
		pending.clear();
	}

	return { run, dispose };
}
