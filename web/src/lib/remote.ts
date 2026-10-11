import { API_URL } from './config';
import { ConvertError, type Adapter, type ErrorCode, type FileData, type NoteKey, type Options } from './registry/types';

/** Codes the API returns (server/app/errors.py) mapped to what the page can explain. */
const KNOWN: Record<string, ErrorCode> = {
	'wrong-type': 'wrong-type',
	'too-big': 'too-big',
	password: 'password',
	corrupted: 'corrupted',
	pages: 'pages',
	nothing: 'nothing',
	'bad-options': 'options',
	busy: 'busy',
	timeout: 'timeout'
};
const NOTES: NoteKey[] = ['kept-original', 'target-missed'];

export type Upload = { file?: FileData; url?: string; assets?: FileData[] };

/** File name from Content-Disposition (RFC 5987 `filename*` first). */
export function fileNameOf(header: string | null, fallback: string): string {
	const star = header?.match(/filename\*=(?:UTF-8|utf-8)''([^;]+)/);
	if (star) {
		try {
			return decodeURIComponent(star[1]);
		} catch {
			/* fall through */
		}
	}
	return header?.match(/filename="([^"]+)"/)?.[1] ?? fallback;
}

function errorOf(status: number, body: ArrayBuffer | null): ConvertError {
	let code: string | undefined;
	try {
		code = JSON.parse(new TextDecoder().decode(body ?? new ArrayBuffer(0))).code;
	} catch {
		/* not JSON (e.g. a proxy error page) */
	}
	if (code && KNOWN[code]) return new ConvertError(KNOWN[code]);
	if (status === 413) return new ConvertError('too-big');
	if (status === 429 || status === 502 || status === 503) return new ConvertError('busy');
	if (status === 504) return new ConvertError('timeout');
	return new ConvertError('unknown', `server ${status}`);
}

/** Only plain values go to the server (no files, no UI language). */
const plain = (o: Options) =>
	Object.fromEntries(Object.entries(o).filter(([k, v]) => k !== 'uiLang' && (v === null || typeof v !== 'object')));

/**
 * Sends one job to /api/convert/{tool}. XHR (not fetch) so big uploads can report progress:
 * the upload fills the bar to 90%, the conversion itself has no measurable progress.
 */
export function sendToServer(tool: string, up: Upload, options: Options, progress?: (r: number) => void): Promise<FileData[]> {
	const form = new FormData();
	if (up.file) form.append('file', new Blob([up.file.bytes as BlobPart], { type: up.file.type }), up.file.name);
	for (const a of up.assets ?? []) form.append('assets', new Blob([a.bytes as BlobPart], { type: a.type }), a.name);
	if (up.url) form.append('url', up.url);
	form.append('options', JSON.stringify(plain(options)));

	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open('POST', `${API_URL}/api/convert/${encodeURIComponent(tool)}`);
		xhr.responseType = 'arraybuffer';
		xhr.upload.onprogress = (e) => e.lengthComputable && progress?.((0.9 * e.loaded) / e.total);
		xhr.onload = () => {
			if (xhr.status !== 200) return reject(errorOf(xhr.status, xhr.response));
			progress?.(1);
			const note = xhr.getResponseHeader('X-Office-Lab-Note') as NoteKey | null;
			resolve([
				{
					name: fileNameOf(xhr.getResponseHeader('Content-Disposition'), 'result'),
					type: xhr.getResponseHeader('Content-Type')?.split(';')[0] ?? 'application/octet-stream',
					bytes: new Uint8Array(xhr.response),
					note: note && NOTES.includes(note) ? note : undefined
				}
			]);
		};
		xhr.onerror = () => reject(new ConvertError('offline'));
		xhr.ontimeout = () => reject(new ConvertError('timeout'));
		xhr.send(form);
	});
}

/** The registry's `load` for server tools. */
export const onServer =
	(tool: string) =>
	async (): Promise<Adapter> => ({
		convert: (input, options, progress) => sendToServer(tool, { file: input }, options, progress)
	});
