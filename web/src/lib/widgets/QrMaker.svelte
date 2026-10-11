<script lang="ts">
	import { downloadFile } from '../download';
	import { t } from '../i18n';
	import { makeQr, qrSvg, vcardPayload, wifiPayload, type Ecl } from '../office/qr';
	import type { Lang } from '../registry/types';

	let { lang }: { lang: Lang } = $props();

	let kind = $state<'text' | 'wifi' | 'contact'>('text');
	let text = $state('https://micro4tricks-ai.github.io/office-lab/');
	let ssid = $state('');
	let password = $state('');
	let security = $state<'WPA' | 'WEP' | 'nopass'>('WPA');
	let name = $state('');
	let phone = $state('');
	let email = $state('');
	let org = $state('');
	let ecl = $state<Ecl>('M');
	let fg = $state('#000000');
	let bg = $state('#ffffff');
	let px = $state(512);

	const payload = $derived(
		kind === 'wifi' ? (ssid ? wifiPayload(ssid, password, security) : '') : kind === 'contact' ? (name ? vcardPayload({ name, phone, email, org }) : '') : text
	);
	const result = $derived.by(() => {
		if (!payload) return { svg: '', error: false };
		try {
			return { svg: qrSvg(makeQr(payload, ecl), { fg, bg }), error: false };
		} catch {
			return { svg: '', error: true }; // too much data for a QR code
		}
	});

	const svgBytes = () => new TextEncoder().encode(result.svg);
	async function png() {
		const img = new Image();
		img.src = URL.createObjectURL(new Blob([result.svg], { type: 'image/svg+xml' }));
		await img.decode();
		const c = document.createElement('canvas');
		c.width = c.height = Number(px);
		const ctx = c.getContext('2d')!;
		ctx.imageSmoothingEnabled = false;
		ctx.drawImage(img, 0, 0, c.width, c.height);
		URL.revokeObjectURL(img.src);
		const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'));
		if (blob) downloadFile({ name: 'qr-code.png', type: 'image/png', bytes: new Uint8Array(await blob.arrayBuffer()) });
	}
</script>

<div class="cols">
	<div class="w-panel">
		<label class="w-field">
			<span>{t(lang, 'w.qr.kind')}</span>
			<select bind:value={kind}>
				<option value="text">{t(lang, 'w.qr.text')}</option>
				<option value="wifi">{t(lang, 'w.qr.wifi')}</option>
				<option value="contact">{t(lang, 'w.qr.contact')}</option>
			</select>
		</label>
		{#if kind === 'text'}
			<label class="w-field"><span>{t(lang, 'w.qr.content')}</span><textarea dir="auto" bind:value={text} data-testid="qr-text"></textarea></label>
		{:else if kind === 'wifi'}
			<div class="w-grid">
				<label class="w-field"><span>{t(lang, 'w.qr.ssid')}</span><input type="text" bind:value={ssid} /></label>
				<label class="w-field"><span>{t(lang, 'w.qr.password')}</span><input type="text" bind:value={password} autocomplete="off" /></label>
				<label class="w-field"><span>{t(lang, 'w.qr.security')}</span>
					<select bind:value={security}><option value="WPA">WPA/WPA2</option><option value="WEP">WEP</option><option value="nopass">{t(lang, 'w.qr.open')}</option></select>
				</label>
			</div>
		{:else}
			<div class="w-grid">
				<label class="w-field"><span>{t(lang, 'w.qr.name')}</span><input type="text" dir="auto" bind:value={name} /></label>
				<label class="w-field"><span>{t(lang, 'w.qr.phone')}</span><input type="tel" dir="ltr" bind:value={phone} /></label>
				<label class="w-field"><span>{t(lang, 'w.qr.email')}</span><input type="email" dir="ltr" bind:value={email} /></label>
				<label class="w-field"><span>{t(lang, 'w.qr.org')}</span><input type="text" dir="auto" bind:value={org} /></label>
			</div>
		{/if}
		<details>
			<summary>{t(lang, 'w.qr.style')}</summary>
			<div class="w-grid more">
				<label class="w-field"><span>{t(lang, 'w.qr.ecl')}</span>
					<select bind:value={ecl}><option value="L">L 7%</option><option value="M">M 15%</option><option value="Q">Q 25%</option><option value="H">H 30%</option></select>
				</label>
				<label class="w-field"><span>{t(lang, 'w.qr.size')}</span>
					<select bind:value={px}>{#each [256, 512, 1024, 2048] as s}<option value={s}>{s}px</option>{/each}</select>
				</label>
				<label class="w-field"><span>{t(lang, 'w.qr.fg')}</span><input type="color" bind:value={fg} /></label>
				<label class="w-field"><span>{t(lang, 'w.qr.bg')}</span><input type="color" bind:value={bg} /></label>
			</div>
		</details>
	</div>

	<div class="w-panel result">
		{#if result.error}
			<p class="err" role="alert">{t(lang, 'w.qr.tooLong')}</p>
		{:else if result.svg}
			<div class="code" role="img" aria-label={t(lang, 'w.qr.preview')} data-testid="qr-svg">{@html result.svg}</div>
			<div class="w-row">
				<button class="btn btn-primary" type="button" onclick={png}>PNG</button>
				<button class="btn" type="button" onclick={() => downloadFile({ name: 'qr-code.svg', type: 'image/svg+xml', bytes: svgBytes() })}>SVG</button>
			</div>
		{:else}
			<p class="hint">{t(lang, 'w.qr.empty')}</p>
		{/if}
	</div>
</div>

<style>
	.cols {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
		gap: var(--space-4);
	}
	.result {
		justify-items: center;
		align-content: start;
	}
	.code {
		width: min(100%, 280px);
		aspect-ratio: 1;
	}
	.code :global(svg) {
		width: 100%;
		height: 100%;
	}
	summary {
		cursor: pointer;
		min-height: var(--tap);
		display: flex;
		align-items: center;
		font-weight: 600;
	}
	.more {
		margin-top: var(--space-3);
	}
	.err {
		color: var(--danger);
	}
	.hint {
		color: var(--muted);
	}
</style>
