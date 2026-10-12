<script lang="ts">
	import { t } from '../i18n';
	import type { FileData, Lang, OptionSpec, Options } from '../registry/types';
	import { prepare } from '../workers/prepare';

	/**
	 * The options of one tool (or one step of a chain). `specs` are the options to show (already
	 * filtered by `when`); `missing` marks a required one left empty; `prefix` keeps ids unique
	 * when several forms share a page.
	 */
	let {
		lang,
		specs,
		options = $bindable(),
		missing = null,
		disabled = false,
		legend,
		prefix = 'opt-'
	}: {
		lang: Lang;
		specs: OptionSpec[];
		options: Options;
		missing?: string | null;
		disabled?: boolean;
		legend: string;
		prefix?: string;
	} = $props();

	async function pickImage(id: string, e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		options[id] = file ? ((await prepare(file)) as FileData) : null;
	}
</script>

<fieldset class="options" {disabled}>
	<legend>{legend}</legend>
	{#each specs as opt (opt.id)}
		<div class="field" class:wide={opt.type === 'range' || opt.type === 'text'}>
			{#if opt.type === 'checkbox'}
				<label class="check">
					<input id="{prefix}{opt.id}" type="checkbox" bind:checked={options[opt.id] as boolean} />
					<span>{opt.label[lang]}</span>
				</label>
			{:else}
				<label for="{prefix}{opt.id}">
					{opt.label[lang]}
					{#if opt.type === 'range'}
						<output for="{prefix}{opt.id}" dir="ltr">{options[opt.id]}{opt.unit ?? ''}</output>
					{/if}
				</label>
				{#if opt.type === 'select'}
					<select id="{prefix}{opt.id}" bind:value={options[opt.id]}>
						{#each opt.choices as c (c.value)}
							<option value={c.value}>{c.label[lang]}</option>
						{/each}
					</select>
				{:else if opt.type === 'text'}
					<input
						id="{prefix}{opt.id}"
						type={opt.secret ? 'password' : 'text'}
						dir="auto"
						autocomplete={opt.secret ? 'off' : undefined}
						placeholder={opt.placeholder?.[lang]}
						aria-invalid={missing === opt.id}
						aria-describedby={missing === opt.id ? `${prefix}err-${opt.id}` : undefined}
						bind:value={options[opt.id]}
					/>
					{#if missing === opt.id}
						<span id="{prefix}err-{opt.id}" class="err" role="alert">{t(lang, 'tool.needValue')}</span>
					{/if}
				{:else if opt.type === 'color'}
					<input id="{prefix}{opt.id}" type="color" bind:value={options[opt.id]} />
				{:else if opt.type === 'image'}
					<input
						id="{prefix}{opt.id}"
						type="file"
						accept={opt.accept ?? 'image/*'}
						aria-invalid={missing === opt.id}
						aria-describedby={missing === opt.id ? `${prefix}err-${opt.id}` : undefined}
						onchange={(e) => pickImage(opt.id, e)}
					/>
					{#if missing === opt.id}
						<span id="{prefix}err-{opt.id}" class="err" role="alert">{t(lang, opt.accept ? 'tool.needFile' : 'tool.needImage')}</span>
					{/if}
				{:else if opt.type === 'range'}
					<input
						id="{prefix}{opt.id}"
						type="range"
						min={opt.min}
						max={opt.max}
						step={opt.step ?? 1}
						bind:value={options[opt.id]}
					/>
				{:else}
					<span class="with-unit" dir="ltr">
						<input
							id="{prefix}{opt.id}"
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

<style>
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
</style>
