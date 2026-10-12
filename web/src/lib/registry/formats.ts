import en from '../i18n/en.json';
import { formatList, tools } from './tools';
import { CATEGORIES, type Tool } from './types';

const cell = (s: string) => s.replace(/\|/g, '\\|');

function input(tool: Tool) {
	const list = tool.from.includes('*') ? 'any file' : formatList(tool.from).join(' / ');
	if (tool.widget) return list ? `${list} (own page)` : 'own page';
	if (tool.combine) return `${list} ×${tool.combine.min}${tool.combine.max === tool.combine.min ? '' : '+'}`;
	return list;
}

const output = (tool: Tool) => (tool.to.length ? formatList(tool.to).join(' / ') : tool.widget ? '—' : 'same format');

/** docs/FORMATS.md, built from the registry (tests/unit/formats.test.ts keeps the file current). */
export function formatsMarkdown(): string {
	const server = tools.filter((t) => t.runtime === 'server').length;
	const out = [
		'# Supported tools and formats',
		'',
		'> Generated from `web/src/lib/registry/` — do not edit by hand. To refresh:',
		'> `cd web && UPDATE_FORMATS=1 npx vitest run formats`',
		'',
		`${tools.length} tools: ${tools.length - server} run in the browser (nothing is uploaded), ` +
			`${server} need the server version (Docker, see \`deploy/\`).`,
		''
	];
	for (const cat of CATEGORIES) {
		const list = tools.filter((t) => t.category === cat);
		if (!list.length) continue;
		out.push(`## ${en[`cat.${cat}`]} (${list.length})`, '', '| Tool | In → Out | Runs | What it does |', '|---|---|---|---|');
		for (const t of list) {
			const runs = t.runtime === 'server' ? 'server' : 'browser';
			out.push(`| \`${t.id}\` ${cell(t.i18n.en.title)} | ${cell(input(t))} → ${cell(output(t))} | ${runs} | ${cell(t.i18n.en.desc)} |`);
		}
		out.push('');
	}
	return out.join('\n');
}
