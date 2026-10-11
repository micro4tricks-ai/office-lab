<script lang="ts">
	import { t } from '../i18n';
	import type { Lang } from '../registry/types';
	import CopyButton from './CopyButton.svelte';

	let { lang }: { lang: Lang } = $props();

	// No look-alikes (0/O, 1/l/I) so a password read aloud or copied by hand stays right.
	const SETS = {
		lower: 'abcdefghijkmnopqrstuvwxyz',
		upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
		digits: '23456789',
		symbols: '!@#$%&*-_=+?'
	};
	let length = $state(16);
	let use = $state({ lower: true, upper: true, digits: true, symbols: true });
	let count = $state(1);
	let list = $state<string[]>([]);

	/** Unbiased random index (rejection sampling on crypto.getRandomValues). */
	function pick(n: number) {
		const max = Math.floor(0x100000000 / n) * n;
		const buf = new Uint32Array(1);
		do crypto.getRandomValues(buf);
		while (buf[0] >= max);
		return buf[0] % n;
	}

	function one() {
		const groups = (Object.keys(SETS) as (keyof typeof SETS)[]).filter((k) => use[k]).map((k) => SETS[k]);
		if (!groups.length) return '';
		const all = groups.join('');
		// At least one character from every chosen group, then shuffle.
		const chars = groups.map((g) => g[pick(g.length)]);
		while (chars.length < length) chars.push(all[pick(all.length)]);
		for (let i = chars.length - 1; i > 0; i--) {
			const j = pick(i + 1);
			[chars[i], chars[j]] = [chars[j], chars[i]];
		}
		return chars.join('');
	}

	function make() {
		list = Array.from({ length: Math.min(50, Math.max(1, Number(count) || 1)) }, one);
	}
	$effect(() => {
		void length;
		void JSON.stringify(use);
		void count;
		make();
	});

	const poolSize = $derived((Object.keys(SETS) as (keyof typeof SETS)[]).filter((k) => use[k]).reduce((s, k) => s + SETS[k].length, 0));
	const bits = $derived(poolSize ? Math.round(length * Math.log2(poolSize)) : 0);
	const strength = $derived(bits >= 90 ? 'strong' : bits >= 60 ? 'good' : 'weak');
</script>

<div class="w-panel">
	<label class="w-field">
		<span>{t(lang, 'pw.length')}: <b dir="ltr">{length}</b></span>
		<input type="range" min="8" max="64" bind:value={length} />
	</label>
	<div class="w-grid">
		<label class="check"><input type="checkbox" bind:checked={use.lower} />{t(lang, 'pw.lower')} (a-z)</label>
		<label class="check"><input type="checkbox" bind:checked={use.upper} />{t(lang, 'pw.upper')} (A-Z)</label>
		<label class="check"><input type="checkbox" bind:checked={use.digits} />{t(lang, 'pw.digits')} (2-9)</label>
		<label class="check"><input type="checkbox" bind:checked={use.symbols} />{t(lang, 'pw.symbols')} (!@#…)</label>
		<label class="w-field"><span>{t(lang, 'pw.count')}</span><input type="number" min="1" max="50" dir="ltr" bind:value={count} /></label>
	</div>
	<p class="meter {strength}">{t(lang, `pw.${strength}`)} · <span dir="ltr">{bits} bits</span></p>
</div>

<div class="w-panel">
	<ul class="pw" data-testid="passwords">
		{#each list as p, i (i + p)}
			<li><code dir="ltr">{p}</code><CopyButton {lang} text={p} /></li>
		{/each}
	</ul>
	<div class="w-row">
		<button class="btn btn-primary" type="button" onclick={make}>{t(lang, 'pw.again')}</button>
		{#if list.length > 1}<CopyButton {lang} text={list.join('\n')} />{/if}
	</div>
	<p class="hint">{t(lang, 'pw.note')}</p>
</div>

<style>
	.check {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		min-height: var(--tap);
	}
	.pw {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--space-2);
	}
	.pw li {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
	}
	code {
		font-size: 1.1rem;
		overflow-wrap: anywhere;
		padding: var(--space-2) var(--space-3);
		background: var(--bg);
		border-radius: var(--radius-sm);
		flex: 1 1 14rem;
	}
	.meter {
		margin: 0;
		font-weight: 700;
	}
	.meter.weak {
		color: var(--danger);
	}
	.meter.good {
		color: var(--focus);
	}
	.meter.strong {
		color: var(--ok);
	}
	.hint {
		margin: 0;
		color: var(--muted);
		font-size: 0.875rem;
	}
	.w-panel + .w-panel {
		margin-top: var(--space-4);
	}
</style>
