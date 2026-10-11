import type { Adapter, FileData } from '../../registry/types';
import { buildDocument } from '../../markdown/document';
import { renderMarkdown } from '../../markdown/render';
import type { PageOptions } from '../../markdown/templates';

/** The parts of a markdown-it token this file reads. */
type Token = { type: string; tag: string; content: string; children: Token[] | null; map: [number, number] | null; attrGet(name: string): string | null };

const hasArabic = (s: string) => /[؀-ۿ]/.test(s);
const base = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]+/g, '_') || 'document';
const decode = (b: Uint8Array) => new TextDecoder().decode(b).replace(/^﻿/, '');

const PAGE: PageOptions = {
	template: 'simple',
	font: 'cairo',
	paper: 'A4',
	toc: false,
	pageNumbers: false,
	arabicDigits: false,
	header: '',
	footer: '',
	accent: '#0f6e66'
};

/** Markdown → Word: headings, paragraphs (bold/italic/code/links), lists, tables, quotes, code. */
async function toDocx(src: string): Promise<Uint8Array> {
	const d = await import('docx');
	const MarkdownIt = (await import('markdown-it')).default;
	const tokens = new MarkdownIt({ html: false, linkify: true }).parse(src, {}) as unknown as Token[];
	const blocks: (InstanceType<typeof d.Paragraph> | InstanceType<typeof d.Table>)[] = [];

	const runs = (inline: Token | undefined, extra: { bold?: boolean; size?: number } = {}) => {
		const out: (InstanceType<typeof d.TextRun> | InstanceType<typeof d.ExternalHyperlink>)[] = [];
		let bold = false;
		let italics = false;
		let link: string | null = null;
		for (const c of inline?.children ?? []) {
			if (c.type === 'strong_open') bold = true;
			else if (c.type === 'strong_close') bold = false;
			else if (c.type === 'em_open') italics = true;
			else if (c.type === 'em_close') italics = false;
			else if (c.type === 'link_open') link = c.attrGet('href');
			else if (c.type === 'link_close') link = null;
			else if (c.type === 'softbreak' || c.type === 'hardbreak') out.push(new d.TextRun({ text: '', break: 1 }));
			else if (c.type === 'text' || c.type === 'code_inline') {
				const rtl = hasArabic(c.content);
				const run = new d.TextRun({
					text: c.content,
					bold: bold || extra.bold,
					italics,
					size: extra.size,
					rightToLeft: rtl,
					font: c.type === 'code_inline' ? 'Consolas' : undefined,
					style: link ? 'Hyperlink' : undefined
				});
				out.push(link && /^https?:/.test(link) ? new d.ExternalHyperlink({ link, children: [run] }) : run);
			}
		}
		return out;
	};
	const para = (inline: Token | undefined, opts: Record<string, unknown> = {}) => {
		const text = inline?.content ?? '';
		const rtl = hasArabic(text);
		return new d.Paragraph({
			children: runs(inline, (opts.run as object) ?? {}),
			bidirectional: rtl,
			alignment: rtl ? d.AlignmentType.RIGHT : d.AlignmentType.LEFT,
			...opts
		});
	};

	const lists: { ordered: boolean }[] = [];
	let inQuote = false;
	for (let i = 0; i < tokens.length; i++) {
		const t = tokens[i];
		if (t.type === 'heading_open') {
			const level = Number(t.tag.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6;
			const heading = [d.HeadingLevel.HEADING_1, d.HeadingLevel.HEADING_2, d.HeadingLevel.HEADING_3, d.HeadingLevel.HEADING_4, d.HeadingLevel.HEADING_5, d.HeadingLevel.HEADING_6][level - 1];
			blocks.push(para(tokens[i + 1], { heading }));
			i += 2;
		} else if (t.type === 'bullet_list_open' || t.type === 'ordered_list_open') lists.push({ ordered: t.type === 'ordered_list_open' });
		else if (t.type === 'bullet_list_close' || t.type === 'ordered_list_close') lists.pop();
		else if (t.type === 'blockquote_open') inQuote = true;
		else if (t.type === 'blockquote_close') inQuote = false;
		else if (t.type === 'paragraph_open') {
			const inline = tokens[i + 1];
			const list = lists[lists.length - 1];
			const level = Math.max(0, lists.length - 1);
			if (list) blocks.push(para(inline, list.ordered ? { numbering: { reference: 'numbers', level } } : { bullet: { level } }));
			else if (inQuote) blocks.push(para(inline, { indent: { start: 567 }, border: { left: { style: d.BorderStyle.SINGLE, size: 12, color: '0F6E66', space: 8 } } }));
			else blocks.push(para(inline));
			i += 2;
		} else if (t.type === 'fence' || t.type === 'code_block') {
			for (const line of t.content.replace(/\n$/, '').split('\n'))
				blocks.push(new d.Paragraph({ children: [new d.TextRun({ text: line || ' ', font: 'Consolas', size: 19 })], shading: { type: d.ShadingType.CLEAR, fill: 'F3F2EE', color: 'auto' } }));
		} else if (t.type === 'hr') blocks.push(new d.Paragraph({ thematicBreak: true }));
		else if (t.type === 'table_open') {
			const rows: InstanceType<typeof d.TableRow>[] = [];
			let cells: InstanceType<typeof d.TableCell>[] = [];
			let header = false;
			for (i++; i < tokens.length && tokens[i].type !== 'table_close'; i++) {
				const c = tokens[i];
				if (c.type === 'thead_open') header = true;
				else if (c.type === 'thead_close') header = false;
				else if (c.type === 'tr_open') cells = [];
				else if (c.type === 'tr_close') rows.push(new d.TableRow({ children: cells, ...(header ? { tableHeader: true } : {}) }));
				else if (c.type === 'th_open' || c.type === 'td_open') {
					cells.push(new d.TableCell({ children: [para(tokens[i + 1], { run: { bold: c.type === 'th_open' } })] }));
					i++;
				}
			}
			const rtl = hasArabic(t.map ? src.split('\n').slice(t.map[0], t.map[1]).join(' ') : '');
			blocks.push(new d.Table({ rows, width: { size: 100, type: d.WidthType.PERCENTAGE }, visuallyRightToLeft: rtl }));
		}
	}

	const doc = new d.Document({
		styles: { default: { document: { run: { font: 'Arial', size: 23 } } } },
		numbering: {
			config: [
				{
					reference: 'numbers',
					levels: [0, 1, 2].map((level) => ({ level, format: d.LevelFormat.DECIMAL, text: `%${level + 1}.`, alignment: d.AlignmentType.START }))
				}
			]
		},
		sections: [{ children: blocks.length ? blocks : [new d.Paragraph('')] }]
	});
	return new Uint8Array(await (await d.Packer.toBlob(doc)).arrayBuffer());
}

/** Markdown → a styled single-file HTML page, or → Word (params.to). */
const adapter: Adapter = {
	async convert(input, options) {
		const src = decode(input.bytes);
		if (options.to === 'docx') {
			const out: FileData = {
				name: base(input.name) + '.docx',
				type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
				bytes: await toDocx(src)
			};
			return [out];
		}
		const rendered = await renderMarkdown(src);
		const lang = options.uiLang === 'en' ? 'en' : 'ar';
		const html = buildDocument(rendered, { ...PAGE, toc: options.toc === true }, 'screen', lang, lang === 'ar' ? 'المحتويات' : 'Contents');
		return [{ name: base(input.name) + '.html', type: 'text/html', bytes: new TextEncoder().encode(html) }];
	}
};

export default adapter;
