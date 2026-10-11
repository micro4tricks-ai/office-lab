<script lang="ts" module>
	import type { ErrorCode, FileData } from '../registry/types';

	export type Item = {
		id: number;
		file: File;
		status: 'waiting' | 'working' | 'done' | 'error';
		progress: number;
		error?: ErrorCode;
		outputs: FileData[];
		/** Shown instead of the file name (e.g. "3 files" for a combined job). */
		label?: string;
		/** "Before" size when it is not the file's own (combined jobs). */
		inputSize?: number;
	};
</script>

<script lang="ts">
	import { formatSize, t } from '../i18n';
	import type { Lang } from '../registry/types';
	import { downloadFile, downloadZip } from '../download';
	import Icon from './Icon.svelte';
	import ProgressBar from './ProgressBar.svelte';
	import Thumb from './Thumb.svelte';

	let {
		lang,
		items,
		maxMB,
		onremove,
		onmove
	}: {
		lang: Lang;
		items: Item[];
		maxMB: number;
		onremove?: (id: number) => void;
		/** Reorder (combine tools): -1 up, +1 down. */
		onmove?: (id: number, by: -1 | 1) => void;
	} = $props();

	const outputs = $derived(items.flatMap((i) => i.outputs));
	const total = (i: Item) => i.outputs.reduce((s, o) => s + o.bytes.byteLength, 0);
	const before = (i: Item) => i.inputSize ?? i.file.size;
	const preview = (i: Item) => i.outputs.find((o) => o.type.startsWith('image/'));
	/** −42% / +8%, only when one file came out of one file. */
	function change(i: Item) {
		if (i.outputs.length !== 1 || !before(i)) return null;
		const pct = Math.round(((total(i) - before(i)) / before(i)) * 100);
		return pct === 0 ? null : pct;
	}
	const pctText = (lang: Lang, n: number) =>
		new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en', { style: 'percent', signDisplay: 'always' }).format(n / 100);
</script>

<section class="results" aria-labelledby="results-title">
	<div class="head">
		<h2 id="results-title">{t(lang, 'result.title')}</h2>
		{#if outputs.length > 1}
			<button class="btn" type="button" onclick={() => downloadZip(outputs)}>
				<Icon name="download" />
				{t(lang, 'result.downloadAll')}
			</button>
		{/if}
	</div>
	<ul>
		{#each items as item (item.id)}
			<li class:error={item.status === 'error'} data-status={item.status}>
				{#if item.status === 'done' && preview(item)}
					<Thumb file={preview(item)!} />
				{:else}
					<span class="ficon"><Icon name="file" /></span>
				{/if}
				<div class="info">
					<p class="name" dir="auto">{item.label ?? item.file.name}</p>
					<p class="meta">
						{#if item.status === 'done'}
							{t(lang, 'result.before')}: {formatSize(lang, before(item))}
							· {t(lang, 'result.after')}:
							{formatSize(lang, total(item))}
							{#if change(item) !== null}
								<span class="pct" class:down={change(item)! < 0}>(<bdi>{pctText(lang, change(item)!)}</bdi>)</span>
							{/if}
							{#each item.outputs.filter((o) => o.note) as o}
								<span class="note">· {t(lang, `note.${o.note!}`)}</span>
							{/each}
						{:else if item.status === 'error'}
							<span role="alert">{t(lang, `err.${item.error ?? 'unknown'}`, { mb: maxMB })}</span>
						{:else if item.status === 'waiting'}
							{formatSize(lang, item.file.size)} · {t(lang, 'result.waiting')}
						{:else}
							{t(lang, 'tool.converting')}
						{/if}
					</p>
					{#if item.status === 'working'}
						<ProgressBar value={item.progress} label={item.file.name} />
					{/if}
				</div>
				<div class="actions">
					{#if item.outputs.length === 1}
						<button
							class="btn btn-primary"
							type="button"
							onclick={() => downloadFile(item.outputs[0])}
							aria-label="{t(lang, 'result.download')} {item.outputs[0].name}"
						>
							<Icon name="download" />
							{t(lang, 'result.download')}
						</button>
					{/if}
					{#if onmove && item.status === 'waiting'}
						{@const i = items.indexOf(item)}
						<button class="remove" type="button" disabled={i === 0} onclick={() => onmove(item.id, -1)} aria-label={t(lang, 'drop.up', { name: item.file.name })}>
							<Icon name="up" />
						</button>
						<button class="remove" type="button" disabled={i === items.length - 1} onclick={() => onmove(item.id, 1)} aria-label={t(lang, 'drop.down', { name: item.file.name })}>
							<Icon name="down" />
						</button>
					{/if}
					{#if onremove && item.status !== 'working'}
						<button
							class="remove"
							type="button"
							onclick={() => onremove(item.id)}
							aria-label={t(lang, 'drop.remove', { name: item.file.name })}
						>
							<Icon name="x" />
						</button>
					{/if}
				</div>
				{#if item.outputs.length > 1}
					<ul class="files">
						{#each item.outputs as out (out.name)}
							<li>
								<button type="button" onclick={() => downloadFile(out)} aria-label="{t(lang, 'result.download')} {out.name}">
									<Icon name="download" size={16} />
									<span dir="ltr">{out.name}</span>
									<span class="size">{formatSize(lang, out.bytes.byteLength)}</span>
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</li>
		{/each}
	</ul>
</section>

<style>
	.results {
		display: grid;
		gap: var(--space-3);
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		flex-wrap: wrap;
	}
	h2 {
		font-size: 1.15rem;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--space-2);
	}
	li {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		flex-wrap: wrap;
	}
	li.error {
		border-color: var(--danger);
		background: var(--danger-soft);
	}
	.ficon {
		color: var(--muted);
		display: flex;
	}
	.info {
		flex: 1 1 12rem;
		min-width: 0;
		display: grid;
		gap: var(--space-1);
	}
	.name {
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	.meta {
		font-size: 0.875rem;
		color: var(--muted);
	}
	li.error .meta {
		color: var(--danger);
	}
	.actions {
		display: flex;
		gap: var(--space-2);
		align-items: center;
	}
	.pct {
		font-weight: 700;
	}
	.pct.down {
		color: var(--ok);
	}
	.note {
		color: var(--accent-strong);
	}
	.files {
		flex-basis: 100%;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.files li {
		display: contents;
	}
	.files button {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap);
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--bg);
		color: var(--text);
		font-size: 0.85rem;
		cursor: pointer;
	}
	.files button:hover {
		border-color: var(--accent);
	}
	.files .size {
		color: var(--muted);
	}
	.remove {
		display: grid;
		place-items: center;
		width: var(--tap);
		height: var(--tap);
		border-radius: 999px;
		border: 0;
		background: transparent;
		color: var(--muted);
		cursor: pointer;
	}
	.remove:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.remove:hover:not(:disabled) {
		background: var(--surface-2);
		color: var(--text);
	}
</style>
