<script lang="ts">
	import type { FileData } from '../registry/types';

	let { file }: { file: FileData } = $props();
	let src = $state('');

	$effect(() => {
		const url = URL.createObjectURL(new Blob([file.bytes as Uint8Array<ArrayBuffer>], { type: file.type }));
		src = url;
		return () => URL.revokeObjectURL(url);
	});
</script>

<img {src} alt="" width="48" height="48" loading="lazy" decoding="async" />

<style>
	img {
		width: 48px;
		height: 48px;
		object-fit: contain;
		border-radius: 8px;
		border: 1px solid var(--border);
		/* checkerboard so transparency is visible */
		background: repeating-conic-gradient(var(--surface-2) 0% 25%, var(--surface) 0% 50%) 50% / 12px 12px;
		flex: none;
	}
</style>
