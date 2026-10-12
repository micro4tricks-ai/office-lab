<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { t } from '../i18n';
	import { install, promptInstall } from '../install.svelte';
	import type { Lang } from '../registry/types';
	import Icon from './Icon.svelte';

	let { lang }: { lang: Lang } = $props();

	const other = $derived<Lang>(lang === 'ar' ? 'en' : 'ar');
	const otherHref = $derived(page.url.pathname.replace(/\/(ar|en)(\/|$)/, `/${other}$2`));

	let dark = $state(false);

	onMount(() => {
		let saved: string | null = null;
		try {
			saved = localStorage.getItem('theme');
		} catch {}
		dark = saved ? saved === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
		if (saved) document.documentElement.dataset.theme = saved;
	});

	function toggleTheme() {
		dark = !dark;
		const theme = dark ? 'dark' : 'light';
		document.documentElement.dataset.theme = theme;
		try {
			localStorage.setItem('theme', theme);
		} catch {}
	}

	function rememberLang() {
		try {
			localStorage.setItem('lang', other);
		} catch {}
	}
</script>

<a class="skip" href="#main">{t(lang, 'nav.skip')}</a>
<header>
	<div class="container bar">
		<a class="brand" href={resolve('/[lang]', { lang }) + '/'} aria-label={t(lang, 'nav.home')}>
			<span class="logo"><Icon name="flask" size={22} /></span>
			<span>{t(lang, 'app.name')}</span>
		</a>
		<nav class="actions">
			<a
				class="icon-btn lang"
				href={otherHref}
				hreflang={other}
				lang={other}
				aria-label={t(lang, 'nav.langLabel')}
				onclick={rememberLang}
				data-sveltekit-noscroll
			>
				<Icon name="globe" />
				<span>{t(lang, 'nav.lang')}</span>
			</a>
			{#if install.offer}
				<button class="icon-btn lang" type="button" onclick={promptInstall} aria-label={t(lang, 'install.label')}>
					<Icon name="download" />
					<span>{t(lang, 'install.btn')}</span>
				</button>
			{/if}
			<button
				class="icon-btn"
				type="button"
				onclick={toggleTheme}
				aria-label={t(lang, dark ? 'theme.toLight' : 'theme.toDark')}
				title={t(lang, dark ? 'theme.toLight' : 'theme.toDark')}
			>
				<Icon name={dark ? 'sun' : 'moon'} />
			</button>
		</nav>
	</div>
</header>

<style>
	.skip {
		position: absolute;
		inset-inline-start: var(--space-4);
		top: -4rem;
		z-index: 10;
		padding: var(--space-2) var(--space-4);
		background: var(--accent);
		color: var(--on-accent);
		border-radius: var(--radius-sm);
	}
	.skip:focus {
		top: var(--space-2);
	}
	header {
		border-bottom: 1px solid var(--border);
		background: var(--surface);
	}
	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		min-height: 64px;
	}
	.brand {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		font-weight: 800;
		font-size: 1.25rem;
		color: var(--text);
		text-decoration: none;
		min-height: var(--tap);
	}
	.logo {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border-radius: 10px;
		background: var(--accent);
		color: var(--on-accent);
	}
	.actions {
		display: flex;
		gap: var(--space-2);
	}
	.icon-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		min-width: var(--tap);
		min-height: var(--tap);
		padding: 0 var(--space-3);
		border-radius: 999px;
		border: 1px solid var(--border);
		background: transparent;
		color: var(--text);
		text-decoration: none;
		cursor: pointer;
		font-weight: 600;
		font-size: 0.95rem;
	}
	.icon-btn:hover {
		border-color: var(--accent);
	}
	@media (max-width: 420px) {
		.lang span {
			display: none;
		}
	}
</style>
