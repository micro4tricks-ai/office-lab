<script lang="ts">
	import Seo from '#lib/components/Seo.svelte';
	import { REPO_URL } from '#lib/config.ts';
	import { t } from '#lib/i18n/index.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const lang = $derived(data.lang);
	const sections = ['browser', 'server', 'translate', 'storage', 'offline'] as const;
</script>

<Seo {lang} title="{t(lang, 'privacy.title')} — {t(lang, 'app.name')}" desc={t(lang, 'privacy.desc')} path="privacy/" />

<article class="container prose">
	<h1>{t(lang, 'privacy.title')}</h1>
	<p class="lead">{t(lang, 'privacy.lead')}</p>
	{#each sections as s (s)}
		<h2>{t(lang, `privacy.${s}.h`)}</h2>
		<p>{t(lang, `privacy.${s}.p`)}</p>
	{/each}
	<h2>{t(lang, 'privacy.source.h')}</h2>
	<p>{t(lang, 'privacy.source.p')} <a href={REPO_URL} rel="noopener">{t(lang, 'about.source')}</a></p>
</article>
