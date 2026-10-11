import { inWorker } from '../workers/proxy';
import type { Tool } from './types';

const PDF = ['pdf', 'application/pdf'];
const tool = (t: Omit<Tool, 'load' | 'runtime' | 'category' | 'from' | 'maxMB' | 'batch' | 'engine' | 'to'>): Tool => ({
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
	})
];
