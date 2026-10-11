import { onServer } from '../remote';
import type { OptionSpec, Tool } from './types';

/**
 * Tools that run on the server version (Docker: FastAPI + Gotenberg, see server/).
 * Ids and option ids match server/app/tools/*.py. On GitHub Pages they show the "server version" badge.
 */
type Spec = Omit<Tool, 'runtime' | 'engine' | 'load' | 'maxMB' | 'batch'> & { batch?: boolean };

const server = (t: Spec): Tool => ({ runtime: 'server', engine: 'server', load: onServer(t.id), maxMB: 100, batch: true, ...t });

const pdfa: OptionSpec = { id: 'pdfa', type: 'checkbox', label: { ar: 'PDF/A للأرشفة', en: 'PDF/A for archiving' }, default: false };
const landscape: OptionSpec = { id: 'landscape', type: 'checkbox', label: { ar: 'الصفحة بالعرض', en: 'Landscape' }, default: false };
const paper: OptionSpec = {
	id: 'paper',
	type: 'select',
	label: { ar: 'مقاس الورق', en: 'Paper size' },
	default: 'a4',
	choices: [
		{ value: 'a4', label: { ar: 'A4', en: 'A4' } },
		{ value: 'letter', label: { ar: 'Letter', en: 'Letter' } }
	]
};
const background: OptionSpec = { id: 'background', type: 'checkbox', label: { ar: 'طباعة الخلفيات والألوان', en: 'Print backgrounds' }, default: true };

const EBOOKS = [
	{ value: 'epub', label: { ar: 'EPUB', en: 'EPUB' } },
	{ value: 'azw3', label: { ar: 'Kindle (AZW3)', en: 'Kindle (AZW3)' } },
	{ value: 'mobi', label: { ar: 'MOBI', en: 'MOBI' } },
	{ value: 'fb2', label: { ar: 'FB2', en: 'FB2' } },
	{ value: 'docx', label: { ar: 'Word (DOCX)', en: 'Word (DOCX)' } },
	{ value: 'pdf', label: { ar: 'PDF', en: 'PDF' } },
	{ value: 'txt', label: { ar: 'نص (TXT)', en: 'Text (TXT)' } }
];
const DOCS = [
	{ value: 'docx', label: { ar: 'Word (DOCX)', en: 'Word (DOCX)' } },
	{ value: 'odt', label: { ar: 'OpenDocument (ODT)', en: 'OpenDocument (ODT)' } },
	{ value: 'md', label: { ar: 'Markdown', en: 'Markdown' } },
	{ value: 'html', label: { ar: 'HTML', en: 'HTML' } },
	{ value: 'epub', label: { ar: 'EPUB', en: 'EPUB' } },
	{ value: 'tex', label: { ar: 'LaTeX', en: 'LaTeX' } },
	{ value: 'rst', label: { ar: 'reStructuredText', en: 'reStructuredText' } }
];

export const serverTools: Tool[] = [
	server({
		id: 'word-to-pdf',
		category: 'pdf',
		from: ['docx', 'doc', 'odt', 'rtf'],
		to: ['pdf'],
		options: [pdfa],
		i18n: {
			ar: { title: 'Word إلى PDF', desc: 'حوّل مستندات Word وODT وRTF إلى PDF بنفس التنسيق والخطوط العربية، عبر LibreOffice.', keywords: ['word', 'docx', 'doc', 'pdf', 'وورد'] },
			en: { title: 'Word to PDF', desc: 'Turn Word, ODT and RTF documents into PDF with their layout and Arabic fonts, using LibreOffice.', keywords: ['word', 'docx', 'doc', 'pdf'] }
		}
	}),
	server({
		id: 'excel-to-pdf',
		category: 'pdf',
		from: ['xlsx', 'xls', 'ods'],
		to: ['pdf'],
		options: [
			{ id: 'one_page', type: 'checkbox', label: { ar: 'كل ورقة في صفحة واحدة', en: 'Each sheet on one page' }, default: false },
			landscape,
			pdfa
		],
		i18n: {
			ar: { title: 'Excel إلى PDF', desc: 'حوّل جداول Excel وODS إلى PDF، مع خيار وضع كل ورقة في صفحة واحدة. المعادلات تُحسب قبل التحويل.', keywords: ['excel', 'xlsx', 'pdf', 'اكسل', 'جدول'] },
			en: { title: 'Excel to PDF', desc: 'Turn Excel and ODS spreadsheets into PDF, optionally one page per sheet. Formulas are calculated first.', keywords: ['excel', 'xlsx', 'spreadsheet', 'pdf'] }
		}
	}),
	server({
		id: 'powerpoint-to-pdf',
		category: 'pdf',
		from: ['pptx', 'ppt', 'ppsx', 'pps', 'odp'],
		to: ['pdf'],
		options: [pdfa],
		i18n: {
			ar: { title: 'PowerPoint إلى PDF', desc: 'حوّل العروض التقديمية إلى PDF، كل شريحة في صفحة.', keywords: ['powerpoint', 'pptx', 'pdf', 'باوربوينت', 'عرض تقديمي'] },
			en: { title: 'PowerPoint to PDF', desc: 'Turn presentations into PDF, one slide per page.', keywords: ['powerpoint', 'pptx', 'slides', 'pdf'] }
		}
	}),
	server({
		id: 'html-to-pdf',
		category: 'pdf',
		from: ['html', 'htm'],
		to: ['pdf'],
		options: [paper, landscape, background],
		i18n: {
			ar: { title: 'HTML إلى PDF', desc: 'اطبع صفحة HTML محفوظة إلى PDF بمتصفح Chromium، مع دعم كامل للعربية.', keywords: ['html', 'pdf', 'صفحة ويب'] },
			en: { title: 'HTML to PDF', desc: 'Print a saved HTML page to PDF with Chromium, with full Arabic support.', keywords: ['html', 'pdf', 'web page'] }
		}
	}),
	server({
		id: 'url-to-pdf',
		category: 'pdf',
		from: [],
		to: ['pdf'],
		widget: 'web-capture',
		batch: false,
		options: [
			paper,
			landscape,
			background,
			{
				id: 'media',
				type: 'select',
				label: { ar: 'الشكل', en: 'Layout' },
				default: 'print',
				choices: [
					{ value: 'print', label: { ar: 'نسخة الطباعة', en: 'Print version' } },
					{ value: 'screen', label: { ar: 'كما تظهر على الشاشة', en: 'As on screen' } }
				]
			}
		],
		i18n: {
			ar: { title: 'رابط صفحة إلى PDF', desc: 'اكتب رابط أي صفحة على الإنترنت واحفظها PDF.', keywords: ['url', 'رابط', 'صفحة ويب', 'pdf', 'حفظ موقع'] },
			en: { title: 'Web page to PDF', desc: 'Enter the address of any web page and save it as PDF.', keywords: ['url', 'web page', 'website', 'pdf'] }
		}
	}),
	server({
		id: 'url-to-image',
		category: 'image',
		from: [],
		to: ['png', 'jpg', 'webp'],
		widget: 'web-capture',
		batch: false,
		options: [
			{
				id: 'device',
				type: 'select',
				label: { ar: 'الجهاز', en: 'Device' },
				default: 'desktop',
				choices: [
					{ value: 'desktop', label: { ar: 'كمبيوتر', en: 'Desktop' } },
					{ value: 'tablet', label: { ar: 'تابلت', en: 'Tablet' } },
					{ value: 'phone', label: { ar: 'موبايل', en: 'Phone' } }
				]
			},
			{ id: 'full_page', type: 'checkbox', label: { ar: 'الصفحة كاملة (وليس أول شاشة فقط)', en: 'Whole page (not just the first screen)' }, default: true },
			{
				id: 'format',
				type: 'select',
				label: { ar: 'الصيغة', en: 'Format' },
				default: 'png',
				choices: [
					{ value: 'png', label: { ar: 'PNG', en: 'PNG' } },
					{ value: 'jpg', label: { ar: 'JPG', en: 'JPG' } },
					{ value: 'webp', label: { ar: 'WebP', en: 'WebP' } }
				]
			}
		],
		i18n: {
			ar: { title: 'لقطة شاشة لموقع', desc: 'صوّر أي صفحة على الإنترنت كصورة، كما تظهر على الكمبيوتر أو الموبايل.', keywords: ['screenshot', 'لقطة شاشة', 'تصوير موقع', 'رابط'] },
			en: { title: 'Website screenshot', desc: 'Capture any web page as an image, as it looks on a desktop or a phone.', keywords: ['screenshot', 'website', 'capture', 'url'] }
		}
	}),
	server({
		id: 'pdf-to-word',
		category: 'pdf',
		from: ['pdf'],
		to: ['docx'],
		i18n: {
			ar: { title: 'PDF إلى Word', desc: 'حوّل PDF إلى مستند Word قابل للتعديل مع الجداول والصور. يعمل مع ملفات PDF النصية؛ الممسوحة ضوئيًا تحتاج OCR أولًا.', keywords: ['pdf', 'word', 'docx', 'تعديل pdf', 'وورد'] },
			en: { title: 'PDF to Word', desc: 'Turn a PDF into an editable Word document, with tables and images. Works on text PDFs; scans need OCR first.', keywords: ['pdf', 'word', 'docx', 'edit pdf'] }
		}
	}),
	server({
		id: 'pdf-to-pdfa',
		category: 'pdf',
		from: ['pdf'],
		to: ['pdf'],
		options: [
			{
				id: 'level',
				type: 'select',
				label: { ar: 'المستوى', en: 'Level' },
				default: 'PDF/A-2b',
				choices: [
					{ value: 'PDF/A-1b', label: { ar: 'PDF/A-1b', en: 'PDF/A-1b' } },
					{ value: 'PDF/A-2b', label: { ar: 'PDF/A-2b (مُستحسن)', en: 'PDF/A-2b (recommended)' } },
					{ value: 'PDF/A-3b', label: { ar: 'PDF/A-3b', en: 'PDF/A-3b' } }
				]
			}
		],
		i18n: {
			ar: { title: 'PDF إلى PDF/A', desc: 'حوّل PDF إلى صيغة الأرشفة PDF/A التي تطلبها الجهات الحكومية والمحاكم.', keywords: ['pdf/a', 'أرشفة', 'pdfa'] },
			en: { title: 'PDF to PDF/A', desc: 'Convert a PDF to the PDF/A archiving format that courts and government offices ask for.', keywords: ['pdf/a', 'archive', 'pdfa'] }
		}
	}),
	server({
		id: 'compress-pdf-strong',
		category: 'pdf',
		from: ['pdf'],
		to: ['pdf'],
		options: [
			{
				id: 'mode',
				type: 'select',
				label: { ar: 'الطريقة', en: 'Method' },
				default: 'level',
				choices: [
					{ value: 'level', label: { ar: 'درجة ضغط', en: 'Compression level' } },
					{ value: 'target', label: { ar: 'حجم محدد', en: 'Target size' } }
				]
			},
			{
				id: 'level',
				type: 'select',
				label: { ar: 'الدرجة', en: 'Level' },
				default: 'ebook',
				when: { id: 'mode', in: ['level'] },
				choices: [
					{ value: 'screen', label: { ar: 'أقصى ضغط (للشاشة)', en: 'Strongest (screen)' } },
					{ value: 'ebook', label: { ar: 'متوازن', en: 'Balanced' } },
					{ value: 'printer', label: { ar: 'جودة طباعة', en: 'Print quality' } }
				]
			},
			{ id: 'target_mb', type: 'number', label: { ar: 'الحجم المطلوب', en: 'Target size' }, default: 2, min: 0.05, max: 500, step: 0.1, unit: 'MB', when: { id: 'mode', in: ['target'] } }
		],
		i18n: {
			ar: { title: 'ضغط PDF قوي', desc: 'ضغط أقوى بـGhostscript، أو اختر الحجم المطلوب (مثلًا ٢ ميجا لرفع الملف على بوابة حكومية).', keywords: ['ضغط pdf', 'تصغير pdf', 'حجم محدد', 'ghostscript'] },
			en: { title: 'Strong PDF compression', desc: 'Stronger compression with Ghostscript, or pick a target size (e.g. 2 MB for an upload portal).', keywords: ['compress pdf', 'reduce pdf size', 'target size'] }
		}
	}),
	server({
		id: 'repair-pdf',
		category: 'pdf',
		from: ['pdf'],
		to: ['pdf'],
		i18n: {
			ar: { title: 'إصلاح PDF', desc: 'حاول إصلاح ملف PDF تالف لا يفتح، باستعادة ما يمكن قراءته منه.', keywords: ['إصلاح pdf', 'ملف تالف', 'pdf لا يفتح'] },
			en: { title: 'Repair PDF', desc: 'Try to fix a damaged PDF that won’t open by recovering what can still be read.', keywords: ['repair pdf', 'fix pdf', 'corrupted pdf'] }
		}
	}),
	server({
		id: 'ocr-pdf-server',
		category: 'ocr',
		from: ['pdf'],
		to: ['pdf'],
		options: [
			{
				id: 'lang',
				type: 'select',
				label: { ar: 'لغة المستند', en: 'Document language' },
				default: 'ara+eng',
				choices: [
					{ value: 'ara+eng', label: { ar: 'عربي + إنجليزي', en: 'Arabic + English' } },
					{ value: 'ara', label: { ar: 'عربي', en: 'Arabic' } },
					{ value: 'eng', label: { ar: 'إنجليزي', en: 'English' } }
				]
			},
			{ id: 'straighten', type: 'checkbox', label: { ar: 'عدّل الصفحات المائلة والمقلوبة', en: 'Fix tilted and upside-down pages' }, default: false },
			{ id: 'redo', type: 'checkbox', label: { ar: 'أعد التعرف حتى على الصفحات التي بها نص', en: 'Redo pages that already have text' }, default: false },
			pdfa
		],
		i18n: {
			ar: { title: 'OCR لملفات PDF الكبيرة', desc: 'اجعل ملف PDF الممسوح ضوئيًا قابلًا للبحث والنسخ مهما كان عدد صفحاته (OCRmyPDF)، مع تعديل الصفحات المائلة.', keywords: ['ocr', 'pdf ممسوح', 'بحث في pdf', 'ocrmypdf'] },
			en: { title: 'OCR for large PDFs', desc: 'Make a scanned PDF searchable and copyable, any number of pages (OCRmyPDF), and straighten tilted pages.', keywords: ['ocr', 'scanned pdf', 'searchable pdf', 'ocrmypdf'] }
		}
	}),
	server({
		id: 'ebook-convert',
		category: 'ebook',
		from: ['epub', 'mobi', 'azw3', 'azw', 'fb2', 'docx', 'odt', 'rtf', 'txt', 'pdf'],
		to: ['epub', 'azw3', 'mobi', 'fb2', 'docx', 'pdf', 'txt'],
		options: [{ id: 'to', type: 'select', label: { ar: 'حوّل إلى', en: 'Convert to' }, default: 'epub', choices: EBOOKS }],
		i18n: {
			ar: { title: 'محوّل الكتب الإلكترونية', desc: 'حوّل الكتب بين EPUB وKindle (AZW3/MOBI) وFB2 وPDF وWord عبر calibre.', keywords: ['epub', 'kindle', 'mobi', 'azw3', 'كتاب إلكتروني', 'calibre'] },
			en: { title: 'Ebook converter', desc: 'Convert books between EPUB, Kindle (AZW3/MOBI), FB2, PDF and Word with calibre.', keywords: ['epub', 'kindle', 'mobi', 'azw3', 'ebook', 'calibre'] }
		}
	}),
	server({
		id: 'epub-to-pdf',
		category: 'ebook',
		from: ['epub'],
		to: ['pdf'],
		i18n: {
			ar: { title: 'EPUB إلى PDF', desc: 'حوّل كتاب EPUB إلى PDF مقاس A4 بأرقام صفحات، للطباعة أو القراءة على أي جهاز.', keywords: ['epub', 'pdf', 'كتاب'] },
			en: { title: 'EPUB to PDF', desc: 'Turn an EPUB book into an A4 PDF with page numbers, to print or read anywhere.', keywords: ['epub', 'pdf', 'ebook'] }
		}
	}),
	server({
		id: 'pdf-to-epub',
		category: 'ebook',
		from: ['pdf'],
		to: ['epub'],
		i18n: {
			ar: { title: 'PDF إلى EPUB', desc: 'حوّل PDF نصي إلى كتاب EPUB يتكيف مع شاشة الموبايل والقارئ الإلكتروني.', keywords: ['pdf', 'epub', 'كتاب إلكتروني'] },
			en: { title: 'PDF to EPUB', desc: 'Turn a text PDF into a reflowable EPUB for phones and e-readers.', keywords: ['pdf', 'epub', 'ebook'] }
		}
	}),
	server({
		id: 'mobi-to-epub',
		category: 'ebook',
		from: ['mobi', 'azw3', 'azw'],
		to: ['epub'],
		i18n: {
			ar: { title: 'Kindle (MOBI/AZW3) إلى EPUB', desc: 'حوّل كتب Kindle غير المحمية إلى EPUB لتقرأها على أي تطبيق.', keywords: ['mobi', 'azw3', 'kindle', 'epub'] },
			en: { title: 'Kindle (MOBI/AZW3) to EPUB', desc: 'Turn DRM-free Kindle books into EPUB to read in any app.', keywords: ['mobi', 'azw3', 'kindle', 'epub'] }
		}
	}),
	server({
		id: 'document-convert',
		category: 'document',
		from: ['md', 'markdown', 'txt', 'docx', 'odt', 'epub', 'html', 'htm', 'tex', 'rst', 'org'],
		to: ['docx', 'odt', 'md', 'html', 'epub', 'tex', 'rst'],
		options: [{ id: 'to', type: 'select', label: { ar: 'حوّل إلى', en: 'Convert to' }, default: 'docx', choices: DOCS }],
		i18n: {
			ar: { title: 'محوّل المستندات (pandoc)', desc: 'حوّل بين Word وODT وMarkdown وHTML وEPUB وLaTeX، مع اتجاه عربي تلقائي.', keywords: ['pandoc', 'تحويل مستندات', 'docx', 'odt', 'latex', 'markdown'] },
			en: { title: 'Document converter (pandoc)', desc: 'Convert between Word, ODT, Markdown, HTML, EPUB and LaTeX, with automatic Arabic direction.', keywords: ['pandoc', 'convert documents', 'docx', 'odt', 'latex', 'markdown'] }
		}
	}),
	server({
		id: 'latex-to-word',
		category: 'document',
		from: ['tex'],
		to: ['docx'],
		i18n: {
			ar: { title: 'LaTeX إلى Word', desc: 'حوّل ملف LaTeX إلى مستند Word مع العناوين والقوائم والمعادلات.', keywords: ['latex', 'tex', 'word', 'docx'] },
			en: { title: 'LaTeX to Word', desc: 'Turn a LaTeX file into a Word document with headings, lists and equations.', keywords: ['latex', 'tex', 'word', 'docx'] }
		}
	}),
	server({
		id: 'word-to-latex',
		category: 'document',
		from: ['docx', 'odt'],
		to: ['tex'],
		i18n: {
			ar: { title: 'Word إلى LaTeX', desc: 'حوّل مستند Word أو ODT إلى ملف LaTeX جاهز للتعديل.', keywords: ['word', 'docx', 'latex', 'tex'] },
			en: { title: 'Word to LaTeX', desc: 'Turn a Word or ODT document into an editable LaTeX file.', keywords: ['word', 'docx', 'latex', 'tex'] }
		}
	})
];
