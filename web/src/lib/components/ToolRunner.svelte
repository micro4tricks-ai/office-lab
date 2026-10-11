<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { t } from '../i18n';
	import type { Lang, Options, Tool } from '../registry/types';
	import { ConvertError } from '../registry/types';
	import { acceptOf, createRunner, validate } from '../workers/runner.svelte';
	import DropZone from './DropZone.svelte';
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

	const pending = $derived(items.some((i) => i.status === 'waiting'));
	const finished = $derived(items.length > 0 && items.every((i) => i.status === 'done' || i.status === 'error'));
	const formats = $derived(
		tool.from.filter((f) => !f.includes('/')).map((f) => f.toUpperCase()).join('، ')
	);

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

	async function convert() {
		busy = true;
		for (const item of items) {
			if (item.status !== 'waiting') continue;
			item.status = 'working';
			try {
				item.outputs = await runner.run(tool, item.file, options, (r) => (item.progress = r));
				item.status = 'done';
			} catch (e) {
				item.status = 'error';
				item.error = e instanceof ConvertError ? e.code : 'unknown';
			}
		}
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
		{#if tool.options?.length && !finished}
			<fieldset class="options" disabled={busy}>
				<legend>{t(lang, 'tool.options')}</legend>
				{#each tool.options as opt (opt.id)}
					<label class="field">
						<span>{opt.label[lang]}</span>
						{#if opt.type === 'select'}
							<select bind:value={options[opt.id]}>
								{#each opt.choices as c (c.value)}
									<option value={c.value}>{c.label[lang]}</option>
								{/each}
							</select>
						{:else if opt.type === 'checkbox'}
							<input type="checkbox" bind:checked={options[opt.id] as boolean} />
						{:else if opt.type === 'text'}
							<input type="text" bind:value={options[opt.id]} />
						{:else}
							<input
								type={opt.type}
								min={opt.min}
								max={opt.max}
								step={opt.step ?? 1}
								bind:value={options[opt.id]}
							/>
						{/if}
					</label>
				{/each}
			</fieldset>
		{/if}

		<ResultList {lang} {items} maxMB={tool.maxMB} onremove={busy ? undefined : (id) => (items = items.filter((i) => i.id !== id))} />

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
	.options {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-4);
		margin: 0;
		padding: var(--space-4);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
	}
	legend {
		padding: 0 var(--space-2);
		font-weight: 700;
	}
	.field {
		display: grid;
		gap: var(--space-1);
		min-width: 12rem;
		font-size: 0.95rem;
	}
	.field select,
	.field input:not([type='checkbox']) {
		min-height: var(--tap);
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--bg);
	}
	.field input[type='checkbox'] {
		width: 22px;
		height: 22px;
		accent-color: var(--accent);
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
