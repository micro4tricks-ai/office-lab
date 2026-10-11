<script lang="ts">
	import { downloadFile } from '../download';
	import { t } from '../i18n';
	import type { Lang } from '../registry/types';

	let { lang }: { lang: Lang } = $props();

	const FORMATS = ['CODE128', 'EAN13', 'EAN8', 'UPC', 'CODE39', 'ITF14'] as const;
	let value = $state('6221234567891'); // a valid EAN13 (last digit is the check digit)
	let format = $state<(typeof FORMATS)[number]>('EAN13');
	let showText = $state(true);
	let height = $state(80);
	let svg: SVGSVGElement | undefined = $state();
	let error = $state(false);

	$effect(() => {
		// Read everything before the await: only synchronous reads are tracked by the effect.
		const opts = { format, displayValue: showText, height: Number(height), margin: 10, font: 'monospace' };
		const code = value;
		const target = svg;
		if (!target) return;
		import('jsbarcode').then(({ default: JsBarcode }) => {
			try {
				error = false;
				JsBarcode(target, code, { ...opts, valid: (ok: boolean) => (error = !ok) });
			} catch {
				error = true;
			}
		});
	});

	const svgText = () => new XMLSerializer().serializeToString(svg!);
	async function png() {
		const img = new Image();
		img.src = URL.createObjectURL(new Blob([svgText()], { type: 'image/svg+xml' }));
		await img.decode();
		const c = document.createElement('canvas');
		c.width = img.naturalWidth * 3;
		c.height = img.naturalHeight * 3;
		const ctx = c.getContext('2d')!;
		ctx.fillStyle = '#fff';
		ctx.fillRect(0, 0, c.width, c.height);
		ctx.drawImage(img, 0, 0, c.width, c.height);
		URL.revokeObjectURL(img.src);
		const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'));
		if (blob) downloadFile({ name: `barcode-${value}.png`, type: 'image/png', bytes: new Uint8Array(await blob.arrayBuffer()) });
	}
</script>

<div class="w-panel">
	<div class="w-grid">
		<label class="w-field"><span>{t(lang, 'w.bc.value')}</span><input type="text" dir="ltr" bind:value data-testid="bc-value" /></label>
		<label class="w-field"><span>{t(lang, 'w.bc.format')}</span>
			<select bind:value={format}>{#each FORMATS as f}<option value={f}>{f}</option>{/each}</select>
		</label>
		<label class="w-field"><span>{t(lang, 'w.bc.height')}</span><input type="number" min="30" max="200" bind:value={height} /></label>
		<label class="w-check"><input type="checkbox" bind:checked={showText} />{t(lang, 'w.bc.text')}</label>
	</div>
	<div class="out" class:hidden={error}>
		<svg bind:this={svg} role="img" aria-label={`${format} ${value}`} data-testid="bc-svg"></svg>
	</div>
	{#if error}
		<p class="err" role="alert">{t(lang, 'w.bc.invalid', { format })}</p>
	{:else}
		<div class="w-row">
			<button class="btn btn-primary" type="button" onclick={png}>PNG</button>
			<button class="btn" type="button" onclick={() => downloadFile({ name: `barcode-${value}.svg`, type: 'image/svg+xml', bytes: new TextEncoder().encode(svgText()) })}>SVG</button>
		</div>
	{/if}
	<p class="hint">{t(lang, 'w.bc.hint')}</p>
</div>

<style>
	.out {
		display: grid;
		place-items: center;
		padding: var(--space-4);
		background: #fff;
		border-radius: var(--radius-sm);
		overflow-x: auto;
	}
	.out.hidden {
		display: none;
	}
	.out svg {
		max-width: 100%;
		height: auto;
	}
	.err {
		color: var(--danger);
	}
	.hint {
		color: var(--muted);
		font-size: 0.9rem;
	}
</style>
