<script lang="ts">
	import { t } from '../i18n';
	import { LANGS, type Lang } from '../registry/types';
	import { absolute, BASE as base, jsonLd, OG_LOCALE, SITE_ORIGIN } from '../seo';

	/**
	 * Title, description, canonical + hreflang links, Open Graph / Twitter card and JSON-LD.
	 * `path` is what comes after /{lang}/ ('' for home, 'merge-pdf/' for a tool).
	 * `image` names the Open Graph picture: static/og/{image}-{lang}.jpg.
	 */
	let {
		lang,
		title,
		desc,
		path,
		image = 'home',
		data
	}: { lang: Lang; title: string; desc: string; path: string; image?: string; data?: object } = $props();

	const url = (l: Lang) => absolute(`${base}/${l}/${path}`);
	const ogImage = $derived(absolute(`${base}/og/${image}-${lang}.jpg`));
	const ld = $derived(data ? `<script type="application/ld+json">${jsonLd(data)}</` + 'script>' : '');
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={desc} />
	{#if SITE_ORIGIN}<link rel="canonical" href={url(lang)} />{/if}
	{#each LANGS as l (l)}
		<link rel="alternate" hreflang={l} href={url(l)} />
	{/each}
	<link rel="alternate" hreflang="x-default" href={url('ar')} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={t(lang, 'app.name')} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={desc} />
	<meta property="og:locale" content={OG_LOCALE[lang]} />
	<meta property="og:locale:alternate" content={OG_LOCALE[lang === 'ar' ? 'en' : 'ar']} />
	{#if SITE_ORIGIN}
		<meta property="og:url" content={url(lang)} />
		<meta property="og:image" content={ogImage} />
		<meta property="og:image:width" content="1200" />
		<meta property="og:image:height" content="630" />
		<meta name="twitter:card" content="summary_large_image" />
		<meta name="twitter:image" content={ogImage} />
	{/if}
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- JSON-LD built from our own registry, '<' escaped -->
	{@html ld}
</svelte:head>
