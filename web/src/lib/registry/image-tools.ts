import { inWorker } from '../workers/proxy';
import { IMAGE_INPUTS } from '../adapters/image/formats';
import type { OptionSpec, Tool } from './types';

const quality = (def: number): OptionSpec => ({
	id: 'quality',
	type: 'range',
	label: { ar: 'الجودة', en: 'Quality' },
	default: def,
	min: 10,
	max: 100,
	unit: '%'
});

const formatChoice = (extra: string[] = []): OptionSpec => ({
	id: 'format',
	type: 'select',
	label: { ar: 'صيغة الناتج', en: 'Output format' },
	default: 'same',
	choices: [
		{ value: 'same', label: { ar: 'نفس صيغة الأصل', en: 'Same as original' } },
		...['jpg', 'webp', ...extra].map((f) => ({ value: f, label: { ar: f.toUpperCase(), en: f.toUpperCase() } }))
	]
});

type Conv = { id: string; to: string; ar: string; en: string; descAr: string; descEn: string; q?: number; kw: string[] };

const converters: Conv[] = [
	{ id: 'convert-to-jpg', to: 'jpg', ar: 'تحويل الصور إلى JPG', en: 'Convert images to JPG', q: 85, kw: ['jpg', 'jpeg', 'png to jpg', 'webp to jpg'],
		descAr: 'حوّل PNG وWebP وHEIC وAVIF وTIFF وغيرها إلى JPG بالجودة التي تختارها.',
		descEn: 'Turn PNG, WebP, HEIC, AVIF, TIFF and more into JPG at the quality you choose.' },
	{ id: 'convert-to-png', to: 'png', ar: 'تحويل الصور إلى PNG', en: 'Convert images to PNG', kw: ['png', 'jpg to png', 'webp to png', 'svg to png'],
		descAr: 'حوّل أي صورة إلى PNG بدون فقد في الجودة، مع الحفاظ على الشفافية.',
		descEn: 'Turn any image into lossless PNG, keeping transparency.' },
	{ id: 'convert-to-webp', to: 'webp', ar: 'تحويل الصور إلى WebP', en: 'Convert images to WebP', q: 80, kw: ['webp', 'jpg to webp', 'png to webp'],
		descAr: 'صيغة WebP أصغر حجمًا بكثير ومناسبة لمواقع الإنترنت.',
		descEn: 'WebP is much smaller and made for websites.' },
	{ id: 'convert-to-avif', to: 'avif', ar: 'تحويل الصور إلى AVIF', en: 'Convert images to AVIF', q: 60, kw: ['avif', 'jpg to avif', 'png to avif'],
		descAr: 'AVIF أحدث صيغة وأصغر حجمًا بنفس الجودة (التحويل أبطأ قليلًا).',
		descEn: 'AVIF is the newest, smallest format at the same quality (slower to make).' },
	{ id: 'convert-to-ico', to: 'ico', ar: 'تحويل صورة إلى أيقونة ICO', en: 'Convert an image to ICO', kw: ['ico', 'icon', 'png to ico', 'أيقونة'],
		descAr: 'أيقونة ‎.ico‎ بعدة مقاسات داخل ملف واحد (16 حتى 256 بكسل).',
		descEn: 'A .ico icon with several sizes in one file (16 to 256 px).' }
];

const converterTools: Tool[] = converters.map((c) => ({
	id: c.id,
	category: 'image',
	from: IMAGE_INPUTS,
	to: [c.to],
	runtime: 'browser',
	engine: 'image-convert',
	load: inWorker('image-convert'),
	params: { format: c.to },
	options: c.q ? [quality(c.q)] : [],
	maxMB: 50,
	batch: true,
	i18n: {
		ar: { title: c.ar, desc: c.descAr, keywords: [...c.kw, 'تحويل صور'] },
		en: { title: c.en, desc: c.descEn, keywords: [...c.kw, 'image converter'] }
	}
}));

export const imageTools: Tool[] = [
	...converterTools,
	{
		id: 'heic-to-jpg',
		category: 'image',
		from: ['heic', 'heif', 'image/heic', 'image/heif'],
		to: ['jpg'],
		runtime: 'browser',
		engine: 'image-convert',
		load: inWorker('image-convert'),
		params: { format: 'jpg' },
		options: [quality(88)],
		maxMB: 50,
		batch: true,
		i18n: {
			ar: { title: 'تحويل صور الآيفون HEIC إلى JPG', desc: 'افتح صور الآيفون على أي جهاز: حوّل HEIC إلى JPG، وتُحذف بيانات الموقع تلقائيًا.', keywords: ['heic', 'heif', 'آيفون', 'iphone'] },
			en: { title: 'HEIC (iPhone) to JPG', desc: 'Open iPhone photos anywhere: HEIC to JPG, with location data removed.', keywords: ['heic', 'heif', 'iphone'] }
		}
	},
	{
		id: 'image-to-pdf',
		category: 'pdf',
		from: IMAGE_INPUTS,
		to: ['pdf'],
		runtime: 'browser',
		engine: 'image-convert',
		load: inWorker('image-convert'),
		params: { format: 'pdf', quality: 90 },
		maxMB: 50,
		batch: true,
		i18n: {
			ar: { title: 'تحويل صورة إلى PDF', desc: 'كل صورة تصبح ملف PDF بصفحة بمقاسها الأصلي.', keywords: ['jpg to pdf', 'صورة pdf', 'png to pdf'] },
			en: { title: 'Image to PDF', desc: 'Each image becomes a PDF with one page at its own size.', keywords: ['jpg to pdf', 'png to pdf', 'image to pdf'] }
		}
	},
	{
		id: 'compress-image',
		category: 'image',
		from: IMAGE_INPUTS,
		to: ['jpg', 'png', 'webp', 'avif'],
		runtime: 'browser',
		engine: 'image-compress',
		load: inWorker('image-compress'),
		options: [quality(75), formatChoice(['avif'])],
		maxMB: 50,
		batch: true,
		i18n: {
			ar: { title: 'ضغط الصور', desc: 'قلّل حجم الصور مع الحفاظ على شكلها، وشاهد الحجم قبل وبعد.', keywords: ['compress', 'ضغط', 'تصغير حجم'] },
			en: { title: 'Compress images', desc: 'Make images smaller while keeping them looking good; see the size before and after.', keywords: ['compress', 'optimize', 'reduce size'] }
		}
	},
	{
		id: 'resize-image',
		category: 'image',
		from: IMAGE_INPUTS,
		to: ['jpg', 'png', 'webp', 'avif'],
		runtime: 'browser',
		engine: 'image-resize',
		load: inWorker('image-resize'),
		options: [
			{
				id: 'mode',
				type: 'select',
				label: { ar: 'طريقة تغيير الحجم', en: 'Resize by' },
				default: 'px',
				choices: [
					{ value: 'px', label: { ar: 'الأبعاد بالبكسل', en: 'Pixels' } },
					{ value: 'percent', label: { ar: 'نسبة مئوية', en: 'Percentage' } },
					{ value: 'kb', label: { ar: 'حجم الملف (ك.ب)', en: 'File size (KB)' } }
				]
			},
			{ id: 'width', type: 'number', label: { ar: 'العرض', en: 'Width' }, default: 1280, min: 0, max: 20000, unit: 'px', when: { id: 'mode', in: ['px'] } },
			{ id: 'height', type: 'number', label: { ar: 'الارتفاع (0 = تلقائي)', en: 'Height (0 = auto)' }, default: 0, min: 0, max: 20000, unit: 'px', when: { id: 'mode', in: ['px'] } },
			{ id: 'keepRatio', type: 'checkbox', label: { ar: 'الحفاظ على النسبة', en: 'Keep aspect ratio' }, default: true, when: { id: 'mode', in: ['px'] } },
			{ id: 'percent', type: 'range', label: { ar: 'النسبة', en: 'Percent' }, default: 50, min: 1, max: 200, unit: '%', when: { id: 'mode', in: ['percent'] } },
			{ id: 'targetKB', type: 'number', label: { ar: 'الحجم المطلوب', en: 'Target size' }, default: 200, min: 5, max: 50000, unit: 'KB', when: { id: 'mode', in: ['kb'] } },
			formatChoice(['png', 'avif']),
			{ ...quality(85), when: { id: 'mode', in: ['px', 'percent'] } }
		],
		maxMB: 50,
		batch: true,
		i18n: {
			ar: { title: 'تغيير حجم الصور', desc: 'غيّر الأبعاد بالبكسل أو بالنسبة، أو صغّر الصورة لحجم ملف محدد بالكيلوبايت (مثل 200 ك.ب للتقديم الإلكتروني).', keywords: ['resize', 'تغيير الحجم', 'تصغير', 'kb'] },
			en: { title: 'Resize images', desc: 'Change dimensions in pixels or percent, or shrink to an exact file size in KB (e.g. 200 KB for online forms).', keywords: ['resize', 'scale', 'kb', 'target size'] }
		}
	},
	{
		id: 'crop-rotate-image',
		category: 'image',
		from: IMAGE_INPUTS,
		to: ['jpg', 'png', 'webp', 'avif'],
		runtime: 'browser',
		engine: 'image-transform',
		load: inWorker('image-transform'),
		options: [
			{
				id: 'rotate',
				type: 'select',
				label: { ar: 'تدوير', en: 'Rotate' },
				default: '0',
				choices: [
					{ value: '0', label: { ar: 'بدون', en: 'None' } },
					{ value: '90', label: { ar: '90° مع عقارب الساعة', en: '90° clockwise' } },
					{ value: '180', label: { ar: '180°', en: '180°' } },
					{ value: '270', label: { ar: '90° عكس عقارب الساعة', en: '90° counter-clockwise' } }
				]
			},
			{ id: 'flipH', type: 'checkbox', label: { ar: 'قلب أفقي', en: 'Flip horizontally' }, default: false },
			{ id: 'flipV', type: 'checkbox', label: { ar: 'قلب رأسي', en: 'Flip vertically' }, default: false },
			{
				id: 'aspect',
				type: 'select',
				label: { ar: 'قص بنسبة (من المنتصف)', en: 'Crop to ratio (centred)' },
				default: 'original',
				choices: [
					{ value: 'original', label: { ar: 'بدون قص', en: 'No crop' } },
					...['1:1', '4:3', '3:2', '16:9', '3:4', '2:3', '9:16'].map((r) => ({ value: r, label: { ar: r, en: r } }))
				]
			}
		],
		maxMB: 50,
		batch: true,
		i18n: {
			ar: { title: 'قص وتدوير الصور', desc: 'دوّر الصور واقلبها، وقصّها بنسبة مربعة أو 16:9 وغيرها لعدة صور مرة واحدة.', keywords: ['crop', 'rotate', 'قص', 'تدوير'] },
			en: { title: 'Crop & rotate images', desc: 'Rotate, flip, and crop to square, 16:9 and more — for many images at once.', keywords: ['crop', 'rotate', 'flip'] }
		}
	},
	{
		id: 'remove-image-metadata',
		category: 'image',
		from: ['jpg', 'jpeg', 'jfif', 'png', 'webp', 'image/jpeg', 'image/png', 'image/webp'],
		to: ['jpg', 'png', 'webp'],
		runtime: 'browser',
		engine: 'image-strip',
		load: inWorker('image-strip'),
		maxMB: 50,
		batch: true,
		i18n: {
			ar: { title: 'حذف بيانات الصورة (EXIF والموقع)', desc: 'احذف موقع التصوير (GPS) ونوع الكاميرا والتاريخ قبل مشاركة الصور، بدون أي فقد في الجودة.', keywords: ['exif', 'gps', 'خصوصية', 'metadata'] },
			en: { title: 'Remove image metadata (EXIF & GPS)', desc: 'Strip GPS location, camera and date before sharing photos, with no quality loss.', keywords: ['exif', 'gps', 'privacy', 'metadata'] }
		}
	},
	{
		id: 'watermark-image',
		category: 'image',
		from: IMAGE_INPUTS,
		to: ['jpg', 'png', 'webp', 'avif'],
		runtime: 'browser',
		engine: 'image-watermark',
		load: inWorker('image-watermark'),
		options: [
			{
				id: 'kind',
				type: 'select',
				label: { ar: 'نوع العلامة', en: 'Watermark' },
				default: 'text',
				choices: [
					{ value: 'text', label: { ar: 'نص', en: 'Text' } },
					{ value: 'logo', label: { ar: 'شعار (صورة)', en: 'Logo (image)' } }
				]
			},
			{ id: 'text', type: 'text', label: { ar: 'النص', en: 'Text' }, default: '© المعمل', when: { id: 'kind', in: ['text'] } },
			{ id: 'color', type: 'color', label: { ar: 'اللون', en: 'Colour' }, default: '#ffffff', when: { id: 'kind', in: ['text'] } },
			{ id: 'logo', type: 'image', label: { ar: 'صورة الشعار', en: 'Logo image' }, default: null, when: { id: 'kind', in: ['logo'] } },
			{
				id: 'position',
				type: 'select',
				label: { ar: 'المكان', en: 'Position' },
				default: 'br',
				choices: [
					{ value: 'br', label: { ar: 'أسفل اليمين', en: 'Bottom right' } },
					{ value: 'bl', label: { ar: 'أسفل اليسار', en: 'Bottom left' } },
					{ value: 'bc', label: { ar: 'أسفل المنتصف', en: 'Bottom centre' } },
					{ value: 'center', label: { ar: 'المنتصف', en: 'Centre' } },
					{ value: 'tr', label: { ar: 'أعلى اليمين', en: 'Top right' } },
					{ value: 'tl', label: { ar: 'أعلى اليسار', en: 'Top left' } },
					{ value: 'tile', label: { ar: 'متكرر على كامل الصورة', en: 'Tiled across the image' } }
				]
			},
			{ id: 'size', type: 'range', label: { ar: 'الحجم (من عرض الصورة)', en: 'Size (of image width)' }, default: 25, min: 5, max: 100, unit: '%' },
			{ id: 'opacity', type: 'range', label: { ar: 'الشفافية', en: 'Opacity' }, default: 50, min: 5, max: 100, unit: '%' },
			{ id: 'angle', type: 'range', label: { ar: 'الزاوية', en: 'Angle' }, default: 0, min: -90, max: 90, step: 5, unit: '°' }
		],
		maxMB: 50,
		batch: true,
		i18n: {
			ar: { title: 'إضافة علامة مائية للصور', desc: 'أضف نصًا عربيًا أو إنجليزيًا أو شعارك على الصور، في مكان واحد أو متكررًا.', keywords: ['watermark', 'علامة مائية', 'شعار', 'logo'] },
			en: { title: 'Watermark images', desc: 'Put Arabic or English text, or your logo, on images — once or tiled.', keywords: ['watermark', 'logo', 'copyright'] }
		}
	},
	{
		id: 'favicon-generator',
		category: 'image',
		from: IMAGE_INPUTS,
		to: ['ico', 'png'],
		runtime: 'browser',
		engine: 'image-favicon',
		load: inWorker('image-favicon'),
		options: [
			{ id: 'name', type: 'text', label: { ar: 'اسم الموقع', en: 'Site name' }, default: '' },
			{
				id: 'fit',
				type: 'select',
				label: { ar: 'إذا لم تكن الصورة مربعة', en: 'If the image is not square' },
				default: 'pad',
				choices: [
					{ value: 'pad', label: { ar: 'أضف هوامش شفافة', en: 'Add transparent margins' } },
					{ value: 'crop', label: { ar: 'قص من المنتصف', en: 'Crop the centre' } }
				]
			},
			{ id: 'background', type: 'color', label: { ar: 'لون الخلفية (لأيقونة آيفون)', en: 'Background (for the iPhone icon)' }, default: '#ffffff' }
		],
		maxMB: 20,
		batch: false,
		i18n: {
			ar: { title: 'صانع أيقونات الموقع (Favicon)', desc: 'من صورة واحدة: favicon.ico وكل المقاسات من 16 إلى 512 وملف manifest والكود الجاهز للصفحة.', keywords: ['favicon', 'أيقونة الموقع', 'ico', 'manifest'] },
			en: { title: 'Favicon generator', desc: 'From one image: favicon.ico, every size from 16 to 512, a web manifest and the ready-to-paste HTML.', keywords: ['favicon', 'ico', 'manifest', 'apple touch icon'] }
		}
	},
	{
		id: 'image-to-svg',
		category: 'image',
		from: IMAGE_INPUTS,
		to: ['svg'],
		runtime: 'browser',
		engine: 'image-trace',
		load: inWorker('image-trace'),
		options: [
			{
				id: 'style',
				type: 'select',
				label: { ar: 'النمط', en: 'Style' },
				default: 'color',
				choices: [
					{ value: 'color', label: { ar: 'ألوان', en: 'Colour' } },
					{ value: 'bw', label: { ar: 'أبيض وأسود', en: 'Black & white' } }
				]
			},
			{ id: 'colors', type: 'range', label: { ar: 'عدد الألوان', en: 'Colours' }, default: 16, min: 2, max: 64, when: { id: 'style', in: ['color'] } },
			{
				id: 'detail',
				type: 'select',
				label: { ar: 'التفاصيل', en: 'Detail' },
				default: 'medium',
				choices: [
					{ value: 'low', label: { ar: 'قليلة (ملف أصغر)', en: 'Low (smaller file)' } },
					{ value: 'medium', label: { ar: 'متوسطة', en: 'Medium' } },
					{ value: 'high', label: { ar: 'عالية', en: 'High' } }
				]
			}
		],
		maxMB: 20,
		batch: true,
		i18n: {
			ar: { title: 'تحويل صورة إلى SVG (متجهات)', desc: 'حوّل الشعارات والرسومات إلى SVG يكبر بلا تشويش — مناسب للطباعة والقص بالليزر.', keywords: ['svg', 'vector', 'متجه', 'vectorize'] },
			en: { title: 'Image to SVG (vectorize)', desc: 'Turn logos and drawings into SVG that scales without blur — for print and cutting.', keywords: ['svg', 'vector', 'vectorize', 'trace'] }
		}
	}
];
