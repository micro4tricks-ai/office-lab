<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import Icon from '#lib/components/Icon.svelte';
	import Seo from '#lib/components/Seo.svelte';
	import { absolute, BASE as base } from '#lib/seo.ts';
	import ToolRunner from '#lib/components/ToolRunner.svelte';
	import { serverCapabilities } from '#lib/config.ts';
	import { t } from '#lib/i18n/index.ts';
	import { toolById } from '#lib/registry/tools.ts';
	import { widgets } from '#lib/widgets/index.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const lang = $derived(data.lang);
	const tool = $derived(toolById(data.toolId)!);
	const text = $derived(tool.i18n[lang]);

	let serverOk = $state(false);
	onMount(async () => {
		serverOk = (await serverCapabilities()).has(tool.id);
	});
	const usable = $derived(tool.runtime === 'browser' || serverOk);
</script>

<Seo
	{lang}
	title="{text.title} — {t(lang, 'app.name')}"
	desc={text.desc}
	path="{tool.id}/"
	image={tool.category}
	data={[
		{
			'@context': 'https://schema.org',
			'@type': 'WebApplication',
			name: text.title,
			description: text.desc,
			url: absolute(`${base}/${lang}/${tool.id}/`),
			inLanguage: lang,
			applicationCategory: 'UtilitiesApplication',
			operatingSystem: 'Any (web browser)',
			isAccessibleForFree: true,
			offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
		},
		{
			'@context': 'https://schema.org',
			'@type': 'BreadcrumbList',
			itemListElement: [
				{ '@type': 'ListItem', position: 1, name: t(lang, 'nav.home'), item: absolute(`${base}/${lang}/`) },
				{ '@type': 'ListItem', position: 2, name: text.title, item: absolute(`${base}/${lang}/${tool.id}/`) }
			]
		}
	]}
/>
<svelte:head>
	<meta name="keywords" content={text.keywords.join(', ')} />
</svelte:head>

<div class="container page" class:wide={tool.widget === 'markdown' || tool.widget === 'invoice'}>
	<nav class="crumbs" aria-label={t(lang, 'nav.home')}>
		<a href={resolve('/[lang]', { lang }) + '/'}>{t(lang, 'nav.home')}</a>
		<span aria-hidden="true">/</span>
		<span>{t(lang, `cat.${tool.category}`)}</span>
	</nav>

	<header class="head">
		<h1>{text.title}</h1>
		<p class="desc">{text.desc}</p>
		{#if tool.runtime === 'browser'}
			<p class="badge"><Icon name="shield" size={16} />{t(lang, 'tool.privacy')}</p>
		{/if}
	</header>

	{#if !usable}
		<p class="server-note" role="note">
			<Icon name="server" />{t(lang, 'tool.serverOnly')}
		</p>
	{:else if tool.widget && widgets[tool.widget]}
		{#key tool.id}
			{#await widgets[tool.widget]!() then mod}
				<mod.default {lang} {tool} />
			{/await}
		{/key}
	{:else}
		{#key tool.id}
			<ToolRunner {tool} {lang} />
		{/key}
	{/if}
</div>

<style>
	.page {
		max-width: 68rem;
		padding-block: var(--space-6) var(--space-12);
		display: grid;
		gap: var(--space-6);
	}
	.page.wide {
		max-width: var(--maxw);
	}
	.crumbs {
		display: flex;
		gap: var(--space-2);
		font-size: 0.9rem;
		color: var(--muted);
	}
	.crumbs a {
		display: inline-block;
		padding-block: var(--space-2);
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
	.desc {
		color: var(--muted);
		font-size: 1.05rem;
	}
	.head .badge {
		margin-top: var(--space-2);
		padding: 0.25rem 0.8rem;
	}
	.server-note {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		padding: var(--space-4);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
</style>
