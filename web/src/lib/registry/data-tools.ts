import { inWorker } from '../workers/proxy';
import type { OptionSpec, Tool } from './types';

/** Spreadsheet inputs: Excel (new and old), OpenDocument, CSV/TSV, JSON arrays. */
export const SHEET_INPUTS = [
	'xlsx', 'xlsm', 'xls', 'ods', 'csv', 'tsv', 'json',
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel',
	'application/vnd.oasis.opendocument.spreadsheet', 'text/csv', 'text/tab-separated-values', 'application/json'
];
const TEXT_DATA = ['json', 'yaml', 'yml', 'xml', 'toml', 'application/json', 'application/yaml', 'application/xml', 'text/xml', 'application/toml'];

const sheets: OptionSpec = {
	id: 'sheets',
	type: 'select',
	label: { ar: 'الأوراق (الشيتات)', en: 'Sheets' },
	default: 'all',
	choices: [
		{ value: 'all', label: { ar: 'كل الأوراق (ملف لكل ورقة)', en: 'All sheets (one file each)' } },
		{ value: 'first', label: { ar: 'الورقة الأولى فقط', en: 'First sheet only' } }
	]
};

type Base = Omit<Tool, 'load' | 'runtime' | 'category' | 'maxMB' | 'batch' | 'engine'> & { engine?: string };
const data = (t: Base): Tool => {
	const engine = t.engine ?? 'data-convert';
	return { category: 'data', runtime: 'browser', maxMB: 100, batch: true, ...t, engine, load: inWorker(engine) };
};

const sheetTool = (id: string, to: string, ar: string, en: string, descAr: string, descEn: string, kw: string[], options: OptionSpec[] = []): Tool =>
	data({
		id,
		from: SHEET_INPUTS,
		to: [to],
		params: { to },
		options: [sheets, ...options],
		i18n: {
			ar: { title: ar, desc: descAr, keywords: [...kw, 'إكسل', 'excel'] },
			en: { title: en, desc: descEn, keywords: [...kw, 'excel', 'spreadsheet'] }
		}
	});

const formatTool = (to: 'json' | 'yaml' | 'xml' | 'toml'): Tool =>
	data({
		id: `convert-to-${to}`,
		engine: 'data-format',
		from: TEXT_DATA,
		to: [to],
		params: { to },
		i18n: {
			ar: { title: `تحويل إلى ${to.toUpperCase()}`, desc: `حوّل بين JSON وYAML وXML وTOML — الناتج ${to.toUpperCase()}.`, keywords: [to, 'json', 'yaml', 'xml', 'toml'] },
			en: { title: `Convert to ${to.toUpperCase()}`, desc: `Convert between JSON, YAML, XML and TOML — output ${to.toUpperCase()}.`, keywords: [to, 'json', 'yaml', 'xml', 'toml', 'converter'] }
		}
	});

export const dataTools: Tool[] = [
	sheetTool(
		'excel-to-csv', 'csv', 'تحويل Excel إلى CSV', 'Excel to CSV',
		'كل ورقة تصبح ملف CSV يفتحه Excel بالعربي سليمًا (UTF-8 مع BOM).',
		'Each sheet becomes a CSV that Excel opens with Arabic intact (UTF-8 with BOM).',
		['csv'],
		[
			{
				id: 'delimiter',
				type: 'select',
				label: { ar: 'الفاصل', en: 'Separator' },
				default: 'comma',
				choices: [
					{ value: 'comma', label: { ar: 'فاصلة ,', en: 'Comma ,' } },
					{ value: 'semicolon', label: { ar: 'فاصلة منقوطة ;', en: 'Semicolon ;' } },
					{ value: 'tab', label: { ar: 'Tab', en: 'Tab' } }
				]
			},
			{ id: 'bom', type: 'checkbox', label: { ar: 'متوافق مع Excel (BOM)', en: 'Excel-friendly (BOM)' }, default: true }
		]
	),
	sheetTool('excel-to-json', 'json', 'تحويل Excel إلى JSON', 'Excel to JSON', 'كل صف يصبح كائن JSON بعناوين الأعمدة.', 'Each row becomes a JSON object keyed by the column headers.', ['json']),
	sheetTool('excel-to-html', 'html', 'تحويل Excel إلى جدول HTML', 'Excel to HTML table', 'صفحة HTML بجدول منسق، تُعرض من اليمين لليسار تلقائيًا للعربي.', 'A styled HTML table page, right-to-left automatically for Arabic.', ['html', 'table']),
	sheetTool('excel-to-markdown', 'md', 'تحويل Excel إلى جدول Markdown', 'Excel to Markdown table', 'جدول Markdown جاهز للصق في GitHub أو المستندات.', 'A Markdown table ready to paste into GitHub or docs.', ['markdown', 'md', 'table']),
	sheetTool(
		'excel-to-sql', 'sql', 'تحويل Excel إلى SQL', 'Excel to SQL',
		'أوامر INSERT (ومعها CREATE TABLE) لإدخال البيانات في أي قاعدة بيانات.',
		'INSERT statements (plus CREATE TABLE) to load the data into any database.',
		['sql', 'insert', 'database'],
		[
			{ id: 'table', type: 'text', label: { ar: 'اسم الجدول (فارغ = اسم الورقة)', en: 'Table name (empty = sheet name)' }, default: '' },
			{ id: 'create', type: 'checkbox', label: { ar: 'إضافة CREATE TABLE', en: 'Include CREATE TABLE' }, default: true }
		]
	),
	data({
		id: 'convert-to-excel',
		from: SHEET_INPUTS,
		to: ['xlsx'],
		params: { to: 'xlsx' },
		options: [sheets],
		i18n: {
			ar: { title: 'تحويل إلى Excel', desc: 'حوّل CSV أو JSON أو ODS أو XLS القديم إلى XLSX، مع اتجاه يمين-لليسار للعربي.', keywords: ['csv to excel', 'json to excel', 'xlsx', 'إكسل'] },
			en: { title: 'Convert to Excel', desc: 'Turn CSV, JSON, ODS or old XLS into XLSX — right-to-left sheets for Arabic.', keywords: ['csv to excel', 'json to excel', 'xlsx'] }
		}
	}),
	formatTool('json'),
	formatTool('yaml'),
	formatTool('xml'),
	formatTool('toml')
];
