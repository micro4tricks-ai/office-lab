import type { Adapter, FileData } from '../../registry/types';
import { decodeImage } from './decode';
import { encodePng } from './encode';
import { writeIco } from './ico';
import { flatten, square } from './pixels';

const text = (name: string, type: string, s: string): FileData => ({
	name,
	type,
	bytes: new TextEncoder().encode(s)
});

const SNIPPET = `<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
`;

/** One image → favicon.ico + PNG icons (16–512) + web manifest + the <head> snippet. */
const adapter: Adapter = {
	async convert(input, options, progress) {
		const { image } = await decodeImage(input);
		const fit = options.fit === 'crop' ? 'crop' : 'pad';
		const background = String(options.background || '#ffffff');
		const png = async (size: number, opaque = false) => {
			const sq = await square(image, size, fit);
			return encodePng(opaque ? flatten(sq, background) : sq);
		};

		const ico = [];
		for (const size of [16, 32, 48]) ico.push({ size, png: await png(size) });
		const files: FileData[] = [{ name: 'favicon.ico', type: 'image/x-icon', bytes: writeIco(ico) }];
		progress?.(0.3);

		const sizes: [string, number, boolean][] = [
			['favicon-16x16.png', 16, false],
			['favicon-32x32.png', 32, false],
			['apple-touch-icon.png', 180, true], // iOS paints transparency black
			['android-chrome-192x192.png', 192, false],
			['android-chrome-512x512.png', 512, false]
		];
		for (const [name, size, opaque] of sizes) {
			files.push({ name, type: 'image/png', bytes: await png(size, opaque) });
		}
		progress?.(0.9);

		const appName = String(options.name || '').trim() || 'My site';
		const manifest = {
			name: appName,
			short_name: appName,
			icons: [
				{ src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
				{ src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' }
			],
			theme_color: background,
			background_color: background,
			display: 'standalone'
		};
		files.push(
			text('site.webmanifest', 'application/manifest+json', JSON.stringify(manifest, null, 2) + '\n'),
			text('favicon-snippet.html', 'text/html', SNIPPET)
		);
		return files;
	}
};

export default adapter;
