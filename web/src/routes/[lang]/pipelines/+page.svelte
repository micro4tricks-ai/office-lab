<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import DropZone from '#lib/components/DropZone.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import OptionsForm from '#lib/components/OptionsForm.svelte';
	import ProgressBar from '#lib/components/ProgressBar.svelte';
	import ResultList, { type Item } from '#lib/components/ResultList.svelte';
	import Seo from '#lib/components/Seo.svelte';
	import { serverCapabilities } from '#lib/config.ts';
	import { takeHandoff } from '#lib/handoff.ts';
	import { formatSize, t } from '#lib/i18n/index.ts';
	import {
		accepts,
		chainError,
		defaults,
		loadChains,
		nextTools,
		PRESETS,
		runChain,
		saveChains,
		storableSteps,
		type Chain,
		type RunStep
	} from '#lib/pipeline.ts';
	import { formatList, toolById } from '#lib/registry/tools.ts';
	import { CATEGORIES, ConvertError, type FileData, type OptionSpec, type Options, type Tool } from '#lib/registry/types.ts';
	import { prepare } from '#lib/workers/prepare.ts';
	import { acceptOf, createRunner } from '#lib/workers/runner.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const lang = $derived(data.lang);

	type UiStep = { uid: number; tool: Tool; options: Options };
	let uid = 0;
	let steps = $state<UiStep[]>([]);
	let saved = $state<Chain[]>([]);
	let caps = $state(new Set<string>());
	let files = $state<File[]>([]);
	let name = $state('');
	let savedOk = $state(false);
	let missing = $state<{ step: number; id: string } | null>(null);
	let items = $state<Item[]>([]);
	let busy = $state(false);
	let stepNow = $state(0);
	let ratio = $state(0);

	const runner = createRunner();
	onDestroy(runner.dispose);

	onMount(async () => {
		saved = loadChains();
		const shared = takeHandoff();
		if (shared.length) files = shared;
		caps = await serverCapabilities();
	});

	const usable = (tool: Tool) => tool.runtime === 'browser' || caps.has(tool.id);
	const plain = $derived(steps.map((s) => ({ tool: s.tool.id, options: s.options })));
	const problem = $derived(steps.length ? chainError(plain) : null);
	const mismatchAt = $derived(problem?.startsWith('mismatch:') ? Number(problem.split(':')[1]) : -1);
	const choices = $derived(nextTools(plain).filter(usable));
	const first = $derived(steps[0]?.tool);
	const shown = (s: UiStep) => (s.tool.options ?? []).filter((o: OptionSpec) => !o.when || o.when.in.includes(s.options[o.when.id] as string));

	function load(chain: Chain) {
		steps = chain.steps.map((s) => {
			const tool = toolById(s.tool)!;
			return { uid: ++uid, tool, options: { ...defaults(tool), ...s.options } };
		});
		name = chain.name[lang];
		items = [];
		savedOk = false;
	}

	function add(e: Event) {
		const select = e.currentTarget as HTMLSelectElement;
		const tool = toolById(select.value);
		select.value = '';
		if (!tool) return;
		steps.push({ uid: ++uid, tool, options: defaults(tool) });
		savedOk = false;
	}

	function move(i: number, by: -1 | 1) {
		const j = i + by;
		if (j < 0 || j >= steps.length) return;
		[steps[i], steps[j]] = [steps[j], steps[i]];
	}

	function save() {
		const label = name.trim() || steps.map((s) => s.tool.i18n[lang].title).join(lang === 'ar' ? ' ← ' : ' → ');
		const chain: Chain = { id: `c${Date.now()}`, name: { ar: label, en: label }, steps: storableSteps($state.snapshot(plain) as typeof plain) };
		saved = [...saved, chain];
		saveChains(saved);
		savedOk = true;
	}

	function forget(id: string) {
		saved = saved.filter((c) => c.id !== id);
		saveChains(saved);
	}

	/** One step's work: worker engines in the browser, a request for server tools. */
	const runStep: RunStep = async (tool, inputs, options, progress) => {
		const opts = { ...tool.params, ...($state.snapshot(options) as Options), uiLang: lang };
		if (tool.runtime === 'server') return (await tool.load()).convert(inputs[0], opts, progress);
		return runner.runData(tool.engine, tool.combine ? inputs : inputs[0], opts, progress);
	};

	async function run() {
		for (const [i, s] of steps.entries()) {
			const need = shown(s).find((o) => (o.type === 'image' || (o.type === 'text' && o.required)) && !String(s.options[o.id] ?? '').trim());
			if (need) {
				missing = { step: i, id: need.id };
				document.getElementById(`s${s.uid}-${need.id}`)?.focus();
				return;
			}
		}
		missing = null;
		busy = true;
		const job: Item = {
			id: Date.now(),
			file: files[0],
			label: t(lang, 'pipe.result', { n: files.length }),
			inputSize: files.reduce((n, f) => n + f.size, 0),
			status: 'working',
			progress: 0,
			outputs: []
		};
		items = [job];
		const row = items[0];
		try {
			let inputs: FileData[];
			try {
				inputs = await Promise.all(files.map(prepare));
			} catch {
				throw new ConvertError('corrupted');
			}
			row.outputs = await runChain(
				steps.map((s) => ({ tool: s.tool, options: s.options })),
				inputs,
				runStep,
				(r, i) => {
					row.progress = r;
					ratio = r;
					stepNow = i;
				}
			);
			row.status = 'done';
		} catch (e) {
			row.status = 'error';
			row.error = e instanceof ConvertError ? e.code : 'unknown';
			if (row.error === 'unknown') console.error('[office-lab] chain:', e);
		}
		busy = false;
	}

	function again() {
		files = [];
		items = [];
	}
</script>

<Seo {lang} title="{t(lang, 'pipe.title')} — {t(lang, 'app.name')}" desc={t(lang, 'pipe.desc')} path="pipelines/" />

<div class="container page">
	<header class="head">
		<h1>{t(lang, 'pipe.title')}</h1>
		<p class="desc">{t(lang, 'pipe.lead')}</p>
		<p class="badge"><Icon name="shield" size={16} />{t(lang, 'tool.privacy')}</p>
	</header>

	<section aria-labelledby="ready">
		<h2 id="ready">{t(lang, 'pipe.ready')}</h2>
		<div class="chains">
			{#each PRESETS as c (c.id)}
				<button class="chain" type="button" onclick={() => load(c)}>
					<Icon name="chain" size={18} />
					<span>{c.name[lang]}</span>
				</button>
			{/each}
		</div>
		{#if saved.length}
			<h2>{t(lang, 'pipe.saved')}</h2>
			<div class="chains">
				{#each saved as c (c.id)}
					<span class="saved">
						<button class="chain" type="button" onclick={() => load(c)}>
							<Icon name="chain" size={18} />
							<span dir="auto">{c.name[lang]}</span>
						</button>
						<button class="icon-btn" type="button" onclick={() => forget(c.id)} aria-label={t(lang, 'pipe.delete', { name: c.name[lang] })}>
							<Icon name="x" size={18} />
						</button>
					</span>
				{/each}
			</div>
		{/if}
	</section>

	<section aria-labelledby="steps" class="builder">
		<h2 id="steps">{t(lang, 'pipe.steps')}</h2>
		{#if !steps.length}<p class="muted">{t(lang, 'pipe.empty')}</p>{/if}
		<ol class="steps">
			{#each steps as s, i (s.uid)}
				<li class="step" class:bad={mismatchAt === i}>
					<div class="step-head">
						<span class="num">{i + 1}</span>
						<h3>{s.tool.i18n[lang].title}</h3>
						<span class="fmt" dir="ltr">{formatList(s.tool.from, 3).join(' · ')}{#if s.tool.to.length} → {formatList(s.tool.to).join(' · ')}{/if}</span>
						<span class="tools">
							<button class="icon-btn" type="button" disabled={busy || i === 0} onclick={() => move(i, -1)} aria-label={t(lang, 'pipe.up', { n: i + 1 })}><Icon name="up" size={18} /></button>
							<button class="icon-btn" type="button" disabled={busy || i === steps.length - 1} onclick={() => move(i, 1)} aria-label={t(lang, 'pipe.down', { n: i + 1 })}><Icon name="down" size={18} /></button>
							<button class="icon-btn" type="button" disabled={busy} onclick={() => steps.splice(i, 1)} aria-label={t(lang, 'pipe.remove', { n: i + 1 })}><Icon name="x" size={18} /></button>
						</span>
					</div>
					{#if mismatchAt === i}<p class="err" role="alert">{t(lang, 'pipe.mismatch', { n: i + 1 })}</p>{/if}
					{#if shown(s).length}
						<OptionsForm
							{lang}
							specs={shown(s)}
							bind:options={s.options}
							missing={missing?.step === i ? missing.id : null}
							disabled={busy}
							legend={t(lang, 'tool.options')}
							prefix="s{s.uid}-"
						/>
					{/if}
				</li>
			{/each}
		</ol>
		<label class="add">
			<span>{t(lang, steps.length ? 'pipe.add' : 'pipe.addFirst')}</span>
			<select onchange={add} disabled={busy} data-testid="add-step">
				<option value="">{t(lang, 'pipe.pick')}</option>
				{#each CATEGORIES as c (c)}
					{@const list = choices.filter((x) => x.category === c)}
					{#if list.length}
						<optgroup label={t(lang, `cat.${c}`)}>
							{#each list as tool (tool.id)}<option value={tool.id}>{tool.i18n[lang].title}</option>{/each}
						</optgroup>
					{/if}
				{/each}
			</select>
		</label>
		{#if steps.length && !problem}
			<div class="save">
				<label>
					<span>{t(lang, 'pipe.name')}</span>
					<input type="text" dir="auto" bind:value={name} oninput={() => (savedOk = false)} />
				</label>
				<button class="btn" type="button" onclick={save}>{t(lang, 'pipe.save')}</button>
				{#if savedOk}<span class="ok" role="status">{t(lang, 'pipe.savedOk')}</span>{/if}
			</div>
		{/if}
	</section>

	{#if first && !problem}
		<section class="run">
			{#if !items.length}
				{#if files.length}
					<ul class="files">
						{#each files as f, i (i)}
							<li class:bad={!accepts(first, f)}>
								<span dir="auto">{f.name}</span>
								<span class="muted">{formatSize(lang, f.size)}</span>
								<button class="icon-btn" type="button" onclick={() => files.splice(i, 1)} aria-label={t(lang, 'drop.remove', { name: f.name })}><Icon name="x" size={18} /></button>
							</li>
						{/each}
					</ul>
					<div class="bar">
						<button class="btn btn-primary big" type="button" onclick={run} disabled={busy || !files.some((f) => accepts(first, f))}>{t(lang, 'pipe.run')}</button>
						<button class="btn" type="button" onclick={() => (files = [])}>{t(lang, 'pipe.clear')}</button>
					</div>
				{:else}
					<DropZone {lang} accept={acceptOf(first)} formats={formatList(first.from).join(lang === 'ar' ? '، ' : ', ')} maxMB={first.maxMB} onfiles={(f) => (files = f)} />
				{/if}
			{:else}
				{#if busy}
					<p role="status">{t(lang, 'pipe.running', { n: stepNow + 1, total: steps.length, name: steps[stepNow]?.tool.i18n[lang].title ?? '' })}</p>
					<ProgressBar value={ratio} label={t(lang, 'pipe.run')} />
				{/if}
				<ResultList {lang} {items} maxMB={first.maxMB} />
				{#if !busy}<div class="bar"><button class="btn" type="button" onclick={again}>{t(lang, 'tool.again')}</button></div>{/if}
			{/if}
		</section>
	{/if}
</div>

<style>
	.page {
		max-width: 68rem;
		padding-block: var(--space-6) var(--space-12);
		display: grid;
		gap: var(--space-8);
	}
	.head {
		display: grid;
		gap: var(--space-2);
		justify-items: start;
	}
	h1 {
		font-size: clamp(1.6rem, 5vw, 2.2rem);
		font-weight: 800;
	}
	h2 {
		font-size: 1.2rem;
		margin-block: var(--space-2) var(--space-3);
	}
	h3 {
		font-size: 1.05rem;
		margin: 0;
	}
	.desc,
	.muted {
		color: var(--muted);
	}
	.chains {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
	}
	.chain {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap);
		padding: var(--space-2) var(--space-4);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		color: var(--text);
		font: inherit;
		font-weight: 600;
		text-align: start;
		cursor: pointer;
	}
	.chain:hover {
		border-color: var(--accent);
	}
	.saved {
		display: inline-flex;
		align-items: center;
	}
	.builder,
	.run {
		display: grid;
		gap: var(--space-4);
	}
	.steps {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--space-4);
	}
	.step {
		display: grid;
		gap: var(--space-3);
		padding: var(--space-4);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.step.bad {
		border-color: var(--danger);
	}
	.step-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
	}
	.num {
		display: grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		border-radius: 999px;
		background: var(--accent);
		color: var(--on-accent);
		font-weight: 700;
	}
	.fmt {
		color: var(--muted);
		font-size: 0.85rem;
	}
	.tools {
		display: inline-flex;
		margin-inline-start: auto;
	}
	.add,
	.save label {
		display: grid;
		gap: var(--space-1);
		font-weight: 600;
	}
	.add select,
	.save input {
		min-height: var(--tap);
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--bg);
		font: inherit;
		max-width: 28rem;
	}
	.save {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		gap: var(--space-3);
	}
	.ok {
		color: var(--accent-strong);
		font-weight: 600;
	}
	.err {
		color: var(--danger);
		margin: 0;
	}
	.files {
		list-style: none;
		margin: 0;
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		display: grid;
		gap: var(--space-1);
	}
	.files li {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		overflow-wrap: anywhere;
	}
	.files li > span:first-child {
		flex: 1;
	}
	.files li.bad {
		color: var(--danger);
	}
	.icon-btn {
		display: inline-grid;
		place-items: center;
		min-width: var(--tap);
		min-height: var(--tap);
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: var(--muted);
		cursor: pointer;
	}
	.icon-btn:hover:not(:disabled) {
		color: var(--text);
		background: var(--surface);
	}
	.icon-btn:disabled {
		opacity: 0.35;
		cursor: default;
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
