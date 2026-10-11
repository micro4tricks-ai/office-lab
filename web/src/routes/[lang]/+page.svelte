<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '#lib/components/Icon.svelte';
	import ToolCard from '#lib/components/ToolCard.svelte';
	import { serverCapabilities } from '#lib/config.ts';
	import { t } from '#lib/i18n/index.ts';
	import { tools } from '#lib/registry/tools.ts';
	import { CATEGORIES, type Category } from '#lib/registry/types.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const lang = $derived(data.lang);

	let query = $state('');
	let active = $state<Category | 'all'>('all');
	let caps = $state(new Set<string>());

	onMount(async () => {
		caps = await serverCapabilities();
	});

	const used = CATEGORIES.filter((c) => tools.some((t) => t.category === c));

	const norm = (s: string) => s.toLowerCase().replace(/[ً-ْ]/g, '').trim();

	const visible = $derived.by(() => {
		const q = norm(query);
		return tools.filter((tool) => {
			if (active !== 'all' && tool.category !== active) return false;
			if (!q) return true;
			const { title, desc, keywords } = tool.i18n[lang];
			const hay = norm([tool.id, title, desc, ...keywords, ...tool.from, ...tool.to].join(' '));
			return q.split(/\s+/).every((w) => hay.includes(w));
		});
	});

	const groups = $derived(
		used
			.map((c) => ({ c, list: visible.filter((t) => t.category === c) }))
			.filter((g) => g.list.length)
	);
</script>

<svelte:head>
	<title>{t(lang, 'app.name')} — {t(lang, 'app.tagline')}</title>
	<meta name="description" content={t(lang, 'app.description')} />
</svelte:head>

<section class="hero">
	<div class="container">
		<h1>{t(lang, 'app.name')}</h1>
		<p class="tagline">{t(lang, 'app.tagline')}</p>
		<div class="search">
			<label class="visually-hidden" for="q">{t(lang, 'search.label')}</label>
			<span class="search-icon"><Icon name="search" /></span>
			<input
				id="q"
				type="search"
				bind:value={query}
				placeholder={t(lang, 'search.placeholder')}
				autocomplete="off"
			/>
		</div>
	</div>
</section>

<div class="container body">
	{#if used.length > 1}
		<div class="chips" role="group" aria-label={t(lang, 'search.label')}>
			<button type="button" aria-pressed={active === 'all'} onclick={() => (active = 'all')}>
				{t(lang, 'cat.all')}
			</button>
			{#each used as c (c)}
				<button type="button" aria-pressed={active === c} onclick={() => (active = c)}>
					<Icon name={c} size={18} />
					{t(lang, `cat.${c}`)}
				</button>
			{/each}
		</div>
	{/if}

	{#each groups as g (g.c)}
		<section class="group" aria-labelledby="cat-{g.c}">
			<h2 id="cat-{g.c}"><Icon name={g.c} />{t(lang, `cat.${g.c}`)}</h2>
			<ul class="grid">
				{#each g.list as tool (tool.id)}
					<li>
						<ToolCard {tool} {lang} available={tool.runtime === 'browser' || caps.has(tool.id)} />
					</li>
				{/each}
			</ul>
		</section>
	{:else}
		<p class="none" role="status">{t(lang, 'search.none')}</p>
	{/each}
</div>

<style>
	.hero {
		background: var(--surface);
		border-bottom: 1px solid var(--border);
		padding: var(--space-12) 0 var(--space-8);
		text-align: center;
	}
	h1 {
		font-size: clamp(2rem, 6vw, 3rem);
		font-weight: 800;
		color: var(--accent-strong);
	}
	.tagline {
		margin-top: var(--space-2);
		color: var(--muted);
		font-size: clamp(1rem, 2.5vw, 1.2rem);
	}
	.search {
		position: relative;
		max-width: 36rem;
		margin: var(--space-6) auto 0;
	}
	.search-icon {
		position: absolute;
		inset-inline-start: var(--space-4);
		top: 50%;
		transform: translateY(-50%);
		color: var(--muted);
		display: flex;
		pointer-events: none;
	}
	.search input {
		width: 100%;
		min-height: 52px;
		padding-inline: calc(var(--space-4) * 2 + 20px) var(--space-4);
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--bg);
		font-size: 1.05rem;
	}
	.search input:focus-visible {
		border-color: var(--accent);
	}
	.body {
		padding-block: var(--space-8) var(--space-12);
		display: grid;
		gap: var(--space-8);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.chips button {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap);
		padding: 0 var(--space-4);
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--surface);
		cursor: pointer;
		font-weight: 600;
	}
	.chips button[aria-pressed='true'] {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--on-accent);
	}
	.group h2 {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: 1.2rem;
		margin-bottom: var(--space-4);
	}
	.grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr));
		gap: var(--space-4);
	}
	.none {
		text-align: center;
		color: var(--muted);
		padding: var(--space-8) 0;
	}
</style>
