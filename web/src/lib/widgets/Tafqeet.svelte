<script lang="ts">
	import { t } from '../i18n';
	import { toWesternDigits } from '../office/arabic-text';
	import { CURRENCIES, tafqeet, tafqeetEnglish } from '../office/tafqeet';
	import type { Lang } from '../registry/types';
	import CopyButton from './CopyButton.svelte';

	let { lang }: { lang: Lang } = $props();

	let raw = $state('1500.50');
	let code = $state('EGP');
	let wrap = $state(true);

	const amount = $derived(Number(toWesternDigits(raw).replace(/[,،\s]/g, '').replace('٫', '.')));
	const valid = $derived(Number.isFinite(amount) && amount >= 0 && amount < 1e12 && raw.trim() !== '');
	const currency = $derived(CURRENCIES.find((c) => c.code === code) ?? null);
	const arabic = $derived(valid ? tafqeet(amount, currency, { wrap }) : '');
	const english = $derived(valid ? tafqeetEnglish(amount, currency) : '');
</script>

<div class="w-panel">
	<div class="w-grid">
		<label class="w-field">
			<span>{t(lang, 'w.taf.amount')}</span>
			<input type="text" inputmode="decimal" dir="ltr" bind:value={raw} aria-invalid={!valid} data-testid="taf-amount" />
		</label>
		<label class="w-field">
			<span>{t(lang, 'w.taf.currency')}</span>
			<select bind:value={code}>
				{#each CURRENCIES as c (c.code)}<option value={c.code}>{c.label[lang]}</option>{/each}
				<option value="">{t(lang, 'w.taf.none')}</option>
			</select>
		</label>
		<label class="w-check"><input type="checkbox" bind:checked={wrap} />{t(lang, 'w.taf.wrap')}</label>
	</div>
	{#if !valid}
		<p class="err" role="alert">{t(lang, 'w.taf.invalid')}</p>
	{:else}
		<section aria-labelledby="taf-ar">
			<h2 id="taf-ar" class="label">{t(lang, 'w.taf.arabic')}</h2>
			<p class="w-out" dir="rtl" lang="ar" data-testid="taf-ar">{arabic}</p>
			<div class="w-row"><CopyButton {lang} text={arabic} /></div>
		</section>
		<section aria-labelledby="taf-en">
			<h2 id="taf-en" class="label">{t(lang, 'w.taf.english')}</h2>
			<p class="w-out" dir="ltr" lang="en">{english}</p>
			<div class="w-row"><CopyButton {lang} text={english} /></div>
		</section>
	{/if}
</div>

<style>
	section {
		display: grid;
		gap: var(--space-2);
	}
	.label {
		font-size: 0.95rem;
		color: var(--muted);
	}
	.err {
		color: var(--danger);
	}
</style>
