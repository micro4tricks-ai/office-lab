import { IMAGE_INPUTS } from '../adapters/image/formats';
import { inWorker } from '../workers/proxy';
import type { OptionSpec, Tool } from './types';

const PDF = ['pdf', 'application/pdf'];
const MAX = 200;

const pagesOption = (required: boolean, def = ''): OptionSpec => ({
	id: 'pages',
	type: 'text',
	label: required ? { ar: 'الصفحات', en: 'Pages' } : { ar: 'الصفحات (فارغ = الكل)', en: 'Pages (empty = all)' },
	default: def,
	required,
	placeholder: { ar: 'مثل: 1-3، 5، 8-', en: 'e.g. 1-3, 5, 8-' }
});

const mm = (id: string, ar: string, en: string, def: number): OptionSpec => ({
	id,
	type: 'number',
	label: { ar, en },
	default: def,
	min: 0,
	max: 200,
	unit: 'mm'
});

type Base = Omit<Tool, 'load' | 'runtime' | 'category' | 'from' | 'maxMB' | 'batch'> & Partial<Pick<Tool, 'from' | 'maxMB' | 'batch'>>;

/** Browser PDF tool with the usual defaults. */
const pdf = (t: Base): Tool => ({
	category: 'pdf',
	runtime: 'browser',
	from: PDF,
	maxMB: MAX,
	batch: true,
	load: inWorker(t.engine),
	...t
});

export const pdfTools: Tool[] = [
	pdf({
		id: 'merge-pdf',
		to: ['pdf'],
		engine: 'pdf-merge',
		combine: { min: 2 },
		i18n: {
			ar: { title: 'دمج ملفات PDF', desc: 'اجمع عدة ملفات PDF في ملف واحد بالترتيب الذي تريده.', keywords: ['دمج', 'merge', 'جمع pdf'] },
			en: { title: 'Merge PDF', desc: 'Combine several PDFs into one, in the order you choose.', keywords: ['merge', 'combine', 'join'] }
		}
	}),
	pdf({
		id: 'split-pdf',
		to: ['pdf'],
		engine: 'pdf-split',
		options: [
			{
				id: 'mode',
				type: 'select',
				label: { ar: 'طريقة التقسيم', en: 'Split by' },
				default: 'ranges',
				choices: [
					{ value: 'ranges', label: { ar: 'نطاقات أحددها', en: 'Ranges I choose' } },
					{ value: 'every', label: { ar: 'كل عدد من الصفحات', en: 'Every N pages' } },
					{ value: 'each', label: { ar: 'كل صفحة في ملف', en: 'Every page' } }
				]
			},
			{
				id: 'ranges',
				type: 'text',
				label: { ar: 'النطاقات (كل نطاق ملف)', en: 'Ranges (one file each)' },
				default: '',
				required: true,
				placeholder: { ar: 'مثل: 1-3، 4-8، 9-', en: 'e.g. 1-3, 4-8, 9-' },
				when: { id: 'mode', in: ['ranges'] }
			},
			{ id: 'every', type: 'number', label: { ar: 'عدد الصفحات لكل ملف', en: 'Pages per file' }, default: 1, min: 1, max: 1000, when: { id: 'mode', in: ['every'] } }
		],
		i18n: {
			ar: { title: 'تقسيم PDF', desc: 'قسّم الملف إلى عدة ملفات: بنطاقات تحددها، أو كل عدد من الصفحات، أو كل صفحة وحدها.', keywords: ['تقسيم', 'split', 'فصل'] },
			en: { title: 'Split PDF', desc: 'Split into several files: by your ranges, every N pages, or one page each.', keywords: ['split', 'separate', 'divide'] }
		}
	}),
	pdf({
		id: 'extract-pdf-pages',
		to: ['pdf'],
		engine: 'pdf-pages',
		params: { action: 'extract' },
		options: [pagesOption(true)],
		i18n: {
			ar: { title: 'استخراج صفحات من PDF', desc: 'خذ الصفحات التي تريدها فقط في ملف جديد، وبالترتيب الذي تكتبه.', keywords: ['استخراج', 'extract', 'صفحات'] },
			en: { title: 'Extract PDF pages', desc: 'Keep only the pages you want, in the order you write them.', keywords: ['extract', 'pages', 'select'] }
		}
	}),
	pdf({
		id: 'delete-pdf-pages',
		to: ['pdf'],
		engine: 'pdf-pages',
		params: { action: 'delete' },
		options: [pagesOption(true)],
		i18n: {
			ar: { title: 'حذف صفحات من PDF', desc: 'احذف صفحات بعينها واحتفظ بالباقي.', keywords: ['حذف صفحات', 'delete', 'remove'] },
			en: { title: 'Delete PDF pages', desc: 'Remove specific pages and keep the rest.', keywords: ['delete', 'remove pages'] }
		}
	}),
	pdf({
		id: 'rotate-pdf',
		to: ['pdf'],
		engine: 'pdf-pages',
		params: { action: 'rotate' },
		options: [
			{
				id: 'angle',
				type: 'select',
				label: { ar: 'التدوير', en: 'Rotate' },
				default: '90',
				choices: [
					{ value: '90', label: { ar: '90° مع عقارب الساعة', en: '90° clockwise' } },
					{ value: '180', label: { ar: '180°', en: '180°' } },
					{ value: '270', label: { ar: '90° عكس عقارب الساعة', en: '90° counter-clockwise' } }
				]
			},
			pagesOption(false)
		],
		i18n: {
			ar: { title: 'تدوير PDF', desc: 'دوّر كل الصفحات أو صفحات محددة بدون فقد في الجودة.', keywords: ['تدوير', 'rotate', 'لف'] },
			en: { title: 'Rotate PDF', desc: 'Rotate all pages or chosen ones, with no quality loss.', keywords: ['rotate', 'turn'] }
		}
	}),
	pdf({
		id: 'crop-pdf',
		to: ['pdf'],
		engine: 'pdf-crop',
		options: [
			mm('top', 'أعلى', 'Top', 10),
			mm('bottom', 'أسفل', 'Bottom', 10),
			mm('right', 'يمين', 'Right', 10),
			mm('left', 'يسار', 'Left', 10)
		],
		i18n: {
			ar: { title: 'قص هوامش PDF', desc: 'اقطع الهوامش البيضاء الزائدة من كل الصفحات (بالمليمتر).', keywords: ['قص', 'crop', 'هوامش'] },
			en: { title: 'Crop PDF margins', desc: 'Trim extra white margins from every page (in mm).', keywords: ['crop', 'margins', 'trim'] }
		}
	}),
	pdf({
		id: 'pdf-page-numbers',
		to: ['pdf'],
		engine: 'pdf-page-numbers',
		options: [
			{
				id: 'position',
				type: 'select',
				label: { ar: 'المكان', en: 'Position' },
				default: 'bc',
				choices: [
					{ value: 'bc', label: { ar: 'أسفل المنتصف', en: 'Bottom centre' } },
					{ value: 'br', label: { ar: 'أسفل اليمين', en: 'Bottom right' } },
					{ value: 'bl', label: { ar: 'أسفل اليسار', en: 'Bottom left' } },
					{ value: 'tc', label: { ar: 'أعلى المنتصف', en: 'Top centre' } },
					{ value: 'tr', label: { ar: 'أعلى اليمين', en: 'Top right' } },
					{ value: 'tl', label: { ar: 'أعلى اليسار', en: 'Top left' } }
				]
			},
			{
				id: 'format',
				type: 'select',
				label: { ar: 'الشكل', en: 'Format' },
				default: 'n',
				choices: [
					{ value: 'n', label: { ar: '1', en: '1' } },
					{ value: 'of', label: { ar: '1 / 10', en: '1 / 10' } },
					{ value: 'page', label: { ar: 'صفحة 1 من 10', en: 'Page 1 of 10' } },
					{ value: 'dash', label: { ar: '- 1 -', en: '- 1 -' } }
				]
			},
			{
				id: 'digits',
				type: 'select',
				label: { ar: 'الأرقام', en: 'Digits' },
				default: 'latin',
				choices: [
					{ value: 'latin', label: { ar: '1 2 3', en: '1 2 3' } },
					{ value: 'arabic', label: { ar: '١ ٢ ٣ (عربية هندية)', en: '١ ٢ ٣ (Arabic-Indic)' } }
				]
			},
			{ id: 'start', type: 'number', label: { ar: 'يبدأ من', en: 'Start at' }, default: 1, min: 0, max: 100000 },
			{ id: 'size', type: 'number', label: { ar: 'حجم الخط', en: 'Font size' }, default: 11, min: 6, max: 72, unit: 'pt' },
			{ id: 'color', type: 'color', label: { ar: 'اللون', en: 'Colour' }, default: '#333333' },
			mm('margin', 'المسافة من الحافة', 'Distance from edge', 10),
			{ id: 'skipFirst', type: 'checkbox', label: { ar: 'بدون رقم على صفحة الغلاف', en: 'No number on the cover page' }, default: false }
		],
		i18n: {
			ar: { title: 'ترقيم صفحات PDF', desc: 'أضف أرقام الصفحات بالشكل والمكان الذي تختاره، وبالأرقام العربية إن أردت.', keywords: ['ترقيم', 'page numbers', 'أرقام الصفحات'] },
			en: { title: 'Add page numbers', desc: 'Number your pages in the style and spot you choose, with Arabic-Indic digits if you like.', keywords: ['page numbers', 'numbering', 'paginate'] }
		}
	}),
	pdf({
		id: 'watermark-pdf',
		to: ['pdf'],
		engine: 'pdf-watermark',
		options: [
			{
				id: 'kind',
				type: 'select',
				label: { ar: 'نوع العلامة', en: 'Watermark' },
				default: 'text',
				choices: [
					{ value: 'text', label: { ar: 'نص', en: 'Text' } },
					{ value: 'image', label: { ar: 'صورة / شعار', en: 'Image / logo' } }
				]
			},
			{ id: 'text', type: 'text', label: { ar: 'النص', en: 'Text' }, default: 'سري', when: { id: 'kind', in: ['text'] } },
			{ id: 'color', type: 'color', label: { ar: 'اللون', en: 'Colour' }, default: '#c0392b', when: { id: 'kind', in: ['text'] } },
			{ id: 'logo', type: 'image', label: { ar: 'الصورة', en: 'Image' }, default: null, when: { id: 'kind', in: ['image'] } },
			{
				id: 'position',
				type: 'select',
				label: { ar: 'المكان', en: 'Position' },
				default: 'center',
				choices: [
					{ value: 'center', label: { ar: 'منتصف الصفحة', en: 'Page centre' } },
					{ value: 'tile', label: { ar: 'متكرر على الصفحة', en: 'Tiled' } }
				]
			},
			{ id: 'size', type: 'range', label: { ar: 'الحجم (من عرض الصفحة)', en: 'Size (of page width)' }, default: 60, min: 5, max: 100, unit: '%' },
			{ id: 'opacity', type: 'range', label: { ar: 'الشفافية', en: 'Opacity' }, default: 25, min: 5, max: 100, unit: '%' },
			{ id: 'angle', type: 'range', label: { ar: 'الزاوية', en: 'Angle' }, default: 45, min: -90, max: 90, step: 5, unit: '°' },
			pagesOption(false)
		],
		i18n: {
			ar: { title: 'علامة مائية على PDF', desc: 'اكتب «سري» أو «مسودة» أو ضع شعارك على صفحات الملف.', keywords: ['علامة مائية', 'watermark', 'سري', 'مسودة'] },
			en: { title: 'Watermark PDF', desc: 'Stamp “Confidential”, “Draft” or your logo across the pages.', keywords: ['watermark', 'stamp', 'confidential'] }
		}
	}),
	pdf({
		id: 'image-to-pdf',
		from: IMAGE_INPUTS,
		to: ['pdf'],
		engine: 'pdf-from-images',
		maxMB: 50,
		combine: { min: 1 },
		options: [
			{
				id: 'pageSize',
				type: 'select',
				label: { ar: 'مقاس الصفحة', en: 'Page size' },
				default: 'a4',
				choices: [
					{ value: 'a4', label: { ar: 'A4', en: 'A4' } },
					{ value: 'letter', label: { ar: 'Letter', en: 'Letter' } },
					{ value: 'fit', label: { ar: 'بمقاس الصورة', en: 'Same as the image' } }
				]
			},
			{
				id: 'orientation',
				type: 'select',
				label: { ar: 'الاتجاه', en: 'Orientation' },
				default: 'auto',
				choices: [
					{ value: 'auto', label: { ar: 'تلقائي حسب الصورة', en: 'Automatic' } },
					{ value: 'portrait', label: { ar: 'طولي', en: 'Portrait' } },
					{ value: 'landscape', label: { ar: 'عرضي', en: 'Landscape' } }
				],
				when: { id: 'pageSize', in: ['a4', 'letter'] }
			},
			{
				id: 'margin',
				type: 'select',
				label: { ar: 'الهوامش', en: 'Margins' },
				default: '10',
				choices: [
					{ value: '0', label: { ar: 'بدون', en: 'None' } },
					{ value: '10', label: { ar: 'صغيرة', en: 'Small' } },
					{ value: '20', label: { ar: 'كبيرة', en: 'Large' } }
				]
			},
			{ id: 'quality', type: 'range', label: { ar: 'الجودة', en: 'Quality' }, default: 90, min: 30, max: 100, unit: '%' }
		],
		i18n: {
			ar: { title: 'تحويل الصور إلى PDF', desc: 'اجمع صورك في ملف PDF واحد بالترتيب الذي تريده، على A4 أو بمقاس الصورة.', keywords: ['صور إلى pdf', 'jpg to pdf', 'png to pdf'] },
			en: { title: 'Images to PDF', desc: 'Put your images into one PDF in your order, on A4 or at their own size.', keywords: ['jpg to pdf', 'image to pdf', 'png to pdf'] }
		}
	}),
	pdf({
		id: 'pdf-to-image',
		to: ['jpg', 'png', 'webp'],
		engine: 'pdf-render',
		options: [
			{
				id: 'format',
				type: 'select',
				label: { ar: 'الصيغة', en: 'Format' },
				default: 'jpg',
				choices: ['jpg', 'png', 'webp'].map((f) => ({ value: f, label: { ar: f.toUpperCase(), en: f.toUpperCase() } }))
			},
			{
				id: 'dpi',
				type: 'select',
				label: { ar: 'الدقة', en: 'Resolution' },
				default: '150',
				choices: [
					{ value: '72', label: { ar: '72 (للشاشة)', en: '72 DPI (screen)' } },
					{ value: '150', label: { ar: '150 (متوسطة)', en: '150 DPI (medium)' } },
					{ value: '300', label: { ar: '300 (للطباعة)', en: '300 DPI (print)' } }
				]
			},
			pagesOption(false)
		],
		i18n: {
			ar: { title: 'تحويل PDF إلى صور', desc: 'كل صفحة تصبح صورة JPG أو PNG أو WebP بالدقة التي تختارها.', keywords: ['pdf إلى صور', 'pdf to jpg', 'pdf to png'] },
			en: { title: 'PDF to images', desc: 'Each page becomes a JPG, PNG or WebP at the resolution you pick.', keywords: ['pdf to jpg', 'pdf to png', 'pdf to image'] }
		}
	}),
	pdf({
		id: 'extract-pdf-images',
		to: ['png', 'jpg'],
		engine: 'pdf-images',
		options: [
			{
				id: 'format',
				type: 'select',
				label: { ar: 'الصيغة', en: 'Format' },
				default: 'png',
				choices: [
					{ value: 'png', label: { ar: 'PNG (بدون فقد)', en: 'PNG (lossless)' } },
					{ value: 'jpg', label: { ar: 'JPG (أصغر)', en: 'JPG (smaller)' } }
				]
			}
		],
		i18n: {
			ar: { title: 'استخراج الصور من PDF', desc: 'احفظ كل الصور الموجودة داخل الملف كصور منفصلة.', keywords: ['استخراج صور', 'extract images'] },
			en: { title: 'Extract images from PDF', desc: 'Save every picture inside the file as its own image.', keywords: ['extract images', 'pdf images'] }
		}
	}),
	pdf({
		id: 'pdf-to-text',
		to: ['txt'],
		engine: 'pdf-text',
		i18n: {
			ar: { title: 'استخراج النص من PDF', desc: 'انسخ نص الملف إلى ملف TXT. (الملفات الممسوحة ضوئيًا تحتاج أداة OCR.)', keywords: ['pdf إلى نص', 'pdf to text', 'txt'] },
			en: { title: 'PDF to text', desc: 'Get the file’s text as a TXT. (Scanned files need OCR.)', keywords: ['pdf to text', 'txt', 'extract text'] }
		}
	}),
	pdf({
		id: 'compress-pdf',
		to: ['pdf'],
		engine: 'pdf-compress',
		options: [
			{
				id: 'level',
				type: 'select',
				label: { ar: 'درجة الضغط', en: 'Compression' },
				default: 'medium',
				choices: [
					{ value: 'light', label: { ar: 'خفيف (أفضل جودة)', en: 'Light (best quality)' } },
					{ value: 'medium', label: { ar: 'متوسط', en: 'Medium' } },
					{ value: 'strong', label: { ar: 'قوي (أصغر حجم)', en: 'Strong (smallest)' } }
				]
			}
		],
		i18n: {
			ar: { title: 'ضغط PDF', desc: 'صغّر حجم الملف بضغط الصور داخله. للضغط الأقوى استخدم نسخة الخادم.', keywords: ['ضغط pdf', 'compress', 'تصغير حجم'] },
			en: { title: 'Compress PDF', desc: 'Shrink the file by recompressing the photos inside. For stronger results use the server version.', keywords: ['compress', 'reduce size', 'optimize'] }
		}
	}),
	pdf({
		id: 'compare-pdf',
		to: ['html'],
		engine: 'pdf-compare',
		combine: { min: 2, max: 2 },
		i18n: {
			ar: { title: 'مقارنة ملفين PDF', desc: 'اعرف ما تغيّر في النص بين نسختين من نفس المستند، صفحة بصفحة.', keywords: ['مقارنة', 'compare', 'فروق'] },
			en: { title: 'Compare two PDFs', desc: 'See what changed in the text between two versions, page by page.', keywords: ['compare', 'diff', 'changes'] }
		}
	}),
	pdf({
		id: 'protect-pdf',
		to: ['pdf'],
		engine: 'pdf-security',
		params: { action: 'protect' },
		options: [
			{ id: 'password', type: 'text', secret: true, required: true, label: { ar: 'كلمة المرور', en: 'Password' }, default: '' },
			{ id: 'allowPrint', type: 'checkbox', label: { ar: 'السماح بالطباعة', en: 'Allow printing' }, default: true },
			{ id: 'allowCopy', type: 'checkbox', label: { ar: 'السماح بنسخ النص', en: 'Allow copying text' }, default: false }
		],
		i18n: {
			ar: { title: 'حماية PDF بكلمة مرور', desc: 'اقفل الملف بكلمة مرور (تشفير AES-256) ولن يفتحه أحد بدونها.', keywords: ['حماية', 'كلمة مرور', 'protect', 'encrypt'] },
			en: { title: 'Protect PDF', desc: 'Lock the file with a password (AES-256); nobody opens it without one.', keywords: ['protect', 'password', 'encrypt'] }
		}
	}),
	pdf({
		id: 'unlock-pdf',
		to: ['pdf'],
		engine: 'pdf-security',
		params: { action: 'unlock' },
		options: [{ id: 'password', type: 'text', secret: true, label: { ar: 'كلمة المرور (إن وُجدت)', en: 'Password (if any)' }, default: '' }],
		i18n: {
			ar: { title: 'فتح ملف PDF محمي', desc: 'أزل كلمة المرور وقيود الطباعة والنسخ من ملف تعرف كلمة مروره.', keywords: ['فك الحماية', 'unlock', 'إزالة كلمة المرور'] },
			en: { title: 'Unlock PDF', desc: 'Remove the password and print/copy limits from a file whose password you know.', keywords: ['unlock', 'remove password', 'decrypt'] }
		}
	}),
	pdf({
		id: 'pdf-metadata',
		to: ['pdf'],
		engine: 'pdf-metadata',
		options: [
			{ id: 'clear', type: 'checkbox', label: { ar: 'حذف كل البيانات', en: 'Remove all metadata' }, default: false },
			{ id: 'title', type: 'text', label: { ar: 'العنوان', en: 'Title' }, default: '', when: { id: 'clear', in: [false] } },
			{ id: 'author', type: 'text', label: { ar: 'المؤلف', en: 'Author' }, default: '', when: { id: 'clear', in: [false] } },
			{ id: 'subject', type: 'text', label: { ar: 'الموضوع', en: 'Subject' }, default: '', when: { id: 'clear', in: [false] } },
			{ id: 'keywords', type: 'text', label: { ar: 'الكلمات المفتاحية', en: 'Keywords' }, default: '', when: { id: 'clear', in: [false] } }
		],
		i18n: {
			ar: { title: 'تعديل بيانات PDF', desc: 'غيّر العنوان والمؤلف والموضوع، أو احذف كل البيانات المخفية قبل الإرسال.', keywords: ['بيانات', 'metadata', 'العنوان', 'المؤلف'] },
			en: { title: 'Edit PDF metadata', desc: 'Change title, author and subject — or wipe all hidden metadata before sending.', keywords: ['metadata', 'title', 'author', 'properties'] }
		}
	})
];
