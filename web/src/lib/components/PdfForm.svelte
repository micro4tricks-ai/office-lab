<script lang="ts">
	import { onMount } from 'svelte';
	import type { FieldInfo } from '../adapters/pdf/forms';
	import { t } from '../i18n';
	import type { FileData, FormValues, Lang } from '../registry/types';

	let {
		lang,
		file,
		run,
		values = $bindable()
	}: {
		lang: Lang;
		file: File;
		run: (engine: string, file: File, options: Record<string, string | number>) => Promise<FileData[]>;
		values: FormValues | null;
	} = $props();

	let fields = $state<FieldInfo[]>([]);
	let filled = $state<FormValues>({});
	let loading = $state(true);
	let failed = $state(false);

	$effect(() => {
		values = { ...filled };
	});

	onMount(async () => {
		try {
			const [json] = await run('pdf-forms', file, { action: 'fields' });
			fields = (JSON.parse(new TextDecoder().decode(json.bytes)) as FieldInfo[]).filter((f) => f.type !== 'other');
			filled = Object.fromEntries(fields.map((f) => [f.name, f.value]));
		} catch {
			failed = true;
		}
		loading = false;
	});

	const id = (name: string) => 'field-' + name.replace(/[^\w-]/g, '_');
</script>

<section class="form" aria-labelledby="form-title">
	<h2 id="form-title">{t(lang, 'form.title')}</h2>
	{#if loading}
		<p role="status">{t(lang, 'form.loading')}</p>
	{:else if failed}
		<p class="err" role="alert">{t(lang, 'err.corrupted')}</p>
	{:else if !fields.length}
		<p class="err" role="alert">{t(lang, 'form.none')}</p>
	{:else}
		<p class="hint">{t(lang, 'form.hint', { n: fields.length })}</p>
		<div class="grid">
			{#each fields as f (f.name)}
				<div class="field">
					{#if f.type === 'checkbox'}
						<label class="check">
							<input type="checkbox" bind:checked={filled[f.name] as boolean} />
							<span dir="auto">{f.name}</span>
						</label>
					{:else}
						<label for={id(f.name)} dir="auto">{f.name}</label>
						{#if f.options?.length}
							<select id={id(f.name)} bind:value={filled[f.name]}>
								<option value="">—</option>
								{#each f.options as o}<option value={o}>{o}</option>{/each}
							</select>
						{:else if f.multiline}
							<textarea id={id(f.name)} dir="auto" rows="3" bind:value={filled[f.name]}></textarea>
						{:else}
							<input id={id(f.name)} type="text" dir="auto" bind:value={filled[f.name]} />
						{/if}
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</section>

<style>
	.form {
		display: grid;
		gap: var(--space-3);
		padding: var(--space-4);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
	}
	h2 {
		font-size: 1.1rem;
	}
	.hint {
		color: var(--muted);
		font-size: 0.9rem;
	}
	.err {
		color: var(--danger);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr));
		gap: var(--space-4);
	}
	.field {
		display: grid;
		gap: var(--space-1);
		font-size: 0.95rem;
	}
	.field input[type='text'],
	.field select,
	.field textarea {
		width: 100%;
		min-height: var(--tap);
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--bg);
	}
	.check {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap);
	}
	.check input {
		width: 22px;
		height: 22px;
		accent-color: var(--accent);
	}
</style>
