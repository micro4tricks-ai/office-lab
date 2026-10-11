<script lang="ts">
	let { value, label }: { value: number; label: string } = $props();
</script>

<progress max="1" {value} aria-label={label}></progress>

<style>
	progress {
		appearance: none;
		width: 100%;
		height: 6px;
		border: 0;
		border-radius: 999px;
		background: var(--surface-2);
		overflow: hidden;
	}
	progress::-webkit-progress-bar {
		background: var(--surface-2);
	}
	progress::-webkit-progress-value {
		background: var(--accent);
		transition: width 0.2s;
	}
	progress::-moz-progress-bar {
		background: var(--accent);
	}
</style>
