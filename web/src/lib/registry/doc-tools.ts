import { inWorker } from '../workers/proxy';
import type { OptionSpec, Tool } from './types';

const DOCX = ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

const images: OptionSpec = {
	id: 'images',
	type: 'select',
	label: { ar: 'الصور', en: 'Images' },
	default: 'embed',
	choices: [
		{ value: 'embed', label: { ar: 'داخل الملف نفسه', en: 'Inside the file' } },
		{ value: 'files', label: { ar: 'ملفات منفصلة (ZIP)', en: 'Separate files (ZIP)' } }
	]
};

type Base = Omit<Tool, 'load' | 'runtime' | 'category' | 'maxMB' | 'batch'>;
const doc = (t: Base): Tool => ({ category: 'document', runtime: 'browser', maxMB: 50, batch: true, ...t, load: inWorker(t.engine) });

const MD = ['md', 'markdown', 'txt', 'text/markdown', 'text/plain'];

export const docTools: Tool[] = [
	doc({
		id: 'markdown-to-pdf',
		from: MD,
		to: ['pdf'],
		engine: 'markdown',
		widget: 'markdown',
		params: { to: 'html' },
		i18n: {
			ar: { title: 'Markdown إلى PDF بالعربية', desc: 'محرر بمعاينة حية: اكتب بالعربية والإنجليزية، واختر قالب تقرير أو سيرة ذاتية أو خطاب، واحفظ PDF بتشكيل عربي سليم.', keywords: ['markdown', 'pdf', 'محرر', 'تقرير', 'سيرة ذاتية', 'خطاب'] },
			en: { title: 'Markdown to PDF (Arabic-ready)', desc: 'A live editor: write in Arabic and English, pick a report, CV or letter template, and save a PDF with proper Arabic.', keywords: ['markdown', 'pdf', 'editor', 'report', 'cv', 'letter'] }
		}
	}),
	doc({
		id: 'markdown-to-html',
		from: MD,
		to: ['html'],
		engine: 'markdown',
		params: { to: 'html' },
		options: [{ id: 'toc', type: 'checkbox', label: { ar: 'إضافة فهرس المحتويات', en: 'Add a table of contents' }, default: false }],
		i18n: {
			ar: { title: 'Markdown إلى HTML', desc: 'صفحة HTML واحدة منسقة، مع الجداول والمعادلات وتلوين الأكواد.', keywords: ['markdown', 'html', 'md'] },
			en: { title: 'Markdown to HTML', desc: 'One styled HTML page, with tables, math and highlighted code.', keywords: ['markdown', 'html', 'md'] }
		}
	}),
	doc({
		id: 'markdown-to-word',
		from: MD,
		to: ['docx'],
		engine: 'markdown',
		params: { to: 'docx' },
		i18n: {
			ar: { title: 'Markdown إلى Word', desc: 'مستند Word بالعناوين والقوائم والجداول، والفقرات العربية من اليمين لليسار.', keywords: ['markdown', 'word', 'docx', 'وورد'] },
			en: { title: 'Markdown to Word', desc: 'A Word document with headings, lists and tables; Arabic paragraphs right-to-left.', keywords: ['markdown', 'word', 'docx'] }
		}
	}),
	doc({
		id: 'word-to-html',
		from: DOCX,
		to: ['html'],
		engine: 'docx',
		params: { to: 'html' },
		options: [images],
		i18n: {
			ar: { title: 'تحويل Word إلى HTML', desc: 'صفحة ويب نظيفة من مستند Word، مع العناوين والقوائم والجداول والصور، والعربي من اليمين.', keywords: ['word', 'docx', 'html', 'وورد'] },
			en: { title: 'Word to HTML', desc: 'A clean web page from a Word document — headings, lists, tables, images; Arabic stays right-to-left.', keywords: ['word', 'docx', 'html'] }
		}
	}),
	doc({
		id: 'word-to-markdown',
		from: DOCX,
		to: ['md'],
		engine: 'docx',
		params: { to: 'md' },
		options: [{ ...images, default: 'files' }],
		i18n: {
			ar: { title: 'تحويل Word إلى Markdown', desc: 'حوّل مستند Word إلى Markdown للمواقع والتوثيق وGitHub.', keywords: ['word', 'docx', 'markdown', 'md', 'وورد'] },
			en: { title: 'Word to Markdown', desc: 'Turn a Word document into Markdown for sites, docs and GitHub.', keywords: ['word', 'docx', 'markdown', 'md'] }
		}
	}),
	{
		id: 'whatsapp-to-pdf',
		category: 'pdf',
		from: ['txt', 'zip', 'text/plain', 'application/zip', 'application/x-zip-compressed'],
		to: ['pdf'],
		runtime: 'browser',
		engine: 'whatsapp',
		load: inWorker('whatsapp'),
		options: [
			{
				id: 'me',
				type: 'text',
				label: { ar: 'اسمك في المحادثة (رسائلك في الجهة الأخرى)', en: 'Your name in the chat (your messages on the other side)' },
				default: '',
				placeholder: { ar: 'كما يظهر في الملف', en: 'As it appears in the file' }
			},
			{
				id: 'theme',
				type: 'select',
				label: { ar: 'الشكل', en: 'Look' },
				default: 'whatsapp',
				choices: [
					{ value: 'whatsapp', label: { ar: 'مثل واتساب', en: 'Like WhatsApp' } },
					{ value: 'plain', label: { ar: 'خلفية بيضاء (للطباعة)', en: 'White (for printing)' } }
				]
			},
			{ id: 'photos', type: 'checkbox', label: { ar: 'إظهار الصور (من ملف ZIP)', en: 'Show photos (from the ZIP)' }, default: true }
		],
		maxMB: 300,
		batch: true,
		i18n: {
			ar: {
				title: 'محادثة واتساب إلى PDF',
				desc: 'حوّل محادثة واتساب المُصدَّرة (TXT أو ZIP بالصور) إلى PDF بفقاعات وأسماء وتواريخ وصور، قابل للبحث — للتوثيق أو تقديمها كمستند.',
				keywords: ['واتساب', 'whatsapp', 'محادثة واتساب pdf', 'طباعة محادثة', 'تصدير الدردشة']
			},
			en: {
				title: 'WhatsApp chat to PDF',
				desc: 'Turn an exported WhatsApp chat (TXT, or the ZIP with photos) into a searchable PDF with bubbles, names, dates and pictures — to keep or submit.',
				keywords: ['whatsapp to pdf', 'whatsapp chat export', 'print whatsapp chat', 'chat to pdf']
			}
		}
	}
];
