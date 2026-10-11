<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { t } from '../i18n';
	import { formatList } from '../registry/tools';
	import type { FileData, Lang, OptionSpec, Options, Tool } from '../registry/types';
	import { ConvertError } from '../registry/types';
	import { prepare } from '../workers/prepare';
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
	let missing = $state<string | null>(null);

	const pending = $derived(items.some((i) => i.status === 'waiting'));
	const finished = $derived(items.length > 0 && items.every((i) => i.status === 'done' || i.status === 'error'));
	const formats = $derived(formatList(tool.from).join(lang === 'ar' ? '، ' : ', '));
	const shown = (o: OptionSpec) => !o.when || o.when.in.includes(options[o.when.id] as string);
	const visible = $derived((tool.options ?? []).filter(shown));

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

	async function pickImage(id: string, e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		options[id] = file ? ((await prepare(file)) as FileData) : null;
	}

	async function runOne(item: Item) {
		item.status = 'working';
		try {
			item.outputs = await runner.run(tool, item.file, options, (r) => (item.progress = r));
			item.status = 'done';
		} catch (e) {
			item.status = 'error';
			item.error = e instanceof ConvertError ? e.code : 'unknown';
		}
	}

	async function convert() {
		const need = visible.find((o) => o.type === 'image' && !options[o.id]);
		if (need) {
			missing = need.id;
			document.getElementById(`opt-${need.id}`)?.focus();
			return;
		}
		missing = null;
		busy = true;
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
		{#if visible.length && !finished}
			<fieldset class="options" disabled={busy}>
				<legend>{t(lang, 'tool.options')}</legend>
				{#each visible as opt (opt.id)}
					<div class="field" class:wide={opt.type === 'range' || opt.type === 'text'}>
						{#if opt.type === 'checkbox'}
							<label class="check">
								<input id="opt-{opt.id}" type="checkbox" bind:checked={options[opt.id] as boolean} />
								<span>{opt.label[lang]}</span>
							</label>
						{:else}
							<label for="opt-{opt.id}">
								{opt.label[lang]}
								{#if opt.type === 'range'}
									<output for="opt-{opt.id}" dir="ltr">{options[opt.id]}{opt.unit ?? ''}</output>
								{/if}
							</label>
							{#if opt.type === 'select'}
								<select id="opt-{opt.id}" bind:value={options[opt.id]}>
									{#each opt.choices as c (c.value)}
										<option value={c.value}>{c.label[lang]}</option>
									{/each}
								</select>
							{:else if opt.type === 'text'}
								<input id="opt-{opt.id}" type="text" dir="auto" bind:value={options[opt.id]} />
							{:else if opt.type === 'color'}
								<input id="opt-{opt.id}" type="color" bind:value={options[opt.id]} />
							{:else if opt.type === 'image'}
								<input
									id="opt-{opt.id}"
									type="file"
									accept="image/*"
									aria-invalid={missing === opt.id}
									aria-describedby={missing === opt.id ? `err-${opt.id}` : undefined}
									onchange={(e) => pickImage(opt.id, e)}
								/>
								{#if missing === opt.id}
									<span id="err-{opt.id}" class="err" role="alert">{t(lang, 'tool.needImage')}</span>
								{/if}
							{:else if opt.type === 'range'}
								<input
									id="opt-{opt.id}"
									type="range"
									min={opt.min}
									max={opt.max}
									step={opt.step ?? 1}
									bind:value={options[opt.id]}
								/>
							{:else}
								<span class="with-unit" dir="ltr">
									<input
										id="opt-{opt.id}"
										type="number"
										inputmode="numeric"
										min={opt.min}
										max={opt.max}
										step={opt.step ?? 1}
										bind:value={options[opt.id]}
									/>
									{#if opt.unit}<span class="unit" dir="ltr">{opt.unit}</span>{/if}
								</span>
							{/if}
						{/if}
					</div>
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
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 13rem), 1fr));
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
		align-content: start;
		font-size: 0.95rem;
	}
	.field.wide {
		grid-column: span 2;
	}
	@media (max-width: 480px) {
		.field.wide {
			grid-column: auto;
		}
	}
	.field > label {
		display: flex;
		justify-content: space-between;
		gap: var(--space-2);
	}
	output {
		font-weight: 700;
		color: var(--accent-strong);
	}
	.field select,
	.field input[type='text'],
	.field input[type='number'],
	.field input[type='file'] {
		width: 100%;
		min-height: var(--tap);
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--bg);
	}
	.field input[type='file'] {
		padding: var(--space-2);
	}
	.field input[type='range'] {
		width: 100%;
		min-height: var(--tap);
		accent-color: var(--accent);
	}
	.field input[type='color'] {
		width: 100%;
		height: var(--tap);
		padding: 2px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--bg);
	}
	.check {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap);
		cursor: pointer;
	}
	.check input {
		width: 22px;
		height: 22px;
		accent-color: var(--accent);
	}
	/* Numbers read left-to-right in both languages; the unit sits at the end, outside the digits. */
	.with-unit {
		position: relative;
		display: block;
	}
	.with-unit input {
		padding-inline-end: 3rem;
	}
	.unit {
		position: absolute;
		inset-inline-end: var(--space-3);
		top: 50%;
		transform: translateY(-50%);
		color: var(--muted);
		font-size: 0.85rem;
		pointer-events: none;
	}
	.err {
		color: var(--danger);
		font-size: 0.875rem;
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
