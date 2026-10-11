<script lang="ts">
	import { page } from '$app/state';
	import Header from '#lib/components/Header.svelte';
	import { REPO_URL } from '#lib/config.ts';
	import { t } from '#lib/i18n/index.ts';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
	const lang = $derived(data.lang);

	// Keep <html lang/dir> right after client-side language switches.
	$effect(() => {
		document.documentElement.lang = lang;
		document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
	});

	const alt = (l: string) => page.url.pathname.replace(/\/(ar|en)(\/|$)/, `/${l}$2`);
</script>

<svelte:head>
	<link rel="alternate" hreflang="ar" href={alt('ar')} />
	<link rel="alternate" hreflang="en" href={alt('en')} />
</svelte:head>

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
	footer a {
		display: inline-block;
		padding-block: var(--space-2);
	}
</style>
