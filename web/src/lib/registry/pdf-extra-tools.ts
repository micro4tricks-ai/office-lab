import { inWorker } from '../workers/proxy';
import type { Tool } from './types';

const PDF = ['pdf', 'application/pdf'];
type Spec = Omit<Tool, 'load' | 'runtime' | 'category' | 'from' | 'maxMB' | 'batch' | 'engine' | 'to'> & Partial<Pick<Tool, 'engine' | 'load' | 'batch'>>;
const tool = (t: Spec): Tool => ({
	category: 'pdf',
	runtime: 'browser',
	from: PDF,
	to: ['pdf'],
	maxMB: 200,
	batch: true,
	engine: 'pdf-layout',
	load: inWorker('pdf-layout'),
	...t
});

export const pdfExtraTools: Tool[] = [
	tool({
		id: 'pdf-grayscale',
		params: { action: 'grayscale' },
		options: [
			{
				id: 'dpi',
				type: 'select',
				label: { ar: 'الدقة', en: 'Resolution' },
				default: '150',
				choices: [
					{ value: '100', label: { ar: '100 (ملف أصغر)', en: '100 DPI (smaller)' } },
					{ value: '150', label: { ar: '150', en: '150 DPI' } },
					{ value: '300', label: { ar: '300 (للطباعة)', en: '300 DPI (print)' } }
				]
			}
		],
		i18n: {
			ar: { title: 'تحويل PDF إلى أبيض وأسود', desc: 'وفّر الحبر الملون عند الطباعة. (تصبح الصفحات صورًا، فلا يمكن نسخ النص بعدها.)', keywords: ['أبيض وأسود', 'grayscale', 'رمادي', 'طباعة'] },
			en: { title: 'PDF to black & white', desc: 'Save colour ink when printing. (Pages become images, so text can no longer be copied.)', keywords: ['grayscale', 'black and white', 'print'] }
		}
	}),
	tool({
		id: 'pdf-n-up',
		params: { action: 'nup' },
		options: [
			{
				id: 'per',
				type: 'select',
				label: { ar: 'صفحات في الورقة', en: 'Pages per sheet' },
				default: '2',
				choices: [
					{ value: '2', label: { ar: '2 (ورقة عرضية)', en: '2 (landscape sheet)' } },
					{ value: '4', label: { ar: '4', en: '4' } }
				]
			},
			{
				id: 'order',
				type: 'select',
				label: { ar: 'الترتيب', en: 'Order' },
				default: 'ltr',
				choices: [
					{ value: 'rtl', label: { ar: 'من اليمين لليسار (عربي)', en: 'Right to left (Arabic)' } },
					{ value: 'ltr', label: { ar: 'من اليسار لليمين', en: 'Left to right' } }
				]
			}
		],
		i18n: {
			ar: { title: 'صفحتان أو أربع في ورقة واحدة', desc: 'اطبع أكثر من صفحة على الورقة لتوفير الورق — بترتيب عربي أو إنجليزي.', keywords: ['n-up', 'صفحتين في ورقة', 'توفير الورق'] },
			en: { title: 'Several pages per sheet (N-up)', desc: 'Print 2 or 4 pages on each sheet to save paper — Arabic or English order.', keywords: ['n-up', '2 pages per sheet', 'save paper'] }
		}
	}),
	tool({
		id: 'pdf-booklet',
		params: { action: 'booklet' },
		options: [
			{
				id: 'binding',
				type: 'select',
				label: { ar: 'التجليد', en: 'Binding' },
				default: 'right',
				choices: [
					{ value: 'right', label: { ar: 'من اليمين (كتاب عربي)', en: 'Right edge (Arabic book)' } },
					{ value: 'left', label: { ar: 'من اليسار (كتاب إنجليزي)', en: 'Left edge (English book)' } }
				]
			}
		],
		i18n: {
			ar: { title: 'تحويل PDF إلى كتيّب للطباعة', desc: 'رتّب الصفحات لتُطبع على الوجهين وتُطوى وتُدبّس ككتيّب — مع تجليد عربي من اليمين.', keywords: ['كتيب', 'booklet', 'طباعة كتيب', 'تدبيس'] },
			en: { title: 'Make a printable booklet', desc: 'Reorder pages to print double-sided, fold and staple as a booklet — Arabic right-edge binding too.', keywords: ['booklet', 'saddle stitch', 'imposition'] }
		}
	}),
	tool({
		id: 'pdf-add-blank-pages',
		params: { action: 'blank' },
		options: [
			{
				id: 'where',
				type: 'select',
				label: { ar: 'المكان', en: 'Where' },
				default: 'end',
				choices: [
					{ value: 'end', label: { ar: 'في النهاية', en: 'At the end' } },
					{ value: 'start', label: { ar: 'في البداية', en: 'At the start' } },
					{ value: 'each', label: { ar: 'بعد كل صفحة', en: 'After every page' } },
					{ value: 'after', label: { ar: 'بعد صفحة محددة', en: 'After a given page' } }
				]
			},
			{ id: 'after', type: 'number', label: { ar: 'بعد الصفحة رقم', en: 'After page' }, default: 1, min: 1, max: 100000, when: { id: 'where', in: ['after'] } }
		],
		i18n: {
			ar: { title: 'إضافة صفحات فارغة إلى PDF', desc: 'أضف صفحة بيضاء في البداية أو النهاية أو بعد كل صفحة (مفيد للطباعة على الوجهين).', keywords: ['صفحة فارغة', 'blank page', 'إضافة صفحة'] },
			en: { title: 'Add blank pages', desc: 'Insert a blank page at the start, the end, or after every page (handy for duplex printing).', keywords: ['blank page', 'insert page'] }
		}
	}),
	tool({
		id: 'pdf-header-footer',
		params: { action: 'header' },
		options: [
			{ id: 'header', type: 'text', label: { ar: 'نص الرأس', en: 'Header text' }, default: '', placeholder: { ar: 'مثل: اسم الشركة — {date}', en: 'e.g. Company name — {date}' } },
			{ id: 'footer', type: 'text', label: { ar: 'نص التذييل', en: 'Footer text' }, default: 'صفحة {page} من {pages}', placeholder: { ar: '{page} الصفحة، {pages} العدد، {file} اسم الملف', en: '{page}, {pages}, {date}, {file}' } },
			{
				id: 'align',
				type: 'select',
				label: { ar: 'المحاذاة', en: 'Alignment' },
				default: 'c',
				choices: [
					{ value: 'r', label: { ar: 'يمين', en: 'Right' } },
					{ value: 'c', label: { ar: 'وسط', en: 'Centre' } },
					{ value: 'l', label: { ar: 'يسار', en: 'Left' } }
				]
			},
			{
				id: 'digits',
				type: 'select',
				label: { ar: 'الأرقام', en: 'Digits' },
				default: 'latin',
				choices: [
					{ value: 'latin', label: { ar: '123', en: '123' } },
					{ value: 'arabic', label: { ar: '١٢٣', en: '١٢٣' } }
				]
			},
			{ id: 'size', type: 'number', label: { ar: 'حجم الخط', en: 'Font size' }, default: 10, min: 6, max: 36, unit: 'pt' },
			{ id: 'color', type: 'color', label: { ar: 'اللون', en: 'Colour' }, default: '#444444' },
			{ id: 'skipFirst', type: 'checkbox', label: { ar: 'بدون رأس وتذييل على الغلاف', en: 'Not on the cover page' }, default: false }
		],
		i18n: {
			ar: { title: 'إضافة رأس وتذييل للصفحات', desc: 'اكتب اسم الجهة والتاريخ ورقم الصفحة أعلى وأسفل كل صفحة، بالعربية أو الإنجليزية.', keywords: ['رأس الصفحة', 'تذييل', 'header', 'footer'] },
			en: { title: 'Add header & footer', desc: 'Put your organisation, the date and the page number at the top and bottom of every page — Arabic or English.', keywords: ['header', 'footer', 'page header'] }
		}
	}),
	tool({
		id: 'redact-pdf',
		engine: 'pdf-reshape',
		load: inWorker('pdf-reshape'),
		batch: false,
		editor: 'place',
		params: { action: 'redact', mode: 'redact' },
		options: [{
				id: 'dpi',
				type: 'select',
				label: { ar: 'الدقة', en: 'Resolution' },
				default: '200',
				choices: [
					{ value: '150', label: { ar: '150 (ملف أصغر)', en: '150 DPI (smaller)' } },
					{ value: '200', label: { ar: '200', en: '200 DPI' } },
					{ value: '300', label: { ar: '300 (للطباعة)', en: '300 DPI (print)' } }
				]
			}],
		i18n: {
			ar: { title: 'إخفاء معلومات من PDF (تنقيح)', desc: 'غطِّ الأسماء والأرقام والمبالغ بمربعات سوداء قبل إرسال الملف. تُحذف المعلومة فعلًا: الصفحات المغطّاة تصبح صورًا فلا يمكن نسخ ما تحتها.', keywords: ['تنقيح', 'إخفاء', 'redact', 'حجب', 'سري', 'إخفاء بيانات'] },
			en: { title: 'Redact PDF', desc: 'Black out names, numbers and amounts before sending a file. The text is really removed: covered pages become images, so nothing underneath can be copied.', keywords: ['redact', 'black out', 'hide text', 'censor', 'confidential'] }
		}
	}),
	tool({
		id: 'pdf-letterhead',
		engine: 'pdf-reshape',
		load: inWorker('pdf-reshape'),
		params: { action: 'overlay' },
		options: [
			{ id: 'layer', type: 'image', accept: '.pdf,application/pdf,image/png,image/jpeg', label: { ar: 'ورق الشركة (PDF أو صورة)', en: 'Letterhead (PDF or image)' }, default: null },
			{
				id: 'position',
				type: 'select',
				label: { ar: 'المكان', en: 'Where' },
				default: 'under',
				choices: [
					{ value: 'under', label: { ar: 'تحت النص (ورق رسمي)', en: 'Under the text (letterhead)' } },
					{ value: 'over', label: { ar: 'فوق النص (ختم أو إطار)', en: 'Over the text (stamp or frame)' } }
				]
			},
			{
				id: 'pages',
				type: 'select',
				label: { ar: 'الصفحات', en: 'Pages' },
				default: 'all',
				choices: [
					{ value: 'all', label: { ar: 'كل الصفحات', en: 'Every page' } },
					{ value: 'first', label: { ar: 'الصفحة الأولى فقط', en: 'First page only' } }
				]
			}
		],
		i18n: {
			ar: { title: 'طباعة على ورق الشركة (Letterhead)', desc: 'ضع ورق الشركة الرسمي (الشعار والعنوان والتذييل) خلف كل صفحات المستند، أو ضع ختمًا أو إطارًا فوقها.', keywords: ['ورق رسمي', 'letterhead', 'ترويسة', 'شعار الشركة', 'تراكب', 'overlay'] },
			en: { title: 'Add letterhead to PDF', desc: 'Put your company letterhead (logo, address, footer) behind every page, or a stamp or frame on top.', keywords: ['letterhead', 'overlay pdf', 'stationery', 'background', 'company logo'] }
		}
	}),
	tool({
		id: 'pdf-page-size',
		engine: 'pdf-reshape',
		load: inWorker('pdf-reshape'),
		params: { action: 'page-size' },
		options: [
			{
				id: 'size',
				type: 'select',
				label: { ar: 'المقاس', en: 'Size' },
				default: 'a4',
				choices: [
					{ value: 'a4', label: { ar: 'A4', en: 'A4' } },
					{ value: 'a3', label: { ar: 'A3', en: 'A3' } },
					{ value: 'a5', label: { ar: 'A5', en: 'A5' } },
					{ value: 'letter', label: { ar: 'Letter', en: 'Letter' } },
					{ value: 'legal', label: { ar: 'Legal', en: 'Legal' } }
				]
			},
			{
				id: 'orientation',
				type: 'select',
				label: { ar: 'الاتجاه', en: 'Orientation' },
				default: 'auto',
				choices: [
					{ value: 'auto', label: { ar: 'حسب كل صفحة', en: 'Match each page' } },
					{ value: 'portrait', label: { ar: 'طولي', en: 'Portrait' } },
					{ value: 'landscape', label: { ar: 'عرضي', en: 'Landscape' } }
				]
			},
			{ id: 'margin', type: 'number', label: { ar: 'الهامش', en: 'Margin' }, default: 0, min: 0, max: 50, unit: 'mm' }
		],
		i18n: {
			ar: { title: 'تغيير مقاس صفحات PDF', desc: 'اجعل كل الصفحات A4 (أو A3 أو A5 أو Letter) مع الحفاظ على النسب، مثلًا قبل الطباعة أو الرفع على بوابة حكومية.', keywords: ['مقاس الصفحة', 'a4', 'تغيير حجم الصفحة', 'page size'] },
			en: { title: 'Change PDF page size', desc: 'Make every page A4 (or A3, A5, Letter) keeping proportions — before printing or uploading to a portal.', keywords: ['page size', 'resize pdf pages', 'a4', 'letter'] }
		}
	}),
	tool({
		id: 'pdf-split-halves',
		engine: 'pdf-reshape',
		load: inWorker('pdf-reshape'),
		params: { action: 'halve' },
		options: [
			{
				id: 'direction',
				type: 'select',
				label: { ar: 'القص', en: 'Cut' },
				default: 'vertical',
				choices: [
					{ value: 'vertical', label: { ar: 'يمين ويسار (كتاب مفتوح)', en: 'Left and right (open book)' } },
					{ value: 'horizontal', label: { ar: 'أعلى وأسفل', en: 'Top and bottom' } }
				]
			},
			{
				id: 'order',
				type: 'select',
				label: { ar: 'الترتيب', en: 'Order' },
				default: 'rtl',
				when: { id: 'direction', in: ['vertical'] },
				choices: [
					{ value: 'rtl', label: { ar: 'اليمين أولًا (كتاب عربي)', en: 'Right first (Arabic book)' } },
					{ value: 'ltr', label: { ar: 'اليسار أولًا', en: 'Left first' } }
				]
			}
		],
		i18n: {
			ar: { title: 'قص صفحات PDF إلى نصفين', desc: 'حوّل صفحتين ممسوحتين معًا (كتاب مفتوح) إلى صفحتين منفصلتين، بترتيب الكتب العربية أو الإنجليزية.', keywords: ['قص الصفحة', 'نصفين', 'كتاب ممسوح', 'split pages'] },
			en: { title: 'Split PDF pages in half', desc: 'Turn scanned two-page spreads into single pages, in Arabic (right first) or English order.', keywords: ['split pages in half', 'halve', 'scanned book', 'spread'] }
		}
	}),
	tool({
		id: 'flatten-pdf',
		engine: 'pdf-reshape',
		load: inWorker('pdf-reshape'),
		params: { action: 'flatten' },
		options: [
			{
				id: 'mode',
				type: 'select',
				label: { ar: 'ماذا يُثبَّت', en: 'Flatten' },
				default: 'forms',
				choices: [
					{ value: 'forms', label: { ar: 'خانات النماذج فقط (يبقى النص قابلًا للنسخ)', en: 'Form fields only (text stays copyable)' } },
					{ value: 'image', label: { ar: 'كل شيء — تحويل الصفحات إلى صور', en: 'Everything — pages become images' } }
				]
			},
			{
				id: 'dpi',
				type: 'select',
				label: { ar: 'الدقة', en: 'Resolution' },
				default: '200',
				when: { id: 'mode', in: ['image'] },
				choices: [
					{ value: '150', label: { ar: '150 (ملف أصغر)', en: '150 DPI (smaller)' } },
					{ value: '200', label: { ar: '200', en: '200 DPI' } },
					{ value: '300', label: { ar: '300 (للطباعة)', en: '300 DPI (print)' } }
				]
			}
		],
		i18n: {
			ar: { title: 'تثبيت PDF (Flatten)', desc: 'ثبّت قيم النماذج والتعليقات حتى لا يمكن تعديلها، أو حوّل الصفحات إلى صور تمامًا مثل نسخة مطبوعة ممسوحة.', keywords: ['flatten', 'تثبيت', 'تسطيح', 'منع التعديل', 'تحويل pdf لصور'] },
			en: { title: 'Flatten PDF', desc: 'Lock form values and comments so they can’t be changed, or turn the pages into images like a printed scan.', keywords: ['flatten pdf', 'rasterize pdf', 'lock form', 'print to image'] }
		}
	})
];
