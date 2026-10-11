<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { asset } from '$app/paths';
	import Icon from '../components/Icon.svelte';
	import { serverCapabilities } from '../config';
	import { downloadFile } from '../download';
	import { t } from '../i18n';
	import { buildDocument, drawDiagrams, type Mode } from '../markdown/document';
	import { packDocument } from '../markdown/pack';
	import { renderMarkdown, type Rendered } from '../markdown/render';
	import type { FontKey, PageOptions, Template } from '../markdown/templates';
	import { ConvertError, type Lang } from '../registry/types';
	import { sendToServer } from '../remote';
	import { SAMPLE } from './markdown-sample';

	let { lang }: { lang: Lang } = $props();

	const DRAFT = 'office-lab:markdown-draft';
	const PAGED = asset('pagedjs/paged.polyfill.min.js');
	let src = $state('');
	let opts = $state<PageOptions>({
		template: 'simple',
		font: 'cairo',
		paper: 'A4',
		toc: false,
		pageNumbers: true,
		arabicDigits: false,
		header: '',
		footer: '',
		accent: '#0f6e66'
	});
	let mode = $state<Mode>('screen');
	let tab = $state<'edit' | 'preview'>('edit');
	let srcdoc = $state('');
	let rendered: Rendered | null = null;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let printFrame: HTMLIFrameElement | null = null;
	/** The server version prints to PDF in one click (same document, its own Chromium). */
	let direct = $state(false);
	let directBusy = $state(false);
	let directError = $state('');

	onMount(() => {
		serverCapabilities().then((c) => (direct = c.has('html-to-pdf')));
		let draft: string | null = null;
		try {
			draft = localStorage.getItem(DRAFT);
		} catch {
			/* private mode */
		}
		src = draft ?? SAMPLE[lang];
	});
	onDestroy(() => {
		clearTimeout(timer);
		printFrame?.remove();
	});

	async function render() {
		const r = await renderMarkdown(src);
		rendered = { ...r, html: await drawDiagrams(r.html) };
		srcdoc = buildDocument(rendered, $state.snapshot(opts), mode, lang, t(lang, 'md.toc'), PAGED);
	}

	// Re-render shortly after typing stops; options and mode apply at once.
	$effect(() => {
		void src;
		clearTimeout(timer);
		timer = setTimeout(() => {
			render();
			try {
				localStorage.setItem(DRAFT, src);
			} catch {
				/* private mode */
			}
		}, 350);
	});
	$effect(() => {
		void JSON.stringify(opts);
		void mode;
		if (rendered) srcdoc = buildDocument(rendered, $state.snapshot(opts), mode, lang, t(lang, 'md.toc'), PAGED);
	});

	async function openFile(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const f = input.files?.[0];
		input.value = '';
		if (f) src = await f.text();
	}

	const name = () => (rendered?.title || 'document').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 60);
	const save = (ext: string, type: string, text: string) =>
		downloadFile({ name: `${name()}.${ext}`, type, bytes: new TextEncoder().encode(text) });

	async function print() {
		await render();
		printFrame?.remove();
		printFrame = document.createElement('iframe');
		printFrame.title = t(lang, 'md.print');
		printFrame.style.cssText = 'position:fixed;inset-inline-start:-10000px;top:0;width:210mm;height:297mm;border:0';
		printFrame.srcdoc = buildDocument(rendered!, $state.snapshot(opts), 'print', lang, t(lang, 'md.toc'), PAGED);
		document.body.append(printFrame);
	}

	async function downloadPdf() {
		directBusy = true;
		directError = '';
		try {
			await render();
			const doc = buildDocument(rendered!, $state.snapshot(opts), 'preview', lang, t(lang, 'md.toc'), PAGED);
			const { index, assets } = await packDocument(doc);
			const [pdf] = await sendToServer('html-to-pdf', { file: index, assets }, { background: true });
			downloadFile({ ...pdf, name: `${name()}.pdf` });
		} catch (e) {
			directError = t(lang, `err.${e instanceof ConvertError ? e.code : 'unknown'}`, { mb: 100 });
			if (!(e instanceof ConvertError)) console.error('[office-lab] markdown direct pdf:', e);
		} finally {
			directBusy = false;
		}
	}

	const templates: Template[] = ['simple', 'report', 'cv', 'letter'];
	const fonts: FontKey[] = ['cairo', 'amiri', 'naskh'];
</script>

<div class="studio">
	<div class="bar" role="toolbar" aria-label={t(lang, 'md.tools')}>
		<label class="btn small">
			<Icon name="upload" size={18} />{t(lang, 'md.open')}
			<input class="visually-hidden" type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" onchange={openFile} />
		</label>
		<button class="btn small" type="button" onclick={() => save('md', 'text/markdown', src)}>
			<Icon name="download" size={18} />{t(lang, 'md.saveMd')}
		</button>
		<button class="btn small" type="button" onclick={async () => { await render(); save('html', 'text/html', buildDocument(rendered!, $state.snapshot(opts), 'screen', lang, t(lang, 'md.toc'), PAGED)); }}>
			<Icon name="download" size={18} />HTML
		</button>
		<button class="btn btn-primary" type="button" onclick={print} data-testid="md-print">
			<Icon name="pdf" size={18} />{t(lang, 'md.print')}
		</button>
		{#if direct}
			<button class="btn btn-primary" type="button" onclick={downloadPdf} disabled={directBusy} data-testid="md-direct">
				<Icon name="download" size={18} />{t(lang, directBusy ? 'md.directBusy' : 'md.direct')}
			</button>
		{/if}
	</div>
	{#if directError}<p class="err" role="alert">{directError}</p>{/if}

	<details class="settings" open>
		<summary>{t(lang, 'md.settings')}</summary>
		<div class="grid">
			<label class="field"><span>{t(lang, 'md.template')}</span>
				<select bind:value={opts.template}>
					{#each templates as tp}<option value={tp}>{t(lang, `md.tpl.${tp}`)}</option>{/each}
				</select>
			</label>
			<label class="field"><span>{t(lang, 'md.font')}</span>
				<select bind:value={opts.font}>
					{#each fonts as f}<option value={f}>{t(lang, `md.font.${f}`)}</option>{/each}
				</select>
			</label>
			<label class="field"><span>{t(lang, 'md.paper')}</span>
				<select bind:value={opts.paper}><option value="A4">A4</option><option value="Letter">Letter</option></select>
			</label>
			<label class="field"><span>{t(lang, 'md.header')}</span><input type="text" dir="auto" bind:value={opts.header} /></label>
			<label class="field"><span>{t(lang, 'md.footer')}</span><input type="text" dir="auto" bind:value={opts.footer} /></label>
			<label class="field"><span>{t(lang, 'md.accent')}</span><input type="color" bind:value={opts.accent} /></label>
			<label class="check"><input type="checkbox" bind:checked={opts.toc} />{t(lang, 'md.toc')}</label>
			<label class="check"><input type="checkbox" bind:checked={opts.pageNumbers} />{t(lang, 'md.numbers')}</label>
			<label class="check"><input type="checkbox" bind:checked={opts.arabicDigits} />{t(lang, 'md.arabicDigits')}</label>
		</div>
	</details>

	<div class="tabs" role="tablist" aria-label={t(lang, 'md.view')}>
		<button role="tab" type="button" aria-selected={tab === 'edit'} onclick={() => (tab = 'edit')}>{t(lang, 'md.edit')}</button>
		<button role="tab" type="button" aria-selected={tab === 'preview'} onclick={() => (tab = 'preview')}>{t(lang, 'md.preview')}</button>
	</div>

	<div class="panes" data-tab={tab}>
		<label class="pane editor">
			<span class="visually-hidden">{t(lang, 'md.edit')}</span>
			<textarea bind:value={src} dir="auto" spellcheck="false" data-testid="md-source"></textarea>
		</label>
		<div class="pane preview">
			<div class="preview-head">
				<span>{t(lang, 'md.preview')}</span>
				<label class="check small">
					<input type="checkbox" checked={mode === 'preview'} onchange={(e) => (mode = (e.currentTarget as HTMLInputElement).checked ? 'preview' : 'screen')} />
					{t(lang, 'md.paged')}
				</label>
			</div>
			<iframe title={t(lang, 'md.preview')} {srcdoc} sandbox="allow-scripts allow-same-origin allow-modals" data-testid="md-preview"></iframe>
		</div>
	</div>
	<p class="hint">{t(lang, 'md.hint')}</p>
</div>

<style>
	.err {
		margin: 0;
		color: var(--danger);
	}
	.studio {
		display: grid;
		gap: var(--space-4);
	}
	.bar {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.btn.small {
		padding: 0 var(--space-4);
		font-size: 0.9rem;
	}
	label.btn {
		cursor: pointer;
	}
	label.btn:focus-within {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
	}
	.settings {
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		padding: var(--space-3) var(--space-4);
	}
	summary {
		font-weight: 700;
		cursor: pointer;
		min-height: var(--tap);
		display: flex;
		align-items: center;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 11rem), 1fr));
		gap: var(--space-3);
		margin-top: var(--space-3);
	}
	.field {
		display: grid;
		gap: var(--space-1);
		font-size: 0.9rem;
	}
	.field select,
	.field input[type='text'] {
		min-height: var(--tap);
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--bg);
	}
	.field input[type='color'] {
		height: var(--tap);
		width: 100%;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: 2px;
	}
	.check {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap);
		font-size: 0.9rem;
	}
	.check input {
		width: 20px;
		height: 20px;
		accent-color: var(--accent);
	}
	.check.small {
		min-height: 0;
		font-size: 0.85rem;
	}
	.tabs {
		display: none;
	}
	.panes {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-3);
		min-height: 70vh;
	}
	.pane {
		display: grid;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		overflow: hidden;
		background: var(--surface);
	}
	textarea {
		width: 100%;
		height: 100%;
		min-height: 70vh;
		border: 0;
		padding: var(--space-4);
		resize: vertical;
		background: var(--surface);
		/* Cairo, not a monospace font: those have no Arabic and break the letters apart. */
		font: 1rem/1.8 var(--font);
	}
	.preview {
		grid-template-rows: auto 1fr;
	}
	.preview-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		border-bottom: 1px solid var(--border);
		font-weight: 600;
		font-size: 0.9rem;
	}
	iframe {
		width: 100%;
		height: 100%;
		min-height: 66vh;
		border: 0;
		background: #f1f0ec;
	}
	.hint {
		color: var(--muted);
		font-size: 0.9rem;
	}
	@media (max-width: 860px) {
		.tabs {
			display: flex;
			gap: var(--space-2);
		}
		.tabs button {
			flex: 1;
			min-height: var(--tap);
			border: 1px solid var(--border);
			border-radius: 999px;
			background: var(--surface);
			font-weight: 600;
			cursor: pointer;
		}
		.tabs button[aria-selected='true'] {
			background: var(--accent);
			border-color: var(--accent);
			color: var(--on-accent);
		}
		.panes {
			grid-template-columns: 1fr;
		}
		.panes[data-tab='edit'] .preview,
		.panes[data-tab='preview'] .editor {
			display: none;
		}
	}
</style>
