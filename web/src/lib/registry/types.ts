export type Lang = 'ar' | 'en';
export const LANGS: Lang[] = ['ar', 'en'];

export type Category = 'image' | 'pdf' | 'document' | 'data' | 'ebook' | 'media' | 'ocr';
export const CATEGORIES: Category[] = ['image', 'pdf', 'document', 'data', 'ebook', 'media', 'ocr'];

/** A file as it crosses the worker boundary. */
export type FileData = { name: string; type: string; bytes: Uint8Array };

export type ErrorCode = 'wrong-type' | 'too-big' | 'password' | 'corrupted' | 'unknown';

export class ConvertError extends Error {
	constructor(
		public code: ErrorCode,
		message: string = code
	) {
		super(message);
	}
}

export type Options = Record<string, string | number | boolean>;

/** Every engine sits behind this, so any library can be swapped later. */
export type Adapter = {
	convert(input: FileData, options: Options, onProgress?: (ratio: number) => void): Promise<FileData[]>;
};

type Text = { ar: string; en: string };

export type OptionSpec =
	| { id: string; type: 'select'; label: Text; default: string; choices: { value: string; label: Text }[] }
	| { id: string; type: 'range' | 'number'; label: Text; default: number; min: number; max: number; step?: number }
	| { id: string; type: 'checkbox'; label: Text; default: boolean }
	| { id: string; type: 'text'; label: Text; default: string };

type ToolText = { title: string; desc: string; keywords: string[] };

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
	options?: OptionSpec[];
	maxMB: number;
	batch: boolean;
	i18n: Record<Lang, ToolText>;
};
