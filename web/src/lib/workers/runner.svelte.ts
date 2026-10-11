import { ConvertError, type FileData, type Options, type Tool } from '../registry/types';
import type { WorkerRequest, WorkerResponse } from './convert.worker';
import { prepare } from './prepare';

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

/** Parallel workers: leave a core for the page, and stay gentle on small phones. */
function poolSize() {
	const cores = navigator.hardwareConcurrency || 2;
	const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
	return Math.max(1, Math.min(memory <= 4 ? 2 : 3, cores - 1));
}

type Job = {
	req: WorkerRequest;
	transfer: Transferable[];
	resolve: (f: FileData[]) => void;
	reject: (e: ConvertError) => void;
	progress?: (r: number) => void;
};

/**
 * Runs conversions in a small pool of workers, so the UI never freezes.
 * Call `dispose()` when finished.
 */
export function createRunner() {
	const size = poolSize();
	const idle: Worker[] = [];
	const busy = new Map<Worker, Job>();
	const queue: Job[] = [];
	let created = 0;
	let seq = 0;

	function spawn() {
		const w = new Worker(new URL('./convert.worker.ts', import.meta.url), { type: 'module' });
		w.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
			const job = busy.get(w);
			if (!job || job.req.id !== data.id) return;
			if (data.kind === 'progress') return job.progress?.(data.ratio);
			busy.delete(w);
			if (data.kind === 'done') job.resolve(data.files);
			else job.reject(new ConvertError(data.code, data.message));
			idle.push(w);
			pump();
		};
		w.onerror = (e) => {
			// A crashed worker (e.g. out of memory) fails its job and is replaced.
			const job = busy.get(w);
			busy.delete(w);
			w.terminate();
			created--;
			job?.reject(new ConvertError('unknown', e.message));
			pump();
		};
		created++;
		return w;
	}

	function pump() {
		while (queue.length) {
			const w = idle.pop() ?? (created < size ? spawn() : null);
			if (!w) return;
			const job = queue.shift()!;
			busy.set(w, job);
			w.postMessage(job.req, job.transfer);
		}
	}

	/** Runs one engine on bytes already in memory. */
	function runData(engine: string, input: FileData, options: Options, progress?: (r: number) => void) {
		const req: WorkerRequest = { id: ++seq, engine, file: input, options };
		return new Promise<FileData[]>((resolve, reject) => {
			queue.push({ req, transfer: [input.bytes.buffer], resolve, reject, progress });
			pump();
		});
	}

	/** Runs a tool on a picked file: prepares it (SVG → PNG), merges fixed params under the user's options. */
	async function run(tool: Tool, file: File, options: Options, progress?: (r: number) => void) {
		let input: FileData;
		try {
			input = await prepare(file);
		} catch {
			throw new ConvertError('corrupted');
		}
		return runData(tool.engine, input, { ...tool.params, ...($state.snapshot(options) as Options) }, progress);
	}

	function dispose() {
		for (const w of [...idle, ...busy.keys()]) w.terminate();
		for (const job of [...busy.values(), ...queue]) job.reject(new ConvertError('unknown', 'cancelled'));
		idle.length = 0;
		busy.clear();
		queue.length = 0;
		created = 0;
	}

	return { run, runData, dispose, size };
}
