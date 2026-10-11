import { inWorker } from '../workers/proxy';
import { imageTools } from './image-tools';
import { pdfTools } from './pdf-tools';
import type { Tool } from './types';

/** Single source of truth: UI, routes, SEO pages and capability checks come from here. */
export const tools: Tool[] = [
	...pdfTools,
	...imageTools,
	{
		id: 'txt-to-html',
		category: 'document',
		from: ['txt', 'text/plain'],
		to: ['html'],
		runtime: 'browser',
		engine: 'text',
		load: inWorker('text'),
		options: [
			{
				id: 'dir',
				type: 'select',
				label: { ar: 'اتجاه النص', en: 'Text direction' },
				default: 'auto',
				choices: [
					{ value: 'auto', label: { ar: 'تلقائي', en: 'Automatic' } },
					{ value: 'rtl', label: { ar: 'من اليمين لليسار', en: 'Right to left' } },
					{ value: 'ltr', label: { ar: 'من اليسار لليمين', en: 'Left to right' } }
				]
			}
		],
		maxMB: 20,
		batch: true,
		i18n: {
			ar: {
				title: 'نص إلى HTML',
				desc: 'حوّل ملفات النص العادي (TXT) إلى صفحات HTML جاهزة للعرض، مع دعم كامل للعربية.',
				keywords: ['txt', 'html', 'نص', 'صفحة ويب']
			},
			en: {
				title: 'Text to HTML',
				desc: 'Turn plain .txt files into ready-to-view HTML pages, with full Arabic support.',
				keywords: ['txt', 'html', 'text', 'web page']
			}
		}
	}
];

export const toolById = (id: string) => tools.find((t) => t.id === id);

const ALIASES: Record<string, string> = { jpeg: 'jpg', jfif: 'jpg', tif: 'tiff', heif: 'heic' };

/** Readable, de-duplicated format names (no MIME types): "JPG · PNG · HEIC". `max` trims with "+N". */
export function formatList(list: string[], max = Infinity) {
	const names = [...new Set(list.filter((f) => !f.includes('/')).map((f) => (ALIASES[f] ?? f).toUpperCase()))];
	return names.length > max ? [...names.slice(0, max), `+${names.length - max}`] : names;
}
