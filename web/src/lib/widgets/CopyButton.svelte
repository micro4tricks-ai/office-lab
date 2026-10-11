<script lang="ts">
	import { t } from '../i18n';
	import type { Lang } from '../registry/types';

	let { lang, text }: { lang: Lang; text: string } = $props();
	let copied = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	async function copy() {
		try {
			await navigator.clipboard.writeText(text);
			copied = true;
			clearTimeout(timer);
			timer = setTimeout(() => (copied = false), 1800);
		} catch {
			/* clipboard blocked: the text stays selectable */
		}
	}
</script>

<button class="btn" type="button" onclick={copy} disabled={!text}>
	{copied ? t(lang, 'w.copied') : t(lang, 'w.copy')}
</button>
<span class="visually-hidden" aria-live="polite">{copied ? t(lang, 'w.copied') : ''}</span>
