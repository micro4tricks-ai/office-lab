<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import { takeHandoff } from '../handoff';
	import { t } from '../i18n';
	import { formatList } from '../registry/tools';
	import type { FormValues, Lang, OptionSpec, Options, PagePlan, Placement, Tool } from '../registry/types';
	import { ConvertError } from '../registry/types';
	import { prepare } from '../workers/prepare';
	import { acceptOf, createRunner, validate } from '../workers/runner.svelte';
	import DropZone from './DropZone.svelte';
	import OptionsForm from './OptionsForm.svelte';
	import PdfOrganizer from './PdfOrganizer.svelte';
	import PdfForm from './PdfForm.svelte';
	import PdfPlacer from './PdfPlacer.svelte';
	import ResultList, { type Item } from './ResultList.svelte';

	let { tool, lang }: { tool: Tool; lang: Lang } = $props();

	const runner = createRunner();
	onDestroy(runner.dispose);

	let items = $state<Item[]>([]);
	let busy = $state(false);
	let seq = 0;
	let options = $state<Options>(
		untrack(() => Object.fromEntries((tool.options ?? []).map((o) => [o.id, o.default])))
	);
	let missing = $state<string | null>(null);
	let countError = $state(false);
	let editorError = $state<string | null>(null);

	const pending = $derived(items.some((i) => i.status === 'waiting'));
	const finished = $derived(items.length > 0 && items.every((i) => i.status === 'done' || i.status === 'error'));
	const formats = $derived(formatList(tool.from).join(lang === 'ar' ? '، ' : ', '));
	const shown = (o: OptionSpec) => !o.when || o.when.in.includes(options[o.when.id] as string);
	const visible = $derived((tool.options ?? []).filter(shown));

	// Files sent here from the Share menu (or another page).
	onMount(() => {
		const shared = takeHandoff();
		if (shared.length) add(shared);
	});

	function add(files: File[]) {
		if (!tool.batch) items = [];
		for (const file of tool.batch ? files : files.slice(0, 1)) {
			const err = validate(tool, file);
			items.push({
				id: ++seq,
				file,
				status: err ? 'error' : 'waiting',
				error: err?.code,
				progress: 0,
				outputs: []
			});
		}
	}

	/** Editors get previews (and other helper runs) from the same worker pool. */
	const runEngine = async (engine: string, file: File, opts: Record<string, string | number>) =>
		runner.runData(engine, await prepare(file), opts);
	const preview = (file: File, opts: Record<string, string | number>) => runEngine('pdf-thumbs', file, opts);
	/** The one file an editor works on (editor tools take a single file). */
	const editing = $derived(tool.editor ? items.find((i) => i.status === 'waiting') : undefined);

	/** Unexpected failures go to the console so a bug report can include them. */
	function errorCode(e: unknown) {
		const code = e instanceof ConvertError ? e.code : 'unknown';
		if (code === 'unknown') console.error(`[office-lab] ${tool.id}:`, e);
		return code;
	}

	async function runOne(item: Item) {
		item.status = 'working';
		try {
			item.outputs = await runner.run(tool, item.file, { ...options, uiLang: lang }, (r) => (item.progress = r));
			item.status = 'done';
		} catch (e) {
			item.status = 'error';
			item.error = errorCode(e);
		}
	}

	function move(id: number, by: -1 | 1) {
		const i = items.findIndex((x) => x.id === id);
		const j = i + by;
		if (i < 0 || j < 0 || j >= items.length) return;
		[items[i], items[j]] = [items[j], items[i]];
	}

	/** Combine tools: every waiting file goes into one job; its result replaces the list. */
	async function convertCombined(min: number, max = Infinity) {
		const inputs = items.filter((i) => i.status === 'waiting');
		countError = inputs.length < min || inputs.length > max;
		if (countError) return;
		const job: Item = {
			id: ++seq,
			file: inputs[0].file,
			label: t(lang, 'result.combined', { n: inputs.length }),
			inputSize: inputs.reduce((s, i) => s + i.file.size, 0),
			status: 'working',
			progress: 0,
			outputs: []
		};
		items = [job];
		const row = items[0];
		try {
			row.outputs = await runner.runAll(tool, inputs.map((i) => i.file), { ...options, uiLang: lang }, (r) => (row.progress = r));
			row.status = 'done';
		} catch (e) {
			row.status = 'error';
			row.error = errorCode(e);
		}
	}

	async function convert() {
		const need = visible.find(
			(o) => (o.type === 'image' || (o.type === 'text' && o.required)) && !String(options[o.id] ?? '').trim()
		);
		if (need) {
			missing = need.id;
			document.getElementById(`opt-${need.id}`)?.focus();
			return;
		}
		missing = null;
		editorError = null;
		if (tool.editor === 'place' && !(options.items as Placement[] | undefined)?.length) {
			editorError = t(lang, 'place.needItem');
			return;
		}
		busy = true;
		if (tool.combine) {
			await convertCombined(tool.combine.min, tool.combine.max);
			busy = false;
			return;
		}
		// The runner queues these and runs as many at once as it has workers.
		await Promise.all(items.filter((i) => i.status === 'waiting').map(runOne));
		busy = false;
	}

	function reset() {
		items = [];
	}
</script>

<div class="runner">
	{#if items.length === 0}
		<DropZone
			{lang}
			accept={acceptOf(tool)}
			{formats}
			maxMB={tool.maxMB}
			multiple={tool.batch}
			onfiles={add}
		/>
	{:else}
		{#if editing && tool.editor === 'organize'}
			{#key editing.id}
				<PdfOrganizer {lang} file={editing.file} {preview} bind:plan={options.plan as PagePlan[] | null} />
			{/key}
		{:else if editing && tool.editor === 'place'}
			{#key editing.id}
				<PdfPlacer
					{lang}
					file={editing.file}
					mode={tool.params?.mode === 'sign' || tool.params?.mode === 'redact' ? tool.params.mode : 'annotate'}
					{preview}
					bind:placements={options.items as Placement[] | null}
				/>
			{/key}
		{/if}
		{#if editing && tool.editor === 'form'}
			{#key editing.id}
				<PdfForm {lang} file={editing.file} run={runEngine} bind:values={options.fields as FormValues | null} />
			{/key}
		{/if}
		{#if editorError}<p class="err" role="alert">{editorError}</p>{/if}
		{#if visible.length && !finished}
			<OptionsForm {lang} specs={visible} bind:options {missing} disabled={busy} legend={t(lang, 'tool.options')} />
		{/if}

		{#if tool.combine && pending}
			<p class="hint" class:err={countError} role={countError ? 'alert' : undefined}>
				{t(lang, 'tool.combineHint', { n: tool.combine.min })}
			</p>
		{/if}
		<ResultList
			{lang}
			{items}
			maxMB={tool.maxMB}
			onremove={busy ? undefined : (id) => (items = items.filter((i) => i.id !== id))}
			onmove={tool.combine && !busy ? move : undefined}
		/>

		<div class="bar">
			{#if pending || busy}
				<button class="btn btn-primary big" type="button" onclick={convert} disabled={busy}>
					{t(lang, busy ? 'tool.converting' : 'tool.convert')}
				</button>
			{/if}
			{#if !busy}
				<button class="btn" type="button" onclick={reset}>{t(lang, 'tool.again')}</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.runner {
		display: grid;
		gap: var(--space-6);
	}
	.err {
		color: var(--danger);
		font-size: 0.875rem;
	}
	.hint {
		color: var(--muted);
		font-size: 0.9rem;
		margin: 0;
	}
	.bar {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
	}
	.big {
		min-width: 10rem;
	}
</style>
