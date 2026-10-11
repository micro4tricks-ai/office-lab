<script lang="ts">
	import { t } from '../i18n';
	import { normalizeArabic, removeTashkeel, textStats, toArabicDigits, toWesternDigits } from '../office/arabic-text';
	import type { Lang } from '../registry/types';
	import CopyButton from './CopyButton.svelte';

	let { lang }: { lang: Lang } = $props();

	let input = $state('');
	let tashkeel = $state(true);
	let tatweel = $state(true);
	let digits = $state<'keep' | 'western' | 'arabic'>('keep');
	let normalize = $state(false);

	const output = $derived.by(() => {
		let s = input;
		if (tashkeel) s = removeTashkeel(s, tatweel);
		else if (tatweel) s = s.replace(/ـ/g, '');
		if (normalize) s = normalizeArabic(s);
		if (digits === 'western') s = toWesternDigits(s);
		if (digits === 'arabic') s = toArabicDigits(s);
		return s;
	});
	const stats = $derived(textStats(input));
</script>

<div class="w-panel">
	<label class="w-field">
		<span>{t(lang, 'w.ar.input')}</span>
		<textarea dir="auto" bind:value={input} placeholder="مُحَمَّدٌ رَسُولُ اللَّهِ — ١٢٣" data-testid="ar-in"></textarea>
	</label>
	<p class="stats" aria-live="polite">
		{t(lang, 'w.ar.stats', { words: stats.words, chars: stats.chars, lines: stats.lines })}
	</p>
	<div class="w-grid">
		<label class="w-check"><input type="checkbox" bind:checked={tashkeel} />{t(lang, 'w.ar.tashkeel')}</label>
		<label class="w-check"><input type="checkbox" bind:checked={tatweel} />{t(lang, 'w.ar.tatweel')}</label>
		<label class="w-check"><input type="checkbox" bind:checked={normalize} />{t(lang, 'w.ar.normalize')}</label>
		<label class="w-field">
			<span>{t(lang, 'w.ar.digits')}</span>
			<select bind:value={digits}>
				<option value="keep">{t(lang, 'w.ar.keep')}</option>
				<option value="western">123</option>
				<option value="arabic">١٢٣</option>
			</select>
		</label>
	</div>
	<label class="w-field">
		<span>{t(lang, 'w.ar.output')}</span>
		<textarea dir="auto" readonly value={output} data-testid="ar-out"></textarea>
	</label>
	<div class="w-row"><CopyButton {lang} text={output} /></div>
</div>

<style>
	.stats {
		color: var(--muted);
		font-size: 0.9rem;
	}
</style>
