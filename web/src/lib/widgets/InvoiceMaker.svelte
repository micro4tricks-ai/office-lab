<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import Icon from '../components/Icon.svelte';
	import { serverCapabilities } from '../config';
	import { downloadFile } from '../download';
	import { t } from '../i18n';
	import { fontFaces } from '../markdown/document';
	import { packDocument } from '../markdown/pack';
	import { invoiceHtml, totals, type Invoice } from '../office/invoice';
	import { CURRENCIES } from '../office/tafqeet';
	import { ConvertError, type Lang } from '../registry/types';
	import { sendToServer } from '../remote';

	let { lang }: { lang: Lang } = $props();

	const KEY = 'office-lab:invoice';
	/** Today in the user's own time zone (toISOString would give UTC's date). */
	const today = () => {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	};
	const empty = { name: '', address: '', phone: '', taxId: '' };
	let inv = $state<Invoice>({
		seller: { ...empty },
		buyer: { ...empty },
		number: '1',
		date: today(),
		due: '',
		currency: 'EGP',
		vatRate: 14,
		discount: 0,
		lines: [{ desc: '', qty: 1, price: 0 }],
		notes: '',
		zatcaQr: false,
		logo: '',
		accent: '#0f6e66'
	});
	let srcdoc = $state('');
	let direct = $state(false);
	let busy = $state(false);
	let error = $state('');
	let printFrame: HTMLIFrameElement | null = null;
	let timer: ReturnType<typeof setTimeout> | undefined;

	onMount(() => {
		// Your own details and the last invoice come back next time (this browser only).
		try {
			const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
			if (saved) inv = { ...inv, ...saved, date: today() };
		} catch {
			/* nothing saved, or private mode */
		}
		serverCapabilities().then((c) => (direct = c.has('html-to-pdf')));
	});
	onDestroy(() => {
		clearTimeout(timer);
		printFrame?.remove();
	});

	const html = () => invoiceHtml($state.snapshot(inv) as Invoice, fontFaces());
	$effect(() => {
		void JSON.stringify(inv);
		clearTimeout(timer);
		timer = setTimeout(() => {
			srcdoc = html();
			try {
				localStorage.setItem(KEY, JSON.stringify($state.snapshot(inv)));
			} catch {
				/* private mode */
			}
		}, 250);
	});

	const sum = $derived(totals(inv));
	const money = (n: number) => n.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	const fileName = () => `${lang === 'ar' ? 'فاتورة' : 'invoice'}-${(inv.number || '1').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40)}.pdf`;

	const addLine = () => inv.lines.push({ desc: '', qty: 1, price: 0 });
	const removeLine = (i: number) => inv.lines.length > 1 && inv.lines.splice(i, 1);

	async function pickLogo(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const f = input.files?.[0];
		input.value = '';
		if (!f) return;
		// Shrink to 400 px wide at most and keep it as PNG inside the invoice.
		const bmp = await createImageBitmap(f);
		const s = Math.min(1, 400 / bmp.width);
		const c = document.createElement('canvas');
		c.width = Math.round(bmp.width * s);
		c.height = Math.round(bmp.height * s);
		c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
		inv.logo = c.toDataURL('image/png');
	}

	function print() {
		printFrame?.remove();
		printFrame = document.createElement('iframe');
		printFrame.title = t(lang, 'inv.print');
		printFrame.style.cssText = 'position:fixed;inset-inline-start:-10000px;top:0;width:210mm;height:297mm;border:0';
		printFrame.srcdoc = html().replace('</body>', '<script>document.fonts.ready.then(function(){setTimeout(function(){print()},50)})<\/script></body>');
		document.body.append(printFrame);
	}

	async function downloadPdf() {
		busy = true;
		error = '';
		try {
			const { index, assets } = await packDocument(html());
			const [pdf] = await sendToServer('html-to-pdf', { file: index, assets }, { background: true });
			downloadFile({ ...pdf, name: fileName() });
		} catch (e) {
			error = t(lang, `err.${e instanceof ConvertError ? e.code : 'unknown'}`, { mb: 100 });
		} finally {
			busy = false;
		}
	}

	function newInvoice() {
		const n = Number(inv.number);
		inv.number = Number.isFinite(n) ? String(n + 1) : '';
		inv.buyer = { ...empty };
		inv.lines = [{ desc: '', qty: 1, price: 0 }];
		inv.discount = 0;
		inv.notes = '';
		inv.date = today();
	}
	const rates = [0, 5, 14, 15];
</script>

<div class="inv">
	<div class="form">
		<fieldset class="w-panel">
			<legend>{t(lang, 'inv.seller')}</legend>
			<div class="w-grid">
				<label class="w-field"><span>{t(lang, 'inv.name')}</span><input type="text" dir="auto" bind:value={inv.seller.name} data-testid="inv-seller" /></label>
				<label class="w-field"><span>{t(lang, 'inv.taxId')}</span><input type="text" dir="ltr" bind:value={inv.seller.taxId} /></label>
				<label class="w-field"><span>{t(lang, 'inv.phone')}</span><input type="tel" dir="ltr" bind:value={inv.seller.phone} /></label>
				<label class="w-field"><span>{t(lang, 'inv.address')}</span><input type="text" dir="auto" bind:value={inv.seller.address} /></label>
				<label class="w-field"><span>{t(lang, 'inv.logo')}</span><input type="file" accept="image/png,image/jpeg,image/webp" onchange={pickLogo} /></label>
				<label class="w-field"><span>{t(lang, 'inv.color')}</span><input type="color" bind:value={inv.accent} /></label>
			</div>
			{#if inv.logo}<button class="btn small" type="button" onclick={() => (inv.logo = '')}>{t(lang, 'inv.noLogo')}</button>{/if}
		</fieldset>

		<fieldset class="w-panel">
			<legend>{t(lang, 'inv.buyer')}</legend>
			<div class="w-grid">
				<label class="w-field"><span>{t(lang, 'inv.name')}</span><input type="text" dir="auto" bind:value={inv.buyer.name} data-testid="inv-buyer" /></label>
				<label class="w-field"><span>{t(lang, 'inv.taxId')}</span><input type="text" dir="ltr" bind:value={inv.buyer.taxId} /></label>
				<label class="w-field"><span>{t(lang, 'inv.phone')}</span><input type="tel" dir="ltr" bind:value={inv.buyer.phone} /></label>
				<label class="w-field"><span>{t(lang, 'inv.address')}</span><input type="text" dir="auto" bind:value={inv.buyer.address} /></label>
			</div>
		</fieldset>

		<fieldset class="w-panel">
			<legend>{t(lang, 'inv.details')}</legend>
			<div class="w-grid">
				<label class="w-field"><span>{t(lang, 'inv.number')}</span><input type="text" dir="ltr" bind:value={inv.number} /></label>
				<label class="w-field"><span>{t(lang, 'inv.date')}</span><input type="date" bind:value={inv.date} /></label>
				<label class="w-field"><span>{t(lang, 'inv.due')}</span><input type="date" bind:value={inv.due} /></label>
				<label class="w-field"><span>{t(lang, 'inv.currency')}</span>
					<select bind:value={inv.currency}>
						{#each CURRENCIES as c (c.code)}<option value={c.code}>{c.label[lang]} ({c.code})</option>{/each}
					</select>
				</label>
				<label class="w-field"><span>{t(lang, 'inv.vat')}</span>
					<select bind:value={inv.vatRate}>
						{#each rates as r}<option value={r}>{r}%</option>{/each}
					</select>
				</label>
				<label class="w-field"><span>{t(lang, 'inv.discount')}</span><input type="number" min="0" step="0.01" dir="ltr" bind:value={inv.discount} /></label>
			</div>
			<label class="check"><input type="checkbox" bind:checked={inv.zatcaQr} disabled={!inv.vatRate} /><span>{t(lang, 'inv.zatca')}</span></label>
		</fieldset>

		<fieldset class="w-panel">
			<legend>{t(lang, 'inv.items')}</legend>
			<div class="lines">
				{#each inv.lines as line, i (i)}
					<div class="line">
						<label class="w-field desc"><span>{t(lang, 'inv.desc')}</span><input type="text" dir="auto" bind:value={line.desc} data-testid="inv-desc" /></label>
						<label class="w-field"><span>{t(lang, 'inv.qty')}</span><input type="number" min="0" step="any" dir="ltr" bind:value={line.qty} data-testid="inv-qty" /></label>
						<label class="w-field"><span>{t(lang, 'inv.price')}</span><input type="number" min="0" step="0.01" dir="ltr" bind:value={line.price} data-testid="inv-price" /></label>
						<span class="amount" dir="ltr">{money(sum.lines[i] ?? 0)}</span>
						<button class="icon" type="button" onclick={() => removeLine(i)} disabled={inv.lines.length === 1} aria-label={t(lang, 'inv.removeLine', { n: i + 1 })}><Icon name="x" /></button>
					</div>
				{/each}
			</div>
			<button class="btn" type="button" onclick={addLine}><Icon name="plus" />{t(lang, 'inv.addLine')}</button>
			<label class="w-field"><span>{t(lang, 'inv.notes')}</span><textarea dir="auto" rows="2" bind:value={inv.notes}></textarea></label>
		</fieldset>

		<div class="w-panel totals" aria-live="polite">
			<p>{t(lang, 'inv.subtotal')}: <b dir="ltr">{money(sum.subtotal)}</b></p>
			<p>{t(lang, 'inv.vatAmount')}: <b dir="ltr">{money(sum.vat)}</b></p>
			<p class="grand">{t(lang, 'inv.total')}: <b dir="ltr" data-testid="inv-total">{money(sum.total)} {inv.currency}</b></p>
		</div>

		<div class="w-row">
			<button class="btn btn-primary" type="button" onclick={print} data-testid="inv-print"><Icon name="pdf" />{t(lang, 'inv.print')}</button>
			{#if direct}
				<button class="btn btn-primary" type="button" onclick={downloadPdf} disabled={busy} data-testid="inv-direct"><Icon name="download" />{t(lang, busy ? 'md.directBusy' : 'md.direct')}</button>
			{/if}
			<button class="btn" type="button" onclick={newInvoice}>{t(lang, 'inv.new')}</button>
		</div>
		{#if error}<p class="err" role="alert">{error}</p>{/if}
		<p class="hint">{t(lang, 'inv.saved')}</p>
	</div>

	<div class="preview">
		<iframe title={t(lang, 'inv.preview')} {srcdoc} sandbox="allow-same-origin" data-testid="inv-preview"></iframe>
	</div>
</div>

<style>
	.inv {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--space-4);
		align-items: start;
	}
	@media (max-width: 900px) {
		.inv {
			grid-template-columns: 1fr;
		}
	}
	.form {
		display: grid;
		gap: var(--space-3);
	}
	fieldset {
		margin: 0;
	}
	legend {
		font-weight: 700;
		padding: 0 var(--space-2);
	}
	.lines {
		display: grid;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
	}
	.line {
		display: grid;
		grid-template-columns: minmax(8rem, 3fr) minmax(4rem, 1fr) minmax(5rem, 1.3fr) auto auto;
		gap: var(--space-2);
		align-items: end;
	}
	@media (max-width: 560px) {
		.line {
			grid-template-columns: 1fr 1fr;
		}
		.line .desc {
			grid-column: 1 / -1;
		}
	}
	.amount {
		min-width: 5rem;
		padding-block: var(--space-2);
		font-weight: 600;
		text-align: end;
	}
	.icon {
		min-width: var(--tap);
		min-height: var(--tap);
		display: inline-grid;
		place-items: center;
		background: none;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		color: var(--text);
		cursor: pointer;
	}
	.icon:disabled {
		opacity: 0.4;
	}
	.check {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		margin-top: var(--space-2);
	}
	.totals p {
		margin: 0;
	}
	.totals .grand {
		font-size: 1.15rem;
		color: var(--accent-strong);
	}
	.btn.small {
		margin-top: var(--space-2);
		min-height: 36px;
		font-size: 0.9rem;
	}
	.hint {
		margin: 0;
		color: var(--muted);
		font-size: 0.875rem;
	}
	.err {
		color: var(--danger);
	}
	.preview {
		position: sticky;
		top: var(--space-4);
	}
	.preview iframe {
		width: 100%;
		aspect-ratio: 210 / 297;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: #fff;
	}
</style>
