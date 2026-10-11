import type { Adapter } from '../registry/types';
import { createRunner } from './runner.svelte';

let shared: ReturnType<typeof createRunner> | null = null;

/**
 * The registry's `load` for browser tools: an adapter whose work happens in the worker pool.
 * The page never imports a codec itself, so each one is bundled once (for the worker).
 */
export const inWorker =
	(engine: string) =>
	async (): Promise<Adapter> => ({
		convert(input, options, progress) {
			shared ??= createRunner();
			return shared.runData(engine, input, options, progress);
		}
	});
