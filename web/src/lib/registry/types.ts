export type Lang = 'ar' | 'en';
export const LANGS: Lang[] = ['ar', 'en'];

export type Category = 'image' | 'pdf' | 'document' | 'data' | 'office' | 'files' | 'ebook' | 'media' | 'ocr';
export const CATEGORIES: Category[] = ['pdf', 'image', 'document', 'data', 'office', 'ocr', 'files', 'ebook', 'media'];

/** A file as it crosses the worker boundary. `note` is an optional i18n key shown with a result. */
export type FileData = { name: string; type: string; bytes: Uint8Array; note?: NoteKey };

/** Short remarks an adapter can attach to an output (keys in i18n `note.*`). */
export type NoteKey =
	| 'kept-original'
	| 'metadata-removed'
	| 'no-metadata'
	| 'orientation-applied'
	| 'target-missed'
	| 'identical'
	| 'ocr-limit';

export type ErrorCode = 'wrong-type' | 'too-big' | 'password' | 'corrupted' | 'pages' | 'nothing' | 'unknown';

export class ConvertError extends Error {
	constructor(
		public code: ErrorCode,
		message: string = code
	) {
		super(message);
	}
}

/** One page in an organized PDF: which source page, and extra rotation. */
export type PagePlan = { src: number; rotate: number };
/**
 * Something drawn on a page (signature, text, image), already as PNG. Position and size are
 * fractions of the page as the reader sees it; (x, y) is the top-left corner.
 */
export type Placement = { page: number; x: number; y: number; w: number; h: number; png: FileData };
export type FormValues = Record<string, string | boolean>;

export type OptionValue = string | number | boolean | FileData | null | PagePlan[] | Placement[] | FormValues;
export type Options = Record<string, OptionValue>;

/** Every engine sits behind this, so any library can be swapped later. */
export type Adapter = {
	convert(input: FileData, options: Options, onProgress?: (ratio: number) => void): Promise<FileData[]>;
	/** For tools with `combine`: all files in one job (merge, images → PDF, compare). */
	combine?(inputs: FileData[], options: Options, onProgress?: (ratio: number) => void): Promise<FileData[]>;
};

type Text = { ar: string; en: string };

/** Show an option only while another option has one of these values. */
type When = { when?: { id: string; in: (string | number | boolean)[] } };

export type OptionSpec = When &
	(
		| { id: string; type: 'select'; label: Text; default: string; choices: { value: string; label: Text }[] }
		| { id: string; type: 'range' | 'number'; label: Text; default: number; min: number; max: number; step?: number; unit?: string }
		| { id: string; type: 'checkbox'; label: Text; default: boolean }
		| { id: string; type: 'text'; label: Text; default: string; secret?: boolean; required?: boolean; placeholder?: Text }
		| { id: string; type: 'color'; label: Text; default: string }
		/** A second file the tool needs (e.g. a logo); not a batch input. */
		| { id: string; type: 'image'; label: Text; default: null }
	);

type ToolText = { title: string; desc: string; keywords: string[] };

export type WidgetKey = 'markdown' | 'tafqeet' | 'hijri' | 'arabic-text' | 'vat' | 'qr' | 'barcode';

export type Tool = {
	id: string;
	category: Category;
	/** Accepted extensions (no dot) and/or MIME types. */
	from: string[];
	/** Output formats; [] for operations like merge. */
	to: string[];
	runtime: 'browser' | 'server';
	/** Adapter name, a key of `engines` in lib/adapters. */
	engine: string;
	load: () => Promise<Adapter>;
	/** Fixed options for this tool, merged under the user's (lets one engine serve several tools). */
	params?: Options;
	options?: OptionSpec[];
	maxMB: number;
	batch: boolean;
	/** All files become ONE job (order matters, user can reorder). */
	combine?: { min: number; max?: number };
	/** An interactive step before converting; it writes options.plan / .items / .fields. */
	editor?: 'organize' | 'place' | 'form';
	/** A page of its own instead of the file runner (editors, calculators, generators). */
	widget?: WidgetKey;
	i18n: Record<Lang, ToolText>;
};
