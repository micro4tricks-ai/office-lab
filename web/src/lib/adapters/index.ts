import type { Adapter } from '../registry/types';

const lazy = (load: () => Promise<{ default: Adapter }>) => () => load().then((m) => m.default);

/** Engine name → lazy import. The registry and the worker both use this map. */
export const engines: Record<string, () => Promise<Adapter>> = {
	text: lazy(() => import('./text')),
	'image-convert': lazy(() => import('./image/convert')),
	'image-compress': lazy(() => import('./image/compress')),
	'image-resize': lazy(() => import('./image/resize')),
	'image-transform': lazy(() => import('./image/transform')),
	'image-strip': lazy(() => import('./image/strip')),
	'image-watermark': lazy(() => import('./image/watermark')),
	'image-favicon': lazy(() => import('./image/favicon')),
	'image-trace': lazy(() => import('./image/trace'))
};
