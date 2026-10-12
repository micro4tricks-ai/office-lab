import type { Tool, WidgetKey } from './types';

/** Tools that are a page of their own (no file to upload): calculators and text helpers. */
export const widgetTool = (id: string, key: WidgetKey, category: Tool['category'], i18n: Tool['i18n']): Tool => ({
	id,
	category,
	from: [],
	to: [],
	runtime: 'browser',
	engine: '',
	load: async () => {
		throw new Error(`${id} is a widget`);
	},
	widget: key,
	maxMB: 0,
	batch: false,
	i18n
});

export const officeTools: Tool[] = [
	widgetTool('translate-document', 'translate', 'document', {
		ar: { title: 'ترجمة المستندات (إنجليزي ↔ عربي)', desc: 'ترجم ملفات Word وPowerPoint وExcel والنصوص مع الحفاظ على التنسيق والجداول، ويصبح الاتجاه من اليمين لليسار تلقائيًا. الترجمة المجانية تتم على جهازك ولا يُرفع الملف.', keywords: ['ترجمة', 'ترجمة ملف', 'ترجمة وورد', 'ترجمة pdf', 'انجليزي عربي', 'translate'] },
		en: { title: 'Translate documents (English ↔ Arabic)', desc: 'Translate Word, PowerPoint, Excel and text files keeping layout and tables; Arabic output turns right-to-left by itself. The free translation runs on your device — the file is not uploaded.', keywords: ['translate document', 'english to arabic', 'arabic to english', 'translate word', 'translate pdf'] }
	}),
	widgetTool('invoice-maker', 'invoice', 'office', {
		ar: { title: 'إنشاء فاتورة PDF', desc: 'فاتورة عربية جاهزة للطباعة: الأصناف والخصم وضريبة القيمة المضافة والإجمالي بالحروف، وشعار شركتك، ورمز QR لهيئة الزكاة (السعودية).', keywords: ['فاتورة', 'فاتورة ضريبية', 'invoice', 'عرض سعر', 'زاتكا', 'فاتورة إلكترونية'] },
		en: { title: 'Invoice maker (PDF)', desc: 'A print-ready Arabic/English invoice: items, discount, VAT, total in words, your logo, and the Saudi ZATCA QR code.', keywords: ['invoice', 'tax invoice', 'invoice generator', 'zatca', 'arabic invoice'] }
	}),
	widgetTool('tafqeet', 'tafqeet', 'office', {
		ar: { title: 'تفقيط المبالغ (المبلغ بالحروف)', desc: 'اكتب المبلغ واحصل عليه بالحروف للفواتير والشيكات: «فقط ألف وخمسمائة جنيه مصري لا غير» — بالجنيه والريال والدرهم والدينار والدولار.', keywords: ['تفقيط', 'المبلغ بالحروف', 'كتابة الأرقام', 'شيكات', 'فواتير'] },
		en: { title: 'Amount in words (Arabic tafqeet)', desc: 'Turn an amount into Arabic and English words for invoices and cheques — EGP, SAR, AED, KWD, USD, EUR.', keywords: ['tafqeet', 'number to words', 'arabic', 'cheque', 'invoice'] }
	}),
	widgetTool('hijri-date', 'hijri', 'office', {
		ar: { title: 'تحويل التاريخ هجري / ميلادي', desc: 'حوّل أي تاريخ من الميلادي إلى الهجري والعكس، بتقويم أم القرى.', keywords: ['هجري', 'ميلادي', 'تحويل التاريخ', 'أم القرى'] },
		en: { title: 'Hijri ↔ Gregorian date', desc: 'Convert any date between Hijri and Gregorian (Umm al-Qura calendar).', keywords: ['hijri', 'gregorian', 'date converter', 'umm al-qura'] }
	}),
	widgetTool('arabic-text', 'arabic-text', 'office', {
		ar: { title: 'أدوات النص العربي', desc: 'أزل التشكيل والتطويل، وحوّل الأرقام بين ١٢٣ و123، ووحّد الحروف للبحث، وعُدّ الكلمات.', keywords: ['إزالة التشكيل', 'تشكيل', 'أرقام عربية', 'عد الكلمات'] },
		en: { title: 'Arabic text tools', desc: 'Remove diacritics and tatweel, switch digits between ١٢٣ and 123, normalise letters, count words.', keywords: ['remove tashkeel', 'arabic diacritics', 'arabic digits', 'word count'] }
	}),
	widgetTool('vat-calculator', 'vat', 'office', {
		ar: { title: 'حاسبة ضريبة القيمة المضافة', desc: 'أضف الضريبة أو استخرجها من المبلغ (مصر ١٤٪، السعودية ١٥٪، الإمارات ٥٪) مع الإجمالي بالحروف.', keywords: ['ضريبة القيمة المضافة', 'vat', 'حاسبة الضريبة'] },
		en: { title: 'VAT calculator', desc: 'Add VAT to an amount or take it out (Egypt 14%, Saudi 15%, UAE 5%), with the total in Arabic words.', keywords: ['vat', 'tax calculator', 'value added tax'] }
	})
];
