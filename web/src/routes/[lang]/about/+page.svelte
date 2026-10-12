<script lang="ts">
	import { resolve } from '$app/paths';
	import OfflineReady from '#lib/components/OfflineReady.svelte';
	import Seo from '#lib/components/Seo.svelte';
	import { REPO_URL } from '#lib/config.ts';
	import { t } from '#lib/i18n/index.ts';
	import { tools } from '#lib/registry/tools.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const lang = $derived(data.lang);
	const server = tools.filter((x) => x.runtime === 'server').length;
	/** Roughly what "all tools offline" downloads (build files + PDF/OCR engines; measured 2026-10). */
	const OFFLINE_MB = 55;
	const n = (v: number) => v.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en');
</script>

<Seo {lang} title="{t(lang, 'about.title')} — {t(lang, 'app.name')}" desc={t(lang, 'about.desc')} path="about/" />

<article class="container prose">
	<h1>{t(lang, 'about.title')}</h1>
	<p class="lead">{t(lang, 'about.lead')}</p>
	<p>{t(lang, 'about.counts', { all: n(tools.length), local: n(tools.length - server), server: n(server) })}</p>

	<h2>{t(lang, 'about.why.h')}</h2>
	<ul>
		<li>{t(lang, 'about.why.1')}</li>
		<li>{t(lang, 'about.why.2')}</li>
		<li>{t(lang, 'about.why.3')}</li>
	</ul>

	<h2>{t(lang, 'about.install.h')}</h2>
	<p>{t(lang, 'about.install.p')}</p>

	<h2>{t(lang, 'about.offline.h')}</h2>
	<p>{t(lang, 'about.offline.p', { mb: n(OFFLINE_MB) })}</p>
	<OfflineReady {lang} />

	<h2>{t(lang, 'about.credits.h')}</h2>
	<p>{t(lang, 'about.credits.p')}</p>
	<p><a href={REPO_URL} rel="noopener">{t(lang, 'about.source')}</a> · <a href={resolve('/[lang]/privacy', { lang }) + '/'}>{t(lang, 'privacy.title')}</a></p>
</article>
