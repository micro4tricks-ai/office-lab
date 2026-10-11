<script lang="ts">
	import { t } from '../i18n';
	import { toWesternDigits } from '../office/arabic-text';
	import { CURRENCIES, tafqeet } from '../office/tafqeet';
	import type { Lang } from '../registry/types';
	import CopyButton from './CopyButton.svelte';

	let { lang }: { lang: Lang } = $props();

	const PRESETS = [
		{ id: 'eg', rate: 14, currency: 'EGP' },
		{ id: 'sa', rate: 15, currency: 'SAR' },
		{ id: 'ae', rate: 5, currency: 'AED' }
	] as const;
	let raw = $state('1000');
	let rate = $state(14);
	let mode = $state<'add' | 'remove'>('add');
	let code = $state('EGP');

	const amount = $derived(Number(toWesternDigits(raw).replace(/[,،\s]/g, '')));
	const valid = $derived(Number.isFinite(amount) && amount >= 0 && raw.trim() !== '');
	const round = (n: number) => Math.round(n * 100) / 100;
	const net = $derived(mode === 'add' ? amount : amount / (1 + rate / 100));
	const vat = $derived(net * (rate / 100));
	const total = $derived(net + vat);
	const money = (n: number) =>
		new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(round(n));
	const words = $derived(valid ? tafqeet(round(total), CURRENCIES.find((c) => c.code === code) ?? null) : '');
</script>

<div class="w-panel">
	<div class="w-row" role="group" aria-label={t(lang, 'w.vat.presets')}>
		{#each PRESETS as p (p.id)}
			<button class="btn" type="button" aria-pressed={rate === p.rate && code === p.currency} onclick={() => ((rate = p.rate), (code = p.currency))}>
				{t(lang, `w.vat.${p.id}`)} — {p.rate}%
			</button>
		{/each}
	</div>
	<div class="w-grid">
		<label class="w-field"><span>{t(lang, 'w.vat.amount')}</span><input type="text" inputmode="decimal" dir="ltr" bind:value={raw} data-testid="vat-amount" /></label>
		<label class="w-field"><span>{t(lang, 'w.vat.rate')}</span><input type="number" min="0" max="100" step="0.5" bind:value={rate} /></label>
		<label class="w-field">
			<span>{t(lang, 'w.vat.mode')}</span>
			<select bind:value={mode} data-testid="vat-mode">
				<option value="add">{t(lang, 'w.vat.add')}</option>
				<option value="remove">{t(lang, 'w.vat.remove')}</option>
			</select>
		</label>
	</div>
	{#if valid}
		<dl class="table">
			<dt>{t(lang, 'w.vat.net')}</dt><dd data-testid="vat-net">{money(net)}</dd>
			<dt>{t(lang, 'w.vat.vat')} ({rate}%)</dt><dd data-testid="vat-vat">{money(vat)}</dd>
			<dt>{t(lang, 'w.vat.total')}</dt><dd class="total" data-testid="vat-total">{money(total)}</dd>
		</dl>
		<p class="w-out" dir="rtl" lang="ar">{words}</p>
		<div class="w-row"><CopyButton {lang} text={words} /></div>
	{/if}
</div>

<style>
	.btn[aria-pressed='true'] {
		border-color: var(--accent);
		background: var(--accent-soft);
	}
	.table {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-2) var(--space-6);
		margin: 0;
		font-size: 1.05rem;
	}
	dt {
		color: var(--muted);
	}
	dd {
		margin: 0;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.total {
		color: var(--accent-strong);
		font-size: 1.25rem;
	}
</style>
