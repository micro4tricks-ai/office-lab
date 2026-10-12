<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { absolute, BASE, SITE_ORIGIN } from '#lib/seo.ts';

	// Arabic by default; English only if the visitor chose it before.
	onMount(() => {
		let lang: string | null = null;
		try {
			lang = localStorage.getItem('lang');
		} catch {}
		location.replace(resolve('/[lang]', { lang: lang === 'en' ? 'en' : 'ar' }) + '/');
	});
</script>

<svelte:head>
	<title>المعمل · Office Lab</title>
	{#if SITE_ORIGIN}<link rel="canonical" href={absolute(`${BASE}/ar/`)} />{/if}
	<noscript><meta http-equiv="refresh" content="0; url=./ar/" /></noscript>
</svelte:head>

<main style="padding:2rem;text-align:center">
	<a href="./ar/">المعمل — اذهب إلى الموقع</a> · <a href="./en/" lang="en">Office Lab — Go to the site</a>
</main>
