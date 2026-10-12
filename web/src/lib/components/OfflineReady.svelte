<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from '../i18n';
	import { cacheAll, offlineChosen, offlineSupported } from '../offline';
	import type { Lang } from '../registry/types';
	import ProgressBar from './ProgressBar.svelte';

	let { lang }: { lang: Lang } = $props();

	let phase = $state<'idle' | 'busy' | 'done' | 'fail' | 'none'>('idle');
	let ratio = $state(0);

	onMount(() => {
		if (!offlineSupported()) phase = 'none';
		else if (offlineChosen()) phase = 'done';
	});

	async function run() {
		phase = 'busy';
		ratio = 0;
		try {
			const { failed } = await cacheAll((p) => (ratio = p.total ? p.done / p.total : 0));
			phase = failed ? 'fail' : 'done';
		} catch {
			phase = 'fail';
		}
	}
</script>

<div class="offline" data-testid="offline-ready">
	{#if phase === 'none'}
		<p>{t(lang, 'about.offline.none')}</p>
	{:else if phase === 'busy'}
		<p role="status">{t(lang, 'about.offline.busy', { pct: Math.round(ratio * 100) })}</p>
		<ProgressBar value={ratio} label={t(lang, 'about.offline.btn')} />
	{:else}
		{#if phase === 'done'}<p role="status" class="ok">{t(lang, 'about.offline.done')}</p>{/if}
		{#if phase === 'fail'}<p role="alert" class="err">{t(lang, 'about.offline.fail')}</p>{/if}
		{#if phase !== 'done'}
			<p><button class="btn btn-primary" type="button" onclick={run}>{t(lang, 'about.offline.btn')}</button></p>
		{/if}
	{/if}
</div>

<style>
	.offline {
		display: grid;
		gap: var(--space-3);
	}
	.ok {
		color: var(--accent-strong);
		font-weight: 600;
	}
	.err {
		color: var(--danger);
	}
</style>
