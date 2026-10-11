<script lang="ts" module>
	const paths = {
		flask: 'M9 3h6M10 3v6.5L4.6 18.3A2 2 0 0 0 6.3 21h11.4a2 2 0 0 0 1.7-2.7L14 9.5V3M7.5 15h9',
		sun: 'M12 4V2m0 20v-2m8-8h2M2 12h2m13.66-5.66 1.41-1.41M4.93 19.07l1.41-1.41m11.32 0 1.41 1.41M4.93 4.93l1.41 1.41M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
		moon: 'M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11',
		globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18m0 0c2.5-2.5 3.5-5.5 3.5-9S14.5 5.5 12 3m0 18c-2.5-2.5-3.5-5.5-3.5-9S9.5 5.5 12 3M3.5 9h17m-17 6h17',
		search: 'm21 21-4.3-4.3M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0',
		upload: 'M12 15V4m0 0-4 4m4-4 4 4M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3',
		download: 'M12 4v11m0 0-4-4m4 4 4-4M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3',
		file: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zm0 0v5h5',
		x: 'M18 6 6 18M6 6l12 12',
		up: 'm6 15 6-6 6 6',
		down: 'm6 9 6 6 6-6',
		left: 'm15 6-6 6 6 6',
		right: 'm9 6 6 6-6 6',
		rotl: 'M4 4v5h5M4.5 9A8 8 0 1 1 6 16.5',
		rotr: 'M20 4v5h-5m4.5 0A8 8 0 1 0 18 16.5',
		pen: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
		text: 'M5 6V4h14v2M12 4v16m-3 0h6',
		shield: 'M12 21s7-3.5 7-9.5V5.5L12 3 5 5.5v6c0 6 7 9.5 7 9.5m-3-9.5 2 2 4-4',
		server: 'M4 5h16v6H4zm0 8h16v6H4zm3-5h.01M7 16h.01',
		image: 'M4 5h16v14H4zm0 11 5-5 4 4 2-2 5 5M15.5 9.5h.01',
		pdf: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zm0 0v5h5M8.5 13h7M8.5 16.5h5',
		document: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zm0 0v5h5M8.5 12h7m-7 3h7m-7 3h4',
		data: 'M4 5h16v14H4zm0 5h16M4 14.5h16M10 5v14',
		ebook: 'M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5zm0 15A1.5 1.5 0 0 0 6.5 21H19',
		media: 'M4 5h16v14H4zm6 4v6l5-3z',
		ocr: 'M4 8V5h3m10 0h3v3m0 8v3h-3M7 19H4v-3m4-6h8m-8 4h5'
	};
	export type IconName = keyof typeof paths;
</script>

<script lang="ts">
	let { name, size = 20 }: { name: IconName; size?: number } = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.8"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	focusable="false"><path d={paths[name]} /></svg>
