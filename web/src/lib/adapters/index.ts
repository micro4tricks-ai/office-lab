import type { Adapter } from '../registry/types';

/** Engine name → lazy import. The registry and the worker both use this map. */
export const engines: Record<string, () => Promise<Adapter>> = {
	text: () => import('./text').then((m) => m.default)
};
