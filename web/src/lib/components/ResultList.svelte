<script lang="ts" module>
	import type { ErrorCode, FileData } from '../registry/types';

	export type Item = {
		id: number;
		file: File;
		status: 'waiting' | 'working' | 'done' | 'error';
		progress: number;
		error?: ErrorCode;
		outputs: FileData[];
	};
</script>

<script lang="ts">
	import { formatSize, t } from '../i18n';
	import type { Lang } from '../registry/types';
	import { downloadFile, downloadZip } from '../download';
	import Icon from './Icon.svelte';
	import ProgressBar from './ProgressBar.svelte';

	let {
		lang,
		items,
		maxMB,
		onremove
	}: { lang: Lang; items: Item[]; maxMB: number; onremove?: (id: number) => void } = $props();

	const outputs = $derived(items.flatMap((i) => i.outputs));
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
			<li class:error={item.status === 'error'}>
				<span class="ficon"><Icon name="file" /></span>
				<div class="info">
					<p class="name" dir="auto">{item.file.name}</p>
					<p class="meta">
						{#if item.status === 'done'}
							{t(lang, 'result.before')}: {formatSize(lang, item.file.size)}
							· {t(lang, 'result.after')}:
							{formatSize(lang, item.outputs.reduce((s, o) => s + o.bytes.byteLength, 0))}
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
					{#each item.outputs as out}
						<button
							class="btn btn-primary"
							type="button"
							onclick={() => downloadFile(out)}
							aria-label="{t(lang, 'result.download')} {out.name}"
						>
							<Icon name="download" />
							{t(lang, 'result.download')}
						</button>
					{/each}
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
	.remove:hover {
		background: var(--surface-2);
		color: var(--text);
	}
</style>
