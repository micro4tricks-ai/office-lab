import { inWorker } from '../workers/proxy';
import { SHEET_INPUTS } from './data-tools';
import type { Tool } from './types';

type Base = Omit<Tool, 'load' | 'runtime' | 'category' | 'maxMB' | 'batch' | 'engine'>;
const sheetOp = (t: Base): Tool => ({ category: 'data', runtime: 'browser', maxMB: 100, batch: true, engine: 'sheet-ops', load: inWorker('sheet-ops'), ...t });

export const dataExtraTools: Tool[] = [
	sheetOp({
		id: 'merge-excel',
		from: SHEET_INPUTS,
		to: ['xlsx'],
		combine: { min: 2 },
		options: [
			{
				id: 'mode',
				type: 'select',
				label: { ar: 'طريقة الدمج', en: 'How to merge' },
				default: 'stack',
				choices: [
					{ value: 'stack', label: { ar: 'تحت بعض في جدول واحد', en: 'Stacked in one table' } },
					{ value: 'sheets', label: { ar: 'كل ملف في ورقة منفصلة', en: 'Each file as its own sheet' } }
				]
			},
			{ id: 'source', type: 'checkbox', label: { ar: 'إضافة عمود باسم الملف المصدر', en: 'Add a column with the source file' }, default: true, when: { id: 'mode', in: ['stack'] } }
		],
		i18n: {
			ar: { title: 'دمج ملفات Excel', desc: 'اجمع عدة ملفات Excel أو CSV في ملف واحد — تحت بعض (تُطابق الأعمدة بأسمائها) أو كل ملف في ورقة.', keywords: ['دمج اكسل', 'merge excel', 'جمع شيتات'] },
			en: { title: 'Merge Excel files', desc: 'Combine several Excel or CSV files into one — stacked (columns matched by name) or one sheet each.', keywords: ['merge excel', 'combine spreadsheets', 'merge csv'] }
		}
	}),
	sheetOp({
		id: 'split-excel',
		from: SHEET_INPUTS,
		to: ['xlsx'],
		params: { action: 'split' },
		options: [
			{
				id: 'by',
				type: 'select',
				label: { ar: 'التقسيم حسب', en: 'Split by' },
				default: 'column',
				choices: [
					{ value: 'column', label: { ar: 'قيمة عمود (ملف لكل فرع/مدينة…)', en: 'A column value (a file per branch, city…)' } },
					{ value: 'rows', label: { ar: 'عدد الصفوف', en: 'Number of rows' } }
				]
			},
			{ id: 'column', type: 'text', required: true, label: { ar: 'اسم العمود', en: 'Column name' }, default: '', placeholder: { ar: 'مثل: المدينة', en: 'e.g. City' }, when: { id: 'by', in: ['column'] } },
			{ id: 'rows', type: 'number', label: { ar: 'صفوف في كل ملف', en: 'Rows per file' }, default: 100, min: 1, max: 1000000, when: { id: 'by', in: ['rows'] } }
		],
		i18n: {
			ar: { title: 'تقسيم ملف Excel', desc: 'ملف لكل قيمة في عمود (لكل فرع أو مدينة أو موظف)، أو كل عدد من الصفوف — مع عناوين الأعمدة في كل ملف.', keywords: ['تقسيم اكسل', 'split excel', 'فصل البيانات'] },
			en: { title: 'Split an Excel file', desc: 'One file per value in a column (each branch, city or employee) or every N rows — headers kept in each.', keywords: ['split excel', 'split spreadsheet', 'split csv'] }
		}
	}),
	sheetOp({
		id: 'remove-duplicates',
		from: SHEET_INPUTS,
		to: ['xlsx'],
		params: { action: 'dedupe' },
		options: [{ id: 'columns', type: 'text', label: { ar: 'الأعمدة المعتمدة (فارغ = الصف كله)', en: 'Columns to compare (empty = whole row)' }, default: '', placeholder: { ar: 'مثل: الهاتف، البريد', en: 'e.g. Phone, Email' } }],
		i18n: {
			ar: { title: 'حذف الصفوف المكررة', desc: 'احذف التكرار من الجداول وقوائم العملاء — بمقارنة الصف كله أو أعمدة تختارها مثل الهاتف.', keywords: ['حذف المكرر', 'remove duplicates', 'تكرار'] },
			en: { title: 'Remove duplicate rows', desc: 'Remove repeats from tables and customer lists — compare whole rows or chosen columns like Phone.', keywords: ['remove duplicates', 'dedupe', 'unique rows'] }
		}
	}),
	sheetOp({
		id: 'clean-data',
		from: SHEET_INPUTS,
		to: ['xlsx'],
		params: { action: 'clean' },
		options: [
			{
				id: 'digits',
				type: 'select',
				label: { ar: 'الأرقام', en: 'Digits' },
				default: 'western',
				choices: [
					{ value: 'western', label: { ar: 'تحويل ١٢٣ إلى 123', en: 'Make ١٢٣ into 123' } },
					{ value: 'arabic', label: { ar: 'تحويل 123 إلى ١٢٣', en: 'Make 123 into ١٢٣' } },
					{ value: 'keep', label: { ar: 'كما هي', en: 'Keep' } }
				]
			},
			{ id: 'tashkeel', type: 'checkbox', label: { ar: 'إزالة التشكيل', en: 'Remove Arabic diacritics' }, default: false }
		],
		i18n: {
			ar: { title: 'تنظيف بيانات Excel', desc: 'احذف المسافات الزائدة والصفوف والأعمدة الفارغة، ووحّد الأرقام العربية والإنجليزية.', keywords: ['تنظيف البيانات', 'clean data', 'مسافات زائدة'] },
			en: { title: 'Clean spreadsheet data', desc: 'Trim extra spaces, drop empty rows and columns, unify Arabic and Western digits.', keywords: ['clean data', 'trim spaces', 'tidy spreadsheet'] }
		}
	}),
	sheetOp({
		id: 'excel-to-vcard',
		from: SHEET_INPUTS,
		to: ['vcf'],
		params: { action: 'to-vcard' },
		i18n: {
			ar: { title: 'جهات اتصال من Excel إلى الموبايل', desc: 'حوّل قائمة الأسماء والأرقام إلى ملف vCard يُستورد في الموبايل أو Gmail مرة واحدة.', keywords: ['جهات اتصال', 'vcard', 'vcf', 'استيراد أرقام'] },
			en: { title: 'Excel contacts to phone (vCard)', desc: 'Turn a list of names and numbers into a vCard file your phone or Gmail imports in one go.', keywords: ['vcard', 'vcf', 'excel to contacts'] }
		}
	}),
	sheetOp({
		id: 'vcard-to-excel',
		from: ['vcf', 'vcard', 'text/vcard', 'text/x-vcard'],
		to: ['xlsx'],
		params: { action: 'from-vcard' },
		i18n: {
			ar: { title: 'جهات اتصال الموبايل إلى Excel', desc: 'حوّل ملف vCard (من الموبايل أو Gmail) إلى جدول Excel بالأسماء والأرقام والبريد.', keywords: ['vcard', 'vcf', 'جهات اتصال إلى اكسل'] },
			en: { title: 'Phone contacts (vCard) to Excel', desc: 'Turn a vCard file (from a phone or Gmail) into an Excel table of names, numbers and emails.', keywords: ['vcard to excel', 'vcf to excel', 'contacts'] }
		}
	})
];
