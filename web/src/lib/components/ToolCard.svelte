<script lang="ts">
	import { resolve } from '$app/paths';
	import { t } from '../i18n';
	import type { Lang, Tool } from '../registry/types';
	import Icon from './Icon.svelte';

	let { tool, lang, available }: { tool: Tool; lang: Lang; available: boolean } = $props();

	const fmt = (list: string[]) =>
		list.filter((f) => !f.includes('/')).map((f) => f.toUpperCase()).join(' · ');
</script>

<a class="card" href={resolve('/[lang]/[tool]', { lang, tool: tool.id }) + '/'}>
	<span class="icon"><Icon name={tool.category} size={22} /></span>
	<h3>{tool.i18n[lang].title}</h3>
	<p class="desc">{tool.i18n[lang].desc}</p>
	<p class="formats" dir="ltr">
		{fmt(tool.from)}{#if tool.to.length}<span class="arrow" aria-hidden="true">→</span>{fmt(tool.to)}{/if}
	</p>
	{#if tool.runtime === 'server'}
		{#if !available}
			<span class="badge badge-muted"><Icon name="server" size={14} />{t(lang, 'badge.server')}</span>
		{/if}
	{:else}
		<span class="badge"><Icon name="shield" size={14} />{t(lang, 'badge.local')}</span>
	{/if}
</a>

<style>
	.card {
		display: grid;
		align-content: start;
		justify-items: start;
		gap: var(--space-2);
		height: 100%;
		padding: var(--space-4);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		color: var(--text);
		text-decoration: none;
		transition: border-color 0.15s, transform 0.15s;
	}
	.card:hover {
		border-color: var(--accent);
		transform: translateY(-2px);
	}
	.icon {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 11px;
		background: var(--accent-soft);
		color: var(--accent-strong);
	}
	h3 {
		font-size: 1.05rem;
	}
	.desc {
		color: var(--muted);
		font-size: 0.9rem;
	}
	.formats {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--muted);
		letter-spacing: 0.02em;
	}
	.arrow {
		margin-inline: 0.4em;
	}
</style>
