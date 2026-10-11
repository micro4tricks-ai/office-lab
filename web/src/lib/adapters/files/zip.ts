import { ConvertError, type Adapter, type FileData } from '../../registry/types';
import { safeEntryName } from '../../zip-names';

const MIME: Record<string, string> = {
	pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
	svg: 'image/svg+xml', txt: 'text/plain', csv: 'text/csv', json: 'application/json', html: 'text/html', md: 'text/markdown',
	docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};
const mime = (name: string) => MIME[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';

/** Archives bigger than this once unpacked are refused (zip-bomb guard). */
const MAX_UNPACKED = 1024 * 1024 * 1024;
const MAX_ENTRIES = 5000;

/** Many files → one ZIP (params.action = 'create'), or a ZIP → its files ('extract'). */
const adapter: Adapter = {
	async convert(input, options) {
		if (options.action === 'create') return adapter.combine!([input], options);
		const { unzipSync } = await import('fflate');
		let total = 0;
		let count = 0;
		let files: Record<string, Uint8Array>;
		try {
			files = unzipSync(input.bytes, {
				filter: (f) => {
					if (f.name.endsWith('/')) return false; // folders
					count++;
					total += f.originalSize;
					if (count > MAX_ENTRIES || total > MAX_UNPACKED) throw new ConvertError('too-big', 'archive unpacks too large');
					return true;
				}
			});
		} catch (e) {
			if (e instanceof ConvertError) throw e;
			throw new ConvertError('corrupted', e instanceof Error ? e.message : String(e));
		}
		const out: FileData[] = Object.entries(files).map(([name, bytes]) => {
			const safe = safeEntryName(name);
			return { name: safe, type: mime(safe), bytes };
		});
		if (!out.length) throw new ConvertError('nothing');
		return out;
	},
	async combine(inputs, options) {
		const { zipSync } = await import('fflate');
		const level = options.level === 'store' ? 0 : options.level === 'max' ? 9 : 6;
		const entries: Record<string, Uint8Array> = {};
		for (const f of inputs) {
			const safe = safeEntryName(f.name);
			let n = safe;
			for (let i = 2; n in entries; i++) n = safe.replace(/(\.[^./]+)?$/, ` (${i})$1`);
			entries[n] = f.bytes;
		}
		const name = inputs.length === 1 ? inputs[0].name.replace(/\.[^.]+$/, '') + '.zip' : 'archive.zip';
		return [{ name, type: 'application/zip', bytes: zipSync(entries, { level }) }];
	}
};

export default adapter;
