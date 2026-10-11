import { ConvertError, type Adapter } from '../../registry/types';
import { decodeText, textFile } from './sheet';

type Kind = 'json' | 'yaml' | 'xml' | 'toml';
const TYPES: Record<Kind, string> = {
	json: 'application/json',
	yaml: 'application/yaml',
	xml: 'application/xml',
	toml: 'application/toml'
};

/** Which format a text is in: by extension first, then by its first character. */
function kindOf(name: string, text: string): Kind {
	const ext = name.split('.').pop()?.toLowerCase();
	if (ext === 'json') return 'json';
	if (ext === 'yml' || ext === 'yaml') return 'yaml';
	if (ext === 'xml') return 'xml';
	if (ext === 'toml') return 'toml';
	const t = text.trimStart();
	if (t.startsWith('{') || t.startsWith('[')) return 'json';
	if (t.startsWith('<')) return 'xml';
	return 'yaml';
}

async function parse(kind: Kind, text: string): Promise<unknown> {
	if (kind === 'json') return JSON.parse(text);
	if (kind === 'yaml') return (await import('yaml')).parse(text);
	if (kind === 'toml') return (await import('smol-toml')).parse(text);
	const { XMLParser } = await import('fast-xml-parser');
	return new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', parseTagValue: true, parseAttributeValue: true }).parse(text);
}

async function write(kind: Kind, data: unknown): Promise<string> {
	if (kind === 'json') return JSON.stringify(data, null, 2) + '\n';
	if (kind === 'yaml') return (await import('yaml')).stringify(data);
	// TOML and XML need one object at the top; wrap anything else.
	const top = data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : { items: data };
	if (kind === 'toml') return (await import('smol-toml')).stringify(dropNulls(top) as Record<string, unknown>) + '\n';
	const XMLBuilder = (await import('fast-xml-builder')).default;
	const keys = Object.keys(top).filter((k) => !k.startsWith('?'));
	const root = keys.length === 1 && !Array.isArray(top[keys[0]]) ? top : { root: top };
	return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLBuilder({ ignoreAttributes: false, attributeNamePrefix: '@_', format: true }).build(root);
}

/** TOML has no null: leave those keys out. */
function dropNulls(v: unknown): unknown {
	if (Array.isArray(v)) return v.filter((x) => x !== null).map(dropNulls);
	if (v && typeof v === 'object' && !(v instanceof Date))
		return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== null).map(([k, x]) => [k, dropNulls(x)]));
	return v;
}

/** JSON ↔ YAML ↔ XML ↔ TOML. */
const adapter: Adapter = {
	async convert(input, options) {
		const to = String(options.to) as Kind;
		const text = decodeText(input.bytes);
		let data: unknown;
		try {
			data = await parse(kindOf(input.name, text), text);
		} catch (e) {
			throw new ConvertError('corrupted', e instanceof Error ? e.message : String(e));
		}
		const ext = to === 'yaml' ? 'yaml' : to;
		return [textFile(input.name.replace(/\.[^.]+$/, '') + '.' + ext, TYPES[to], await write(to, data))];
	}
};

export default adapter;
