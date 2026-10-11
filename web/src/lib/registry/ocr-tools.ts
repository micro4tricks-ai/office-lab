import { IMAGE_INPUTS } from '../adapters/image/formats';
import { inWorker } from '../workers/proxy';
import type { OptionSpec, Tool } from './types';

const options: OptionSpec[] = [
	{
		id: 'lang',
		type: 'select',
		label: { ar: 'لغة النص', en: 'Text language' },
		default: 'ara+eng',
		choices: [
			{ value: 'ara+eng', label: { ar: 'عربي وإنجليزي', en: 'Arabic + English' } },
			{ value: 'ara', label: { ar: 'عربي', en: 'Arabic' } },
			{ value: 'eng', label: { ar: 'إنجليزي', en: 'English' } }
		]
	},
	{
		id: 'output',
		type: 'select',
		label: { ar: 'الناتج', en: 'Output' },
		default: 'txt',
		choices: [
			{ value: 'txt', label: { ar: 'نص (TXT)', en: 'Text (TXT)' } },
			{ value: 'pdf', label: { ar: 'PDF قابل للبحث والنسخ', en: 'Searchable PDF' } }
		]
	}
];

const ocr = (t: Omit<Tool, 'load' | 'runtime' | 'category' | 'engine' | 'batch' | 'options'>): Tool => ({
	category: 'ocr',
	runtime: 'browser',
	engine: 'ocr',
	batch: true,
	options,
	...t,
	load: inWorker('ocr')
});

export const ocrTools: Tool[] = [
	ocr({
		id: 'ocr-image',
		from: IMAGE_INPUTS,
		to: ['txt', 'pdf'],
		maxMB: 30,
		i18n: {
			ar: { title: 'استخراج النص من الصور (OCR)', desc: 'حوّل صورة مستند أو لقطة شاشة إلى نص عربي وإنجليزي قابل للنسخ، أو PDF يمكن البحث فيه.', keywords: ['ocr', 'استخراج نص', 'صورة إلى نص', 'تعرف ضوئي'] },
			en: { title: 'Image to text (OCR)', desc: 'Turn a photo of a document or a screenshot into copyable Arabic and English text, or a searchable PDF.', keywords: ['ocr', 'image to text', 'extract text'] }
		}
	}),
	ocr({
		id: 'ocr-pdf',
		from: ['pdf', 'application/pdf'],
		to: ['txt', 'pdf'],
		maxMB: 100,
		i18n: {
			ar: { title: 'OCR لملفات PDF الممسوحة', desc: 'اجعل الملف الممسوح ضوئيًا قابلًا للبحث والنسخ، أو استخرج نصه (حتى ٢٠ صفحة في المتصفح).', keywords: ['ocr', 'pdf ممسوح', 'scanned pdf', 'pdf قابل للبحث'] },
			en: { title: 'OCR scanned PDFs', desc: 'Make a scanned PDF searchable and copyable, or get its text (up to 20 pages in the browser).', keywords: ['ocr', 'scanned pdf', 'searchable pdf'] }
		}
	})
];
