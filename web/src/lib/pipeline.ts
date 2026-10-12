/**
 * Tool chains: the files go through several tools one after the other (e.g. HEIC → JPG → compress →
 * one PDF). Pure logic here (unit-tested); the page runs each step with the worker runner.
 */
import { formatList, tools, toolById } from './registry/tools';
import { ConvertError, type FileData, type Lang, type Options, type Tool } from './registry/types';

export type Step = { tool: string; options: Options };
export type Chain = { id: string; name: Record<Lang, string>; steps: Step[] };

/** Tools that can be a step: a file in, files out, no interactive editor or page of their own. */
export const chainable = (tool: Tool) => !tool.widget && !tool.editor;
export const chainTools = () => tools.filter(chainable);

const ext = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';
const ALIASES: Record<string, string> = { jpeg: 'jpg', jfif: 'jpg', tif: 'tiff', heif: 'heic', htm: 'html' };
const norm = (f: string) => ALIASES[f] ?? f;

/** What a tool can hand to the next step: its outputs, or its inputs for "same format" tools. */
export const outputsOf = (tool: Tool) => (tool.to.length ? tool.to : tool.from.filter((f) => !f.includes('/'))).map(norm);

/** Whether `next` takes at least one kind of file `prev` makes. */
export function fits(prev: Tool, next: Tool) {
	if (next.from.includes('*')) return true;
	const takes = new Set(next.from.map(norm));
	return outputsOf(prev).some((f) => takes.has(f));
}

/** Tools that may come after the chain so far (any chainable tool for the first step). */
export function nextTools(steps: Step[]): Tool[] {
	const last = steps.length ? toolById(steps[steps.length - 1].tool) : undefined;
	return chainTools().filter((t) => !last || fits(last, t));
}

/** Default options of a tool, as a step starts with. */
export const defaults = (tool: Tool): Options => Object.fromEntries((tool.options ?? []).map((o) => [o.id, o.default]));

export const accepts = (tool: Tool, f: { name: string; type: string }) =>
	tool.from.includes('*') || tool.from.map(norm).includes(norm(ext(f.name))) || (!!f.type && tool.from.includes(f.type));

/** One step's work: `inputs` are all files for a combine tool, otherwise one file. */
export type RunStep = (tool: Tool, inputs: FileData[], options: Options, progress: (r: number) => void) => Promise<FileData[]>;

/**
 * Runs the chain. Files a step does not take pass through unchanged (e.g. the PNG set next to an
 * ICO); a combine step (merge, images → PDF) turns all its files into one job.
 */
export async function runChain(
	steps: { tool: Tool; options: Options }[],
	files: FileData[],
	run: RunStep,
	onProgress: (ratio: number, step: number) => void = () => {}
): Promise<FileData[]> {
	let current = files;
	for (const [i, { tool, options }] of steps.entries()) {
		const report = (r: number) => onProgress((i + r) / steps.length, i);
		report(0);
		const taken = current.filter((f) => accepts(tool, f));
		const passed = current.filter((f) => !accepts(tool, f));
		if (!taken.length) throw new ConvertError('wrong-type', `step ${i + 1} (${tool.id}): no file it takes`);
		let out: FileData[] = [];
		if (tool.combine) {
			if (taken.length < tool.combine.min) throw new ConvertError('nothing', `step ${i + 1} (${tool.id}): needs ${tool.combine.min} files`);
			out = await run(tool, taken, options, report);
		} else {
			for (const [k, f] of taken.entries()) {
				out.push(...(await run(tool, [f], options, (r) => report((k + r) / taken.length))));
			}
		}
		current = [...out, ...passed];
	}
	onProgress(1, steps.length - 1);
	return current;
}

/** Checks a chain before running: every tool exists and can follow the one before. */
export function chainError(steps: Step[]): string | null {
	if (!steps.length) return 'empty';
	for (const [i, s] of steps.entries()) {
		const tool = toolById(s.tool);
		if (!tool || !chainable(tool)) return `unknown:${s.tool}`;
		const prev = i ? toolById(steps[i - 1].tool)! : null;
		if (prev && !fits(prev, tool)) return `mismatch:${i}`;
	}
	return null;
}

/** The formats the first step takes, for the drop zone. */
export const firstFormats = (steps: Step[]) => {
	const tool = steps.length ? toolById(steps[0].tool) : undefined;
	return tool ? formatList(tool.from) : [];
};

/** Ready-made chains (option values are checked against the registry by a unit test). */
export const PRESETS: Chain[] = [
	{
		id: 'iphone-photos-pdf',
		name: { ar: 'صور الآيفون ← ملف PDF واحد مضغوط', en: 'iPhone photos → one compact PDF' },
		steps: [
			{ tool: 'heic-to-jpg', options: { quality: 88 } },
			{ tool: 'compress-image', options: { quality: 75, format: 'same' } },
			{ tool: 'image-to-pdf', options: {} }
		]
	},
	{
		id: 'scan-searchable',
		name: { ar: 'صور مستند ممسوح ← PDF قابل للبحث', en: 'Scanned pages → searchable PDF' },
		steps: [
			{ tool: 'image-to-pdf', options: { enhance: 'scan' } },
			{ tool: 'ocr-pdf', options: { output: 'pdf' } }
		]
	},
	{
		id: 'photos-email',
		name: { ar: 'تصغير الصور للإرسال (واتساب أو إيميل)', en: 'Shrink photos to send (WhatsApp or email)' },
		steps: [
			{ tool: 'resize-image', options: { mode: 'px', width: 1600, height: 0 } },
			{ tool: 'compress-image', options: { quality: 70 } }
		]
	},
	{
		id: 'merge-number-compress',
		name: { ar: 'دمج ملفات PDF ← ترقيم الصفحات ← ضغط', en: 'Merge PDFs → page numbers → compress' },
		steps: [
			{ tool: 'merge-pdf', options: {} },
			{ tool: 'pdf-page-numbers', options: {} },
			{ tool: 'compress-pdf', options: { level: 'medium' } }
		]
	},
	{
		id: 'confidential-pdf',
		name: { ar: 'علامة «سري» ← حماية بكلمة مرور', en: '“Confidential” stamp → password protection' },
		steps: [
			{ tool: 'watermark-pdf', options: { kind: 'text' } },
			{ tool: 'protect-pdf', options: {} }
		]
	}
];

const KEY = 'chains';

/** Chains the visitor saved (in this browser only). Picked files (logos) are not kept. */
export function loadChains(): Chain[] {
	try {
		const list = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Chain[];
		return Array.isArray(list) ? list.filter((c) => c?.id && Array.isArray(c.steps) && !chainError(c.steps)) : [];
	} catch {
		return [];
	}
}

export function storableSteps(steps: Step[]): Step[] {
	return steps.map((s) => ({
		tool: s.tool,
		options: Object.fromEntries(Object.entries(s.options).filter(([, v]) => v === null || typeof v !== 'object'))
	}));
}

export function saveChains(list: Chain[]) {
	try {
		localStorage.setItem(KEY, JSON.stringify(list));
	} catch {}
}
