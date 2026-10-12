<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import ToolCard from '#lib/components/ToolCard.svelte';
	import { serverCapabilities } from '#lib/config.ts';
	import { handOff } from '#lib/handoff.ts';
	import { formatSize, t } from '#lib/i18n/index.ts';
	import { clearInbox, readInbox } from '#lib/share.ts';
	import { tools } from '#lib/registry/tools.ts';
	import type { Tool } from '#lib/registry/types.ts';
	import { validate } from '#lib/workers/runner.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const lang = $derived(data.lang);

	let files = $state<File[] | null>(null);
	let caps = $state(new Set<string>());

	onMount(async () => {
		[files, caps] = await Promise.all([readInbox(), serverCapabilities()]);
	});

	const fits = (tool: Tool, list: File[]) =>
		!tool.widget &&
		(tool.runtime === 'browser' || caps.has(tool.id)) &&
		(list.length === 1 || tool.batch || !!tool.combine) &&
		list.every((f) => !validate(tool, f));
	const matches = $derived(files?.length ? tools.filter((tool) => fits(tool, files!)) : []);

	function pick() {
		handOff(files ?? []);
		clearInbox();
	}
</script>

<svelte:head>
	<title>{t(lang, 'share.title')} — {t(lang, 'app.name')}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="container page">
	<h1>{t(lang, 'share.title')}</h1>
	{#if files === null}
		<p class="muted">…</p>
	{:else if !files.length}
		<p>{t(lang, 'share.none')}</p>
		<p><a class="btn" href={resolve('/[lang]', { lang }) + '/'}>{t(lang, 'nav.home')}</a></p>
	{:else}
		<ul class="files" data-testid="shared-files">
			{#each files as f, i (i)}
				<li><span dir="auto">{f.name}</span> <span class="muted">{formatSize(lang, f.size)}</span></li>
			{/each}
		</ul>
		<h2>{t(lang, matches.length ? 'share.pick' : 'share.noTool')}</h2>
		<p><a href={resolve('/[lang]/pipelines', { lang }) + '/'} onclick={pick}>{t(lang, 'share.chain')}</a></p>
		<div class="grid">
			{#each matches as tool (tool.id)}
				<ToolCard {tool} {lang} available onpick={pick} />
			{/each}
		</div>
	{/if}
</div>

<style>
	.page {
		padding-block: var(--space-8) var(--space-12);
		display: grid;
		gap: var(--space-4);
	}
	h1 {
		font-size: clamp(1.6rem, 5vw, 2.2rem);
		font-weight: 800;
	}
	h2 {
		font-size: 1.2rem;
		margin-top: var(--space-4);
	}
	.files {
		list-style: none;
		margin: 0;
		padding: var(--space-4);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		display: grid;
		gap: var(--space-2);
	}
	.files li {
		display: flex;
		justify-content: space-between;
		gap: var(--space-4);
		overflow-wrap: anywhere;
	}
	.muted {
		color: var(--muted);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr));
		gap: var(--space-4);
	}
</style>
