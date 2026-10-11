<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { downloadFile } from '../download';
	import { t } from '../i18n';
	import { sendToServer } from '../remote';
	import { ConvertError, type FileData, type Lang, type Options, type Tool } from '../registry/types';

	/** URL → PDF / screenshot: the server opens the page, there is no file to upload. */
	let { lang, tool }: { lang: Lang; tool: Tool } = $props();

	let url = $state('');
	let options = $state<Options>(untrack(() => Object.fromEntries((tool.options ?? []).map((o) => [o.id, o.default]))));
	let busy = $state(false);
	let error = $state<string | null>(null);
	let result = $state<FileData | null>(null);
	let preview = $state('');
	onDestroy(() => preview && URL.revokeObjectURL(preview));

	/** People paste "example.com": add the scheme for them. */
	const normalised = (u: string) => (/^https?:\/\//i.test(u.trim()) ? u.trim() : `https://${u.trim()}`);

	async function capture(e: SubmitEvent) {
		e.preventDefault();
		if (!url.trim()) return;
		busy = true;
		error = null;
		result = null;
		if (preview) URL.revokeObjectURL(preview);
		preview = '';
		try {
			const [out] = await sendToServer(tool.id, { url: normalised(url) }, $state.snapshot(options) as Options);
			const host = new URL(normalised(url)).hostname.replace(/^www\./, '');
			result = { ...out, name: `${host}.${out.name.split('.').pop()}` };
			if (out.type.startsWith('image/')) preview = URL.createObjectURL(new Blob([out.bytes as BlobPart], { type: out.type }));
		} catch (err) {
			const code = err instanceof ConvertError ? err.code : 'unknown';
			error = code === 'options' ? t(lang, 'w.web.badUrl') : t(lang, `err.${code}`, { mb: tool.maxMB });
		} finally {
			busy = false;
		}
	}
</script>

<form class="w-panel" onsubmit={capture}>
	<label class="w-field">
		<span>{t(lang, 'w.web.url')}</span>
		<input type="text" inputmode="url" dir="ltr" autocomplete="url" placeholder="https://example.com" required bind:value={url} data-testid="web-url" />
	</label>
	<div class="w-grid">
		{#each tool.options ?? [] as opt (opt.id)}
			{#if opt.type === 'select'}
				<label class="w-field">
					<span>{opt.label[lang]}</span>
					<select bind:value={options[opt.id]}>
						{#each opt.choices as c (c.value)}<option value={c.value}>{c.label[lang]}</option>{/each}
					</select>
				</label>
			{:else if opt.type === 'checkbox'}
				<label class="check"><input type="checkbox" bind:checked={options[opt.id] as boolean} /><span>{opt.label[lang]}</span></label>
			{/if}
		{/each}
	</div>
	<div class="w-row">
		<button class="btn btn-primary" type="submit" disabled={busy}>{t(lang, busy ? 'w.web.working' : 'w.web.go')}</button>
	</div>
	<p class="hint">{t(lang, 'w.web.note')}</p>
</form>

<div aria-live="polite">
	{#if error}
		<p class="err" role="alert">{error}</p>
	{:else if result}
		<div class="w-panel result" data-testid="web-result">
			{#if preview}<img src={preview} alt={t(lang, 'w.web.preview')} />{/if}
			<div class="w-row">
				<button class="btn btn-primary" type="button" onclick={() => downloadFile(result!)}>{t(lang, 'result.download')} ({result.name})</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.check {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		align-self: end;
		min-height: 44px;
	}
	.hint {
		margin: 0;
		color: var(--muted);
		font-size: 0.9rem;
	}
	.err {
		color: var(--danger);
	}
	.result img {
		max-width: 100%;
		max-height: 60vh;
		object-fit: contain;
		object-position: top;
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}
	div[aria-live] {
		margin-top: var(--space-4);
	}
</style>
