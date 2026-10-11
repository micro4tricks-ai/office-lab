<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { t } from '../i18n';
	import type { FileData, Lang, PagePlan } from '../registry/types';
	import Icon from './Icon.svelte';

	let {
		lang,
		file,
		preview,
		plan = $bindable()
	}: {
		lang: Lang;
		file: File;
		preview: (file: File, options: Record<string, string | number>) => Promise<FileData[]>;
		plan: PagePlan[] | null;
	} = $props();

	type Card = { key: number; src: number; rotate: number; url: string };
	let cards = $state<Card[]>([]);
	let all: Card[] = [];
	let loading = $state(true);
	let failed = $state(false);
	let dragKey = $state<number | null>(null);
	let live = $state('');

	$effect(() => {
		plan = cards.map((c) => ({ src: c.src, rotate: c.rotate }));
	});

	onMount(async () => {
		try {
			const [, ...thumbs] = await preview(file, { width: 160 });
			all = thumbs.map((f, i) => ({
				key: i,
				src: i,
				rotate: 0,
				url: URL.createObjectURL(new Blob([f.bytes as Uint8Array<ArrayBuffer>], { type: f.type }))
			}));
			cards = [...all];
		} catch {
			failed = true;
		}
		loading = false;
	});
	onDestroy(() => all.forEach((c) => URL.revokeObjectURL(c.url)));

	const label = (c: Card) => t(lang, 'org.page', { n: c.src + 1 });

	function move(i: number, by: number) {
		const j = i + by;
		if (j < 0 || j >= cards.length) return;
		const next = [...cards];
		[next[i], next[j]] = [next[j], next[i]];
		cards = next;
		live = t(lang, 'org.moved', { page: label(next[j]), pos: j + 1 });
	}
	function rotate(i: number, by: number) {
		cards[i].rotate = (((cards[i].rotate + by) % 360) + 360) % 360;
	}
	function remove(i: number) {
		live = t(lang, 'org.removed', { page: label(cards[i]) });
		cards = cards.filter((_, k) => k !== i);
	}
	function reset() {
		cards = all.map((c) => ({ ...c, rotate: 0 }));
	}
	function drop(target: number) {
		if (dragKey === null) return;
		const from = cards.findIndex((c) => c.key === dragKey);
		if (from < 0 || from === target) return;
		const next = [...cards];
		const [c] = next.splice(from, 1);
		next.splice(target, 0, c);
		cards = next;
		dragKey = null;
	}
</script>

<section class="organizer" aria-labelledby="org-title">
	<div class="head">
		<h2 id="org-title">{t(lang, 'org.title')}</h2>
		<button class="btn" type="button" onclick={reset} disabled={loading}>{t(lang, 'org.reset')}</button>
	</div>
	<p class="hint">{t(lang, 'org.hint')}</p>
	<p class="visually-hidden" aria-live="polite">{live}</p>

	{#if loading}
		<p role="status">{t(lang, 'org.loading')}</p>
	{:else if failed}
		<p class="err" role="alert">{t(lang, 'err.corrupted')}</p>
	{:else if !cards.length}
		<p class="err" role="alert">{t(lang, 'org.empty')}</p>
	{/if}

	<ol class="grid">
		{#each cards as c, i (c.key)}
			<li
				class:dragging={dragKey === c.key}
				draggable="true"
				ondragstart={() => (dragKey = c.key)}
				ondragend={() => (dragKey = null)}
				ondragover={(e) => e.preventDefault()}
				ondrop={(e) => {
					e.preventDefault();
					drop(i);
				}}
				data-testid="page-card"
			>
				<div class="thumb">
					<img src={c.url} alt={label(c)} style="transform: rotate({c.rotate}deg)" draggable="false" />
				</div>
				<span class="num">{label(c)}</span>
				<div class="tools">
					<button type="button" onclick={() => move(i, -1)} disabled={i === 0} aria-label={t(lang, 'org.earlier', { page: label(c) })}>
						<Icon name={lang === 'ar' ? 'right' : 'left'} size={18} />
					</button>
					<button type="button" onclick={() => move(i, 1)} disabled={i === cards.length - 1} aria-label={t(lang, 'org.later', { page: label(c) })}>
						<Icon name={lang === 'ar' ? 'left' : 'right'} size={18} />
					</button>
				</div>
				<div class="tools">
					<button type="button" onclick={() => rotate(i, -90)} aria-label={t(lang, 'org.rotateLeft', { page: label(c) })}>
						<Icon name="rotl" size={18} />
					</button>
					<button type="button" onclick={() => rotate(i, 90)} aria-label={t(lang, 'org.rotateRight', { page: label(c) })}>
						<Icon name="rotr" size={18} />
					</button>
					<button type="button" onclick={() => remove(i)} aria-label={t(lang, 'org.delete', { page: label(c) })}>
						<Icon name="x" size={18} />
					</button>
				</div>
			</li>
		{/each}
	</ol>
</section>

<style>
	.organizer {
		display: grid;
		gap: var(--space-3);
		padding: var(--space-4);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-3);
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
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: var(--space-3);
	}
	li {
		display: grid;
		gap: var(--space-1);
		justify-items: center;
		padding: var(--space-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--bg);
		cursor: grab;
	}
	li.dragging {
		opacity: 0.4;
	}
	.thumb {
		width: 120px;
		height: 150px;
		display: grid;
		place-items: center;
		overflow: hidden;
	}
	.thumb img {
		max-width: 110px;
		max-height: 110px;
		box-shadow: 0 1px 4px rgb(0 0 0 / 0.25);
		background: #fff;
		transition: transform 0.2s;
	}
	.num {
		font-size: 0.85rem;
		font-weight: 600;
	}
	.tools {
		display: flex;
		justify-content: center;
	}
	.tools button {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border: 0;
		border-radius: 8px;
		background: transparent;
		color: var(--text);
		cursor: pointer;
	}
	@media (pointer: coarse) {
		.tools button {
			width: var(--tap);
			height: var(--tap);
		}
	}
	.tools button:hover:not(:disabled) {
		background: var(--surface-2);
	}
	.tools button:disabled {
		opacity: 0.3;
		cursor: default;
	}
</style>
