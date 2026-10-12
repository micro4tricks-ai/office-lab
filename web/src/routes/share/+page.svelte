<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';

	// The Share menu lands here (via the service worker): continue in the visitor's language.
	onMount(() => {
		let lang: string | null = null;
		try {
			lang = localStorage.getItem('lang');
		} catch {}
		location.replace(resolve('/[lang]/share', { lang: lang === 'en' ? 'en' : 'ar' }) + '/');
	});
</script>

<svelte:head>
	<title>المعمل · Office Lab</title>
	<meta name="robots" content="noindex" />
</svelte:head>
