<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import Header from '#lib/components/Header.svelte';
	import { REPO_URL } from '#lib/config.ts';
	import { t } from '#lib/i18n/index.ts';
	import { keepOfflineCurrent } from '#lib/offline.ts';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
	const lang = $derived(data.lang);

	onMount(keepOfflineCurrent);

	// Keep <html lang/dir> right after client-side language switches.
	$effect(() => {
		document.documentElement.lang = lang;
		document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
	});
</script>

<Header {lang} />
<main id="main" tabindex="-1">
	{@render children()}
</main>
<footer>
	<div class="container">
		<p>
			{t(lang, 'app.name')} · {t(lang, 'footer.oss')} (AGPL-3.0) ·
			<a href={REPO_URL} rel="noopener">{t(lang, 'footer.source')}</a>
		</p>
		<p class="links">
			<a href={resolve('/[lang]/pipelines', { lang }) + '/'}>{t(lang, 'footer.pipelines')}</a>
			<a href={resolve('/[lang]/about', { lang }) + '/'}>{t(lang, 'footer.about')}</a>
			<a href={resolve('/[lang]/privacy', { lang }) + '/'}>{t(lang, 'footer.privacy')}</a>
		</p>
	</div>
</footer>

<style>
	main {
		outline: none;
		min-height: calc(100vh - 140px);
	}
	footer {
		border-top: 1px solid var(--border);
		padding: var(--space-6) 0;
		color: var(--muted);
		font-size: 0.9rem;
	}
	footer .container {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-2) var(--space-6);
	}
	footer a {
		display: inline-block;
		padding-block: var(--space-2);
	}
	.links {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-6);
	}
</style>
