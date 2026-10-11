import { inWorker } from '../workers/proxy';
import type { OptionSpec, Tool } from './types';

const DOCX = ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

const images: OptionSpec = {
	id: 'images',
	type: 'select',
	label: { ar: 'الصور', en: 'Images' },
	default: 'embed',
	choices: [
		{ value: 'embed', label: { ar: 'داخل الملف نفسه', en: 'Inside the file' } },
		{ value: 'files', label: { ar: 'ملفات منفصلة (ZIP)', en: 'Separate files (ZIP)' } }
	]
};

type Base = Omit<Tool, 'load' | 'runtime' | 'category' | 'maxMB' | 'batch'>;
const doc = (t: Base): Tool => ({ category: 'document', runtime: 'browser', maxMB: 50, batch: true, ...t, load: inWorker(t.engine) });

export const docTools: Tool[] = [
	doc({
		id: 'word-to-html',
		from: DOCX,
		to: ['html'],
		engine: 'docx',
		params: { to: 'html' },
		options: [images],
		i18n: {
			ar: { title: 'تحويل Word إلى HTML', desc: 'صفحة ويب نظيفة من مستند Word، مع العناوين والقوائم والجداول والصور، والعربي من اليمين.', keywords: ['word', 'docx', 'html', 'وورد'] },
			en: { title: 'Word to HTML', desc: 'A clean web page from a Word document — headings, lists, tables, images; Arabic stays right-to-left.', keywords: ['word', 'docx', 'html'] }
		}
	}),
	doc({
		id: 'word-to-markdown',
		from: DOCX,
		to: ['md'],
		engine: 'docx',
		params: { to: 'md' },
		options: [{ ...images, default: 'files' }],
		i18n: {
			ar: { title: 'تحويل Word إلى Markdown', desc: 'حوّل مستند Word إلى Markdown للمواقع والتوثيق وGitHub.', keywords: ['word', 'docx', 'markdown', 'md', 'وورد'] },
			en: { title: 'Word to Markdown', desc: 'Turn a Word document into Markdown for sites, docs and GitHub.', keywords: ['word', 'docx', 'markdown', 'md'] }
		}
	})
];
