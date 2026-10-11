import { IMAGE_INPUTS } from '../adapters/image/formats';
import { inWorker } from '../workers/proxy';
import { widgetTool } from './office-tools';
import type { Tool } from './types';

export const filesTools: Tool[] = [
	widgetTool('qr-code', 'qr', 'office', {
		ar: { title: 'صانع كود QR', desc: 'كود QR لرابط أو نص عربي أو شبكة Wi-Fi أو جهة اتصال، بالألوان التي تريدها — PNG أو SVG.', keywords: ['qr', 'كود qr', 'باركود', 'wifi'] },
		en: { title: 'QR code maker', desc: 'A QR code for a link, Arabic text, a Wi-Fi network or a contact, in your colours — PNG or SVG.', keywords: ['qr code', 'qr generator', 'wifi qr'] }
	}),
	{
		id: 'read-qr',
		category: 'office',
		from: IMAGE_INPUTS,
		to: ['txt'],
		runtime: 'browser',
		engine: 'read-qr',
		load: inWorker('read-qr'),
		maxMB: 30,
		batch: true,
		i18n: {
			ar: { title: 'قراءة كود QR من صورة', desc: 'ارفع صورة أو لقطة شاشة فيها كود QR واحصل على محتواه.', keywords: ['قراءة qr', 'qr reader', 'مسح qr'] },
			en: { title: 'Read a QR code from an image', desc: 'Upload a photo or screenshot with a QR code and get what it says.', keywords: ['qr reader', 'scan qr', 'decode qr'] }
		}
	},
	widgetTool('barcode', 'barcode', 'office', {
		ar: { title: 'صانع الباركود', desc: 'باركود EAN13 للمنتجات أو CODE128 وغيرها، جاهز للطباعة على الملصقات.', keywords: ['باركود', 'barcode', 'ean13', 'code128'] },
		en: { title: 'Barcode maker', desc: 'EAN13 for products, CODE128 and more — ready for label printing.', keywords: ['barcode', 'ean13', 'code128', 'upc'] }
	}),
	{
		id: 'create-zip',
		category: 'files',
		from: ['*'],
		to: ['zip'],
		runtime: 'browser',
		engine: 'zip',
		load: inWorker('zip'),
		params: { action: 'create' },
		combine: { min: 1 },
		options: [
			{
				id: 'level',
				type: 'select',
				label: { ar: 'الضغط', en: 'Compression' },
				default: 'normal',
				choices: [
					{ value: 'normal', label: { ar: 'عادي', en: 'Normal' } },
					{ value: 'max', label: { ar: 'أقصى ضغط (أبطأ)', en: 'Maximum (slower)' } },
					{ value: 'store', label: { ar: 'بدون ضغط (أسرع)', en: 'No compression (fastest)' } }
				]
			}
		],
		maxMB: 200,
		batch: true,
		i18n: {
			ar: { title: 'ضغط ملفات في ZIP', desc: 'اجمع أي ملفات في ملف ZIP واحد لإرسالها بسهولة.', keywords: ['zip', 'ضغط ملفات', 'أرشيف'] },
			en: { title: 'Create a ZIP', desc: 'Put any files into one ZIP to send them easily.', keywords: ['zip', 'compress files', 'archive'] }
		}
	},
	{
		id: 'extract-zip',
		category: 'files',
		from: ['zip', 'application/zip', 'application/x-zip-compressed'],
		to: ['*'],
		runtime: 'browser',
		engine: 'zip',
		load: inWorker('zip'),
		params: { action: 'extract' },
		maxMB: 300,
		batch: true,
		i18n: {
			ar: { title: 'فك ضغط ZIP', desc: 'افتح ملف ZIP ونزّل ما بداخله ملفًا ملفًا أو كلها مرة واحدة.', keywords: ['فك ضغط', 'unzip', 'extract zip'] },
			en: { title: 'Extract a ZIP', desc: 'Open a ZIP and download what is inside, one by one or all at once.', keywords: ['unzip', 'extract zip', 'open zip'] }
		}
	},
	{
		id: 'batch-rename',
		category: 'files',
		from: ['*'],
		to: ['*'],
		runtime: 'browser',
		engine: 'rename',
		load: inWorker('rename'),
		combine: { min: 1 },
		options: [
			{ id: 'pattern', type: 'text', label: { ar: 'الاسم الجديد', en: 'New name' }, default: '{name}-{n}', placeholder: { ar: '{name} الاسم، {n} رقم، {date} التاريخ', en: '{name} name, {n} number, {date} date' } },
			{ id: 'start', type: 'number', label: { ar: 'يبدأ الترقيم من', en: 'Start numbering at' }, default: 1, min: 0, max: 100000 },
			{ id: 'digits', type: 'number', label: { ar: 'عدد الخانات (001)', en: 'Digits (001)' }, default: 3, min: 1, max: 6 },
			{ id: 'find', type: 'text', label: { ar: 'استبدال نص (اختياري)', en: 'Replace text (optional)' }, default: '' },
			{ id: 'replace', type: 'text', label: { ar: 'بـ', en: 'With' }, default: '' }
		],
		maxMB: 200,
		batch: true,
		i18n: {
			ar: { title: 'إعادة تسمية ملفات كثيرة', desc: 'سمِّ عشرات الملفات دفعة واحدة بنمط وترقيم (مثل فاتورة-001)، ونزّلها في ZIP.', keywords: ['إعادة تسمية', 'rename', 'تسمية ملفات'] },
			en: { title: 'Batch rename files', desc: 'Rename dozens of files at once with a pattern and numbering (like invoice-001), then download as a ZIP.', keywords: ['batch rename', 'rename files', 'bulk rename'] }
		}
	}
];
