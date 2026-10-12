<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import Icon from '../components/Icon.svelte';
	import ProgressBar from '../components/ProgressBar.svelte';
	import { serverCapabilities } from '../config';
	import { downloadFile } from '../download';
	import { t } from '../i18n';
	import { ConvertError, type FileData, type Lang } from '../registry/types';
	import { sendToServer } from '../remote';
	import { docTypeOf, translateDocument } from '../translate/docs';
	import { chromeCan, mtCan, pickEngine, proAvailable, translateAll, type EngineChoice, type Lang3 } from '../translate/engines';
	import CopyButton from './CopyButton.svelte';

	let { lang }: { lang: Lang } = $props();

	let mode = $state<'file' | 'text'>('file');
	// An Arabic page usually wants English → Arabic, an English page the other way.
	let src = $state<Lang3>(untrack(() => (lang === 'ar' ? 'en' : 'ar')));
	let tgt = $state<Lang3>(untrack(() => (lang === 'ar' ? 'ar' : 'en')));
	let engine = $state<EngineChoice>('free');
	let pro = $state(false);
	let pdfOnServer = $state(false);
	let chrome = $state(false);
	let file = $state<File | null>(null);
	let input = $state('');
	let output = $state('');
	let result = $state<FileData | null>(null);
	let busy = $state(false);
	let stage = $state<'loading' | 'translating' | 'pdf'>('translating');
	let ratio = $state(0);
	let error = $state('');

	onMount(async () => {
		pro = await proAvailable();
		pdfOnServer = (await serverCapabilities()).has('pdf-to-word');
	});
	$effect(() => {
		const [s, g] = [src, tgt];
		chromeCan(s, g).then((ok) => (chrome = ok));
	});

	const LANGS: Lang3[] = ['ar', 'en', 'fr'];
	const freeOk = $derived(chrome || mtCan(src, tgt));
	const accept = $derived(['.docx', '.pptx', '.xlsx', '.txt', '.md', '.srt', ...(pdfOnServer ? ['.pdf'] : [])].join(','));
	function swap() {
		[src, tgt] = [tgt, src];
	}

	function pick(e: Event) {
		const f = (e.currentTarget as HTMLInputElement).files?.[0];
		file = f ?? null;
		result = null;
		error = '';
	}

	const fail = (e: unknown) => {
		const code = e instanceof ConvertError ? e.code : 'unknown';
		if (code === 'unknown') console.error('[office-lab] translate:', e);
		error = t(lang, `err.${code}`, { mb: 100 });
	};

	async function engineOrError() {
		const picked = await pickEngine(src, tgt, engine);
		if (!picked) throw new ConvertError('options');
		return picked;
	}

	async function run() {
		if (busy) return;
		busy = true;
		error = '';
		result = null;
		output = '';
		ratio = 0;
		try {
			const { run: batch } = await engineOrError();
			const progress = (s: 'loading' | 'translating', r: number) => ((stage = s), (ratio = r));
			const translate = (texts: string[]) => translateAll(texts, batch, progress);
			if (mode === 'text') {
				const [out] = await translate([input]);
				output = out;
				return;
			}
			if (!file) return;
			let name = file.name;
			let bytes: Uint8Array = new Uint8Array(await file.arrayBuffer());
			if (/\.pdf$/i.test(name)) {
				// PDF: the server turns it into Word first, then it is translated like any document.
				stage = 'pdf';
				const [docx] = await sendToServer('pdf-to-word', { file: { name, type: 'application/pdf', bytes } }, {}, (r) => (ratio = r));
				bytes = docx.bytes;
				name = name.replace(/\.pdf$/i, '.docx');
			}
			const type = docTypeOf(name);
			if (!type) throw new ConvertError('wrong-type');
			const out = await translateDocument(bytes, type, translate, tgt === 'ar');
			const ext = name.split('.').pop();
			result = { name: name.replace(/\.[^.]+$/, `-${tgt}.${ext}`), type: file.type || 'application/octet-stream', bytes: out };
		} catch (e) {
			fail(e);
		} finally {
			busy = false;
		}
	}
</script>

<div class="w-panel">
	<div class="tabs" role="tablist">
		<button role="tab" type="button" aria-selected={mode === 'file'} onclick={() => (mode = 'file')}>{t(lang, 'tr.file')}</button>
		<button role="tab" type="button" aria-selected={mode === 'text'} onclick={() => (mode = 'text')}>{t(lang, 'tr.text')}</button>
	</div>

	<div class="langs">
		<label class="w-field"><span>{t(lang, 'tr.from')}</span>
			<select bind:value={src} data-testid="tr-from">{#each LANGS as l}<option value={l}>{t(lang, `tr.lang.${l}`)}</option>{/each}</select>
		</label>
		<button class="btn swap" type="button" onclick={swap} aria-label={t(lang, 'tr.swap')}>⇄</button>
		<label class="w-field"><span>{t(lang, 'tr.to')}</span>
			<select bind:value={tgt} data-testid="tr-to">{#each LANGS as l}<option value={l}>{t(lang, `tr.lang.${l}`)}</option>{/each}</select>
		</label>
		<label class="w-field"><span>{t(lang, 'tr.engine')}</span>
			<select bind:value={engine} data-testid="tr-engine">
				<option value="free">{t(lang, 'tr.free')}</option>
				{#if pro}<option value="pro">{t(lang, 'tr.pro')}</option>{/if}
			</select>
		</label>
	</div>
	<p class="hint">
		{#if engine === 'pro'}{t(lang, 'tr.proNote')}{:else if chrome}{t(lang, 'tr.chromeNote')}{:else if freeOk}{t(lang, 'tr.mtNote')}{:else}{t(lang, 'tr.noFree')}{/if}
	</p>

	{#if mode === 'file'}
		<label class="w-field">
			<span>{t(lang, 'tr.pick')} ({accept.replaceAll('.', '').replaceAll(',', '، ')})</span>
			<input type="file" {accept} onchange={pick} data-testid="tr-file" />
		</label>
	{:else}
		<label class="w-field"><span>{t(lang, 'tr.input')}</span><textarea rows="6" dir="auto" bind:value={input} data-testid="tr-input"></textarea></label>
	{/if}

	<div class="w-row">
		<button class="btn btn-primary" type="button" onclick={run} disabled={busy || (mode === 'file' ? !file : !input.trim()) || src === tgt} data-testid="tr-go">
			<Icon name="globe" />{t(lang, busy ? 'tr.working' : 'tr.go')}
		</button>
	</div>

	{#if busy}
		<p role="status">{t(lang, `tr.stage.${stage}`)}</p>
		<ProgressBar value={ratio} label={t(lang, `tr.stage.${stage}`)} />
	{/if}
	{#if error}<p class="err" role="alert">{error}</p>{/if}
</div>

{#if result}
	<div class="w-panel done" data-testid="tr-result">
		<p>{t(lang, 'tr.done')}</p>
		<button class="btn btn-primary" type="button" onclick={() => downloadFile(result!)}><Icon name="download" />{t(lang, 'result.download')} ({result.name})</button>
		<p class="hint">{t(lang, 'tr.review')}</p>
	</div>
{/if}
{#if output}
	<div class="w-panel done">
		<label class="w-field"><span>{t(lang, 'tr.output')}</span><textarea rows="6" dir="auto" readonly data-testid="tr-output">{output}</textarea></label>
		<CopyButton {lang} text={output} />
	</div>
{/if}

<style>
	.tabs {
		display: flex;
		gap: var(--space-2);
		margin-bottom: var(--space-3);
	}
	.tabs button {
		min-height: var(--tap);
		padding: 0 var(--space-4);
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--surface);
		color: var(--text);
		font: inherit;
		cursor: pointer;
	}
	.tabs button[aria-selected='true'] {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--on-accent);
	}
	.langs {
		display: grid;
		grid-template-columns: 1fr auto 1fr 1.4fr;
		gap: var(--space-3);
		align-items: end;
	}
	@media (max-width: 640px) {
		.langs {
			grid-template-columns: 1fr auto 1fr;
		}
		.langs > :last-child {
			grid-column: 1 / -1;
		}
	}
	.swap {
		min-width: var(--tap);
		font-size: 1.2rem;
	}
	.hint {
		margin: var(--space-2) 0;
		color: var(--muted);
		font-size: 0.9rem;
	}
	.err {
		color: var(--danger);
	}
	.done {
		margin-top: var(--space-4);
		display: grid;
		gap: var(--space-3);
		justify-items: start;
	}
	.done p {
		margin: 0;
	}
</style>
