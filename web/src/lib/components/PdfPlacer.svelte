<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { exportInk, imageToPng, loadSignatureFonts, pngSize, textPng, type FontKey } from '../editors/ink';
	import { t } from '../i18n';
	import type { FileData, Lang, Placement } from '../registry/types';
	import Icon from './Icon.svelte';

	let {
		lang,
		file,
		mode,
		preview,
		placements = $bindable()
	}: {
		lang: Lang;
		file: File;
		/** 'sign': draw / type / image / date. 'annotate': text / image. 'redact': black boxes. */
		mode: 'sign' | 'annotate' | 'redact';
		preview: (file: File, options: Record<string, string | number>) => Promise<FileData[]>;
		placements: Placement[] | null;
	} = $props();

	/** `free`: width and height resize separately (redaction boxes). */
	type Item = Placement & { id: number; url: string; label: string; free?: boolean };
	type Size = { w: number; h: number };

	let sizes = $state<Size[]>([]);
	let current = $state(0);
	let pageUrls = $state<Record<number, string>>({});
	let items = $state<Item[]>([]);
	let selected = $state<number | null>(null);
	let panel = $state<'draw' | 'type' | 'text' | null>(null);
	let loading = $state(true);
	let failed = $state(false);
	let seq = 0;
	let stage: HTMLDivElement | undefined = $state();

	// Panel fields
	let typed = $state('');
	let font = $state<FontKey>('ruqaa');
	let color = $state('#1a237e');
	let textSize = $state(14);
	let pad: HTMLCanvasElement | undefined = $state();
	let inked = $state(false);

	$effect(() => {
		placements = items.map(({ page, x, y, w, h, png }) => ({ page, x, y, w, h, png }));
	});

	async function loadPage(n: number) {
		if (pageUrls[n]) return;
		const [meta, jpg] = await preview(file, { width: 1000, pages: String(n + 1) });
		if (!sizes.length) sizes = JSON.parse(new TextDecoder().decode(meta.bytes));
		pageUrls[n] = URL.createObjectURL(new Blob([jpg.bytes as Uint8Array<ArrayBuffer>], { type: jpg.type }));
	}

	onMount(async () => {
		loadSignatureFonts();
		try {
			await loadPage(0);
		} catch {
			failed = true;
		}
		loading = false;
	});
	onDestroy(() => {
		Object.values(pageUrls).forEach((u) => URL.revokeObjectURL(u));
		items.forEach((i) => URL.revokeObjectURL(i.url));
	});

	async function go(n: number) {
		if (n < 0 || n >= sizes.length) return;
		current = n;
		selected = null;
		await loadPage(n);
	}

	const page = $derived(sizes[current] ?? { w: 595, h: 842 });

	/** Adds a PNG to the current page; `printedWidth` in points (else a share of the page). */
	function add(png: FileData, label: string, { printedWidth = 0, share = 0.3, y = 0.5 } = {}) {
		const px = pngSize(png.bytes);
		const w = Math.min(0.9, printedWidth ? printedWidth / page.w : share);
		const h = (w * page.w * (px.h / px.w)) / page.h;
		const item: Item = {
			id: ++seq,
			page: current,
			x: 0.5 - w / 2,
			y: Math.min(1 - h, Math.max(0, y - h / 2)),
			w,
			h,
			png,
			url: URL.createObjectURL(new Blob([png.bytes as Uint8Array<ArrayBuffer>], { type: 'image/png' })),
			label
		};
		items.push(item);
		selected = item.id;
		panel = null;
	}

	/** A black box (a 2×2 black PNG, stretched) that hides what is under it. */
	async function addBox() {
		const c = new OffscreenCanvas(2, 2);
		const ctx = c.getContext('2d')!;
		ctx.fillStyle = '#000';
		ctx.fillRect(0, 0, 2, 2);
		const bytes = new Uint8Array(await (await c.convertToBlob({ type: 'image/png' })).arrayBuffer());
		const w = 0.35;
		const h = 0.035;
		items.push({
			id: ++seq,
			page: current,
			x: 0.5 - w / 2,
			y: 0.3,
			w,
			h,
			png: { name: 'box.png', type: 'image/png', bytes },
			url: URL.createObjectURL(new Blob([bytes], { type: 'image/png' })),
			label: t(lang, 'place.boxLabel'),
			free: true
		});
		selected = seq;
	}

	async function addTyped() {
		if (!typed.trim()) return;
		const png = await textPng(typed.trim(), { font, color, px: 120 });
		add(png, typed.trim(), { share: 0.28, y: 0.82 });
		typed = '';
	}
	async function addText() {
		if (!typed.trim()) return;
		const png = await textPng(typed.trim(), { font: 'cairo', color, px: 96 });
		const { w, h } = pngSize(png.bytes);
		// Rendered at 96 px for a line of textSize points: scale the width to match.
		add(png, typed.trim(), { printedWidth: (w * textSize * 1.6) / h });
		typed = '';
	}
	async function addDate() {
		const text = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'long' }).format(new Date());
		const png = await textPng(text, { font: 'cairo', color, px: 96, weight: 600 });
		const { w, h } = pngSize(png.bytes);
		add(png, text, { printedWidth: (w * 12 * 1.6) / h, y: 0.9 });
	}
	async function addImage(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const f = input.files?.[0];
		input.value = '';
		if (!f) return;
		add(await imageToPng(f), f.name, { share: mode === 'sign' ? 0.25 : 0.4, y: mode === 'sign' ? 0.82 : 0.5 });
	}

	// --- drawing pad ---
	let drawing = false;
	function padPoint(e: PointerEvent) {
		const r = pad!.getBoundingClientRect();
		return [((e.clientX - r.left) / r.width) * pad!.width, ((e.clientY - r.top) / r.height) * pad!.height];
	}
	function padDown(e: PointerEvent) {
		drawing = true;
		pad!.setPointerCapture(e.pointerId);
		const ctx = pad!.getContext('2d')!;
		ctx.strokeStyle = color;
		ctx.lineWidth = 5;
		ctx.lineCap = ctx.lineJoin = 'round';
		ctx.beginPath();
		ctx.moveTo(...(padPoint(e) as [number, number]));
	}
	function padMove(e: PointerEvent) {
		if (!drawing) return;
		const ctx = pad!.getContext('2d')!;
		ctx.lineTo(...(padPoint(e) as [number, number]));
		ctx.stroke();
		inked = true;
	}
	function padClear() {
		pad!.getContext('2d')!.clearRect(0, 0, pad!.width, pad!.height);
		inked = false;
	}
	async function padDone() {
		if (!inked) return;
		add(await exportInk(pad!), t(lang, 'place.drawn'), { share: 0.28, y: 0.82 });
		inked = false;
	}

	// --- moving and resizing items ---
	let drag: { id: number; kind: 'move' | 'size'; sx: number; sy: number; x: number; y: number; w: number; h: number } | null = null;
	function startDrag(e: PointerEvent, item: Item, kind: 'move' | 'size') {
		e.preventDefault();
		e.stopPropagation();
		selected = item.id;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		drag = { id: item.id, kind, sx: e.clientX, sy: e.clientY, x: item.x, y: item.y, w: item.w, h: item.h };
	}
	function onDrag(e: PointerEvent) {
		if (!drag) return;
		const item = items.find((i) => i.id === drag!.id);
		if (!item) return;
		const r = stage!.getBoundingClientRect();
		const dx = (e.clientX - drag.sx) / r.width;
		const dy = (e.clientY - drag.sy) / r.height;
		if (drag.kind === 'move') {
			item.x = Math.min(1 - item.w, Math.max(0, drag.x + dx));
			item.y = Math.min(1 - item.h, Math.max(0, drag.y + dy));
		} else if (item.free) {
			item.w = Math.min(1 - item.x, Math.max(0.01, drag.w + dx));
			item.h = Math.min(1 - item.y, Math.max(0.008, drag.h + dy));
		} else {
			const w = Math.min(1 - item.x, Math.max(0.03, drag.w + dx));
			item.h = (drag.h / drag.w) * w;
			item.w = w;
		}
	}
	const endDrag = () => (drag = null);

	function keys(e: KeyboardEvent, item: Item) {
		const step = e.shiftKey ? 0.05 : 0.01;
		const moves: Record<string, [number, number]> = {
			ArrowLeft: [-step, 0],
			ArrowRight: [step, 0],
			ArrowUp: [0, -step],
			ArrowDown: [0, step]
		};
		if (moves[e.key]) {
			const [dx, dy] = moves[e.key];
			item.x = Math.min(1 - item.w, Math.max(0, item.x + dx));
			item.y = Math.min(1 - item.h, Math.max(0, item.y + dy));
		} else if (e.key === '+' || e.key === '=' || e.key === '-') {
			const k = e.key === '-' ? 0.9 : 1.1;
			const w = Math.min(1 - item.x, Math.max(0.03, item.w * k));
			item.h = (item.h / item.w) * w;
			item.w = w;
		} else if (e.key === 'Delete' || e.key === 'Backspace') remove(item.id);
		else return;
		e.preventDefault();
	}
	function remove(id: number) {
		const item = items.find((i) => i.id === id);
		if (item) URL.revokeObjectURL(item.url);
		items = items.filter((i) => i.id !== id);
		selected = null;
	}
	const sel = $derived(items.find((i) => i.id === selected));
	const shown = $derived(items.filter((i) => i.page === current || i.page === -1));
</script>

<section class="placer" aria-labelledby="place-title">
	<h2 id="place-title">{t(lang, mode === 'sign' ? 'place.signTitle' : mode === 'redact' ? 'place.redactTitle' : 'place.annotateTitle')}</h2>

	<div class="toolbar" role="toolbar" aria-label={t(lang, 'place.add')}>
		{#if mode === 'redact'}
			<button class="btn btn-primary" type="button" onclick={addBox} data-testid="add-box"><Icon name="plus" />{t(lang, 'place.box')}</button>
		{:else if mode === 'sign'}
			<button class="btn" type="button" aria-pressed={panel === 'draw'} onclick={() => (panel = panel === 'draw' ? null : 'draw')}>
				<Icon name="pen" />{t(lang, 'place.draw')}
			</button>
			<button class="btn" type="button" aria-pressed={panel === 'type'} onclick={() => (panel = panel === 'type' ? null : 'type')}>
				<Icon name="text" />{t(lang, 'place.type')}
			</button>
		{:else}
			<button class="btn" type="button" aria-pressed={panel === 'text'} onclick={() => (panel = panel === 'text' ? null : 'text')}>
				<Icon name="text" />{t(lang, 'place.text')}
			</button>
		{/if}
		{#if mode !== 'redact'}
			<label class="btn">
				<Icon name="image" />{t(lang, mode === 'sign' ? 'place.signImage' : 'place.image')}
				<input class="visually-hidden" type="file" accept="image/*" onchange={addImage} data-testid="place-image" />
			</label>
		{/if}
		{#if mode === 'sign'}
			<button class="btn" type="button" onclick={addDate}>{t(lang, 'place.date')}</button>
		{/if}
	</div>

	{#if panel === 'draw'}
		<div class="panel">
			<p class="hint">{t(lang, 'place.drawHint')}</p>
			<canvas
				bind:this={pad}
				class="pad"
				width="900"
				height="300"
				aria-label={t(lang, 'place.pad')}
				onpointerdown={padDown}
				onpointermove={padMove}
				onpointerup={() => (drawing = false)}
				data-testid="sign-pad"
			></canvas>
			<div class="row">
				<label class="field"><span>{t(lang, 'place.color')}</span><input type="color" bind:value={color} /></label>
				<button class="btn" type="button" onclick={padClear}>{t(lang, 'place.clear')}</button>
				<button class="btn btn-primary" type="button" onclick={padDone} disabled={!inked}>{t(lang, 'place.use')}</button>
			</div>
		</div>
	{:else if panel === 'type' || panel === 'text'}
		<div class="panel">
			<div class="row">
				<label class="field grow">
					<span>{t(lang, panel === 'type' ? 'place.yourName' : 'place.yourText')}</span>
					<input type="text" dir="auto" bind:value={typed} onkeydown={(e) => e.key === 'Enter' && (panel === 'type' ? addTyped() : addText())} />
				</label>
				{#if panel === 'type'}
					<label class="field">
						<span>{t(lang, 'place.font')}</span>
						<select bind:value={font}>
							<option value="ruqaa">رقعة — Ruqaa</option>
							<option value="script">Script</option>
							<option value="cairo">Cairo</option>
						</select>
					</label>
				{:else}
					<label class="field">
						<span>{t(lang, 'place.size')}</span>
						<select bind:value={textSize}>
							{#each [10, 12, 14, 18, 24, 32] as s}<option value={s}>{s} pt</option>{/each}
						</select>
					</label>
				{/if}
				<label class="field"><span>{t(lang, 'place.color')}</span><input type="color" bind:value={color} /></label>
			</div>
			{#if panel === 'type' && typed.trim()}
				<p class="sample" style="font-family: {font === 'ruqaa' ? '"Aref Ruqaa"' : font === 'script' ? '"Dancing Script"' : 'inherit'}; color: {color}" dir="auto">{typed}</p>
			{/if}
			<button class="btn btn-primary" type="button" onclick={() => (panel === 'type' ? addTyped() : addText())} disabled={!typed.trim()}>
				{t(lang, 'place.use')}
			</button>
		</div>
	{/if}

	{#if loading}
		<p role="status">{t(lang, 'org.loading')}</p>
	{:else if failed}
		<p class="err" role="alert">{t(lang, 'err.corrupted')}</p>
	{:else}
		<div class="pager">
			<button class="icon" type="button" onclick={() => go(current - 1)} disabled={current === 0} aria-label={t(lang, 'place.prev')}>
				<Icon name={lang === 'ar' ? 'right' : 'left'} />
			</button>
			<span aria-live="polite">{t(lang, 'place.pageOf', { n: current + 1, total: sizes.length })}</span>
			<button class="icon" type="button" onclick={() => go(current + 1)} disabled={current >= sizes.length - 1} aria-label={t(lang, 'place.next')}>
				<Icon name={lang === 'ar' ? 'left' : 'right'} />
			</button>
		</div>

		<div class="stage-wrap">
			<div
				class="stage"
				bind:this={stage}
				style="aspect-ratio: {page.w} / {page.h}"
				onpointermove={onDrag}
				onpointerup={endDrag}
				onpointercancel={endDrag}
				role="presentation"
				onpointerdown={() => (selected = null)}
			>
				{#if pageUrls[current]}<img class="page" src={pageUrls[current]} alt={t(lang, 'place.pageOf', { n: current + 1, total: sizes.length })} draggable="false" />{/if}
				{#each shown as item (item.id)}
					<div
						class="item"
						class:selected={selected === item.id}
						style="left: {item.x * 100}%; top: {item.y * 100}%; width: {item.w * 100}%; height: {item.h * 100}%"
						tabindex="0"
						role="button"
						aria-roledescription={t(lang, 'place.movable')}
						aria-label="{item.label} — {t(lang, 'place.keys')}"
						onpointerdown={(e) => startDrag(e, item, 'move')}
						onkeydown={(e) => keys(e, item)}
						onfocus={() => (selected = item.id)}
						data-testid="placed-item"
					>
						<img src={item.url} alt="" draggable="false" />
						{#if selected === item.id}
							<span class="handle" role="presentation" onpointerdown={(e) => startDrag(e, item, 'size')}></span>
						{/if}
					</div>
				{/each}
			</div>
		</div>

		{#if sel}
			<div class="row selbar">
				<label class="check">
					<input
						type="checkbox"
						checked={sel.page === -1}
						onchange={(e) => (sel.page = (e.currentTarget as HTMLInputElement).checked ? -1 : current)}
					/>
					<span>{t(lang, 'place.allPages')}</span>
				</label>
				<button class="btn" type="button" onclick={() => remove(sel.id)}><Icon name="x" />{t(lang, 'place.remove')}</button>
			</div>
		{/if}
		<p class="hint">{items.length ? t(lang, 'place.count', { n: items.length }) : t(lang, mode === 'redact' ? 'place.redactEmpty' : 'place.empty')}</p>
	{/if}
</section>

<style>
	.placer {
		display: grid;
		gap: var(--space-3);
		padding: var(--space-4);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
	}
	h2 {
		font-size: 1.1rem;
	}
	.toolbar,
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: end;
	}
	.btn[aria-pressed='true'] {
		border-color: var(--accent);
		background: var(--accent-soft);
	}
	label.btn {
		cursor: pointer;
	}
	label.btn:focus-within {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
	}
	.panel {
		display: grid;
		gap: var(--space-3);
		padding: var(--space-3);
		border-radius: var(--radius-sm);
		background: var(--bg);
	}
	.pad {
		width: 100%;
		aspect-ratio: 3 / 1;
		background: #fff;
		border: 2px dashed var(--border);
		border-radius: var(--radius-sm);
		touch-action: none;
		cursor: crosshair;
	}
	.field {
		display: grid;
		gap: var(--space-1);
		font-size: 0.9rem;
	}
	.field.grow {
		flex: 1 1 12rem;
	}
	.field input[type='text'],
	.field select {
		min-height: var(--tap);
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface);
	}
	.field input[type='color'] {
		width: 56px;
		height: var(--tap);
		padding: 2px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
	}
	.sample {
		font-size: 2.2rem;
		line-height: 1.6;
	}
	.hint {
		color: var(--muted);
		font-size: 0.9rem;
	}
	.err {
		color: var(--danger);
	}
	.pager {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-3);
		font-weight: 600;
	}
	.icon {
		display: grid;
		place-items: center;
		width: var(--tap);
		height: var(--tap);
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--surface);
		cursor: pointer;
	}
	.icon:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.stage-wrap {
		display: grid;
		place-items: center;
		background: var(--surface-2);
		border-radius: var(--radius-sm);
		padding: var(--space-3);
	}
	.stage {
		position: relative;
		width: min(100%, 720px);
		background: #fff;
		box-shadow: 0 2px 10px rgb(0 0 0 / 0.18);
		touch-action: none;
		user-select: none;
	}
	.page {
		display: block;
		width: 100%;
		height: 100%;
	}
	.item {
		position: absolute;
		cursor: move;
		outline: 1px dashed transparent;
	}
	.item img {
		width: 100%;
		height: 100%;
		display: block;
		pointer-events: none;
	}
	.item.selected,
	.item:focus-visible {
		outline: 2px dashed var(--accent);
		outline-offset: 2px;
	}
	.handle {
		position: absolute;
		/* Physical bottom-right in both directions: dragging right always enlarges. */
		right: -10px;
		bottom: -10px;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--accent);
		border: 2px solid #fff;
		cursor: nwse-resize;
	}
	.selbar {
		align-items: center;
		justify-content: space-between;
	}
	.check {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap);
	}
	.check input {
		width: 22px;
		height: 22px;
		accent-color: var(--accent);
	}
</style>
