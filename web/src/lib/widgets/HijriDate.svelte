<script lang="ts">
	import { t } from '../i18n';
	import { gregorianLong, gregorianToHijri, hijriLong, hijriToGregorian } from '../office/hijri';
	import type { Lang } from '../registry/types';

	let { lang }: { lang: Lang } = $props();

	const today = new Date();
	const todayUtc = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
	const h0 = gregorianToHijri(todayUtc);

	let greg = $state(todayUtc.toISOString().slice(0, 10));
	let hy = $state(h0.y);
	let hm = $state(h0.m);
	let hd = $state(h0.d);

	const fromGreg = $derived.by(() => {
		const d = new Date(greg + 'T00:00:00Z');
		return Number.isNaN(d.getTime()) ? null : d;
	});
	const fromHijri = $derived(hijriToGregorian({ y: Number(hy), m: Number(hm), d: Number(hd) }));

	const months = Array.from({ length: 12 }, (_, i) =>
		new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-ca-islamic-umalqura' : 'en-u-ca-islamic-umalqura', { month: 'long', timeZone: 'UTC' }).format(
			hijriToGregorian({ y: 1446, m: i + 1, d: 10 })!
		)
	);
</script>

<div class="cols">
	<section class="w-panel" aria-labelledby="g2h">
		<h2 id="g2h">{t(lang, 'w.hij.g2h')}</h2>
		<label class="w-field"><span>{t(lang, 'w.hij.gregorian')}</span><input type="date" bind:value={greg} data-testid="greg" /></label>
		{#if fromGreg}
			<p class="w-out" data-testid="g2h-out">{hijriLong(fromGreg, lang)}</p>
		{/if}
	</section>

	<section class="w-panel" aria-labelledby="h2g">
		<h2 id="h2g">{t(lang, 'w.hij.h2g')}</h2>
		<div class="w-grid">
			<label class="w-field"><span>{t(lang, 'w.hij.day')}</span><input type="number" min="1" max="30" bind:value={hd} data-testid="hd" /></label>
			<label class="w-field"><span>{t(lang, 'w.hij.month')}</span>
				<select bind:value={hm} data-testid="hm">
					{#each months as name, i}<option value={i + 1}>{i + 1} — {name}</option>{/each}
				</select>
			</label>
			<label class="w-field"><span>{t(lang, 'w.hij.year')}</span><input type="number" min="1300" max="1600" bind:value={hy} data-testid="hy" /></label>
		</div>
		{#if fromHijri}
			<p class="w-out" data-testid="h2g-out">{gregorianLong(fromHijri, lang)}</p>
		{:else}
			<p class="err" role="alert">{t(lang, 'w.hij.invalid')}</p>
		{/if}
	</section>
</div>
<p class="note">{t(lang, 'w.hij.note')}</p>

<style>
	.cols {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
		gap: var(--space-4);
	}
	h2 {
		font-size: 1.05rem;
	}
	.err {
		color: var(--danger);
	}
	.note {
		color: var(--muted);
		font-size: 0.9rem;
		margin-top: var(--space-3);
	}
</style>
