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
	'image-trace': lazy(() => import('./image/trace')),
	'pdf-merge': lazy(() => import('./pdf/merge')),
	'pdf-split': lazy(() => import('./pdf/split')),
	'pdf-pages': lazy(() => import('./pdf/pages-op')),
	'pdf-crop': lazy(() => import('./pdf/crop')),
	'pdf-security': lazy(() => import('./pdf/security')),
	'pdf-metadata': lazy(() => import('./pdf/metadata')),
	'pdf-from-images': lazy(() => import('./pdf/from-images')),
	'pdf-render': lazy(() => import('./pdf/render')),
	'pdf-text': lazy(() => import('./pdf/text')),
	'pdf-images': lazy(() => import('./pdf/extract-images')),
	'pdf-compare': lazy(() => import('./pdf/compare')),
	'pdf-page-numbers': lazy(() => import('./pdf/page-numbers')),
	'pdf-watermark': lazy(() => import('./pdf/watermark')),
	'pdf-compress': lazy(() => import('./pdf/compress')),
	'pdf-thumbs': lazy(() => import('./pdf/thumbs')),
	'pdf-organize': lazy(() => import('./pdf/organize')),
	'pdf-place': lazy(() => import('./pdf/placements')),
	'pdf-forms': lazy(() => import('./pdf/forms')),
	'data-convert': lazy(() => import('./data/convert')),
	'data-format': lazy(() => import('./data/format')),
	'docx': lazy(() => import('./doc/docx')),
	'markdown': lazy(() => import('./doc/markdown')),
	'ocr': lazy(() => import('./ocr/ocr')),
	'read-qr': lazy(() => import('./files/read-qr')),
	'zip': lazy(() => import('./files/zip')),
	'rename': lazy(() => import('./files/rename'))
};
