<script lang="ts">
	import { t } from '../i18n';
	import type { Lang } from '../registry/types';
	import Icon from './Icon.svelte';

	let {
		lang,
		accept,
		formats,
		maxMB,
		multiple = true,
		onfiles
	}: {
		lang: Lang;
		accept: string;
		formats: string;
		maxMB: number;
		multiple?: boolean;
		onfiles: (files: File[]) => void;
	} = $props();

	let input: HTMLInputElement;
	let over = $state(false);
	let depth = 0;

	function drop(e: DragEvent) {
		e.preventDefault();
		over = false;
		depth = 0;
		const files = [...(e.dataTransfer?.files ?? [])];
		if (files.length) onfiles(multiple ? files : files.slice(0, 1));
	}

	function picked() {
		const files = [...(input.files ?? [])];
		input.value = '';
		if (files.length) onfiles(files);
	}
</script>

<div
	class="zone"
	class:over
	role="region"
	aria-label={t(lang, 'drop.title')}
	ondragenter={(e) => {
		e.preventDefault();
		depth++;
		over = true;
	}}
	ondragover={(e) => e.preventDefault()}
	ondragleave={() => {
		if (--depth <= 0) over = false;
	}}
	ondrop={drop}
>
	<span class="icon"><Icon name="upload" size={30} /></span>
	<p class="title">{t(lang, 'drop.title')}</p>
	<p class="or">{t(lang, 'drop.or')}</p>
	<button class="btn btn-primary" type="button" onclick={() => input.click()}>
		{t(lang, 'drop.pick')}
	</button>
	<p class="hint">{t(lang, 'drop.accepts', { formats, mb: maxMB })}</p>
	<input
		bind:this={input}
		class="visually-hidden"
		type="file"
		tabindex="-1"
		aria-hidden="true"
		{accept}
		{multiple}
		onchange={picked}
		data-testid="file-input"
	/>
</div>

<style>
	.zone {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-8) var(--space-4);
		border: 2px dashed var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		text-align: center;
		transition: border-color 0.15s, background-color 0.15s;
	}
	.zone.over {
		border-color: var(--accent);
		background: var(--accent-soft);
	}
	.icon {
		color: var(--accent);
	}
	.title {
		font-size: 1.15rem;
		font-weight: 700;
	}
	.or,
	.hint {
		color: var(--muted);
		font-size: 0.9rem;
	}
	.hint {
		margin-top: var(--space-2);
	}
</style>
