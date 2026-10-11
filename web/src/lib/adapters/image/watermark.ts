import arabicFont from '@fontsource-variable/cairo/files/cairo-arabic-wght-normal.woff2?url';
import latinFont from '@fontsource-variable/cairo/files/cairo-latin-wght-normal.woff2?url';
import { ConvertError, type Adapter, type FileData } from '../../registry/types';
import { decodeImage } from './decode';
import { encodeImage } from './encode';
import { sameFormat } from './formats';
import { output } from './output';
import { resize, toCanvas } from './pixels';

const FAMILY = 'Office Lab Watermark';
let fonts: Promise<void> | null = null;

/** Cairo (self-hosted) so Arabic watermarks are shaped properly inside the worker. */
function loadFonts() {
	fonts ??= (async () => {
		const set = (self as unknown as { fonts: FontFaceSet }).fonts;
		const faces = [
			new FontFace(FAMILY, `url(${arabicFont})`, {
				weight: '200 1000',
				unicodeRange: 'U+0600-06FF,U+0750-077F,U+0870-08FF,U+200C-200E,U+FB50-FDFF,U+FE70-FEFC'
			}),
			new FontFace(FAMILY, `url(${latinFont})`, {
				weight: '200 1000',
				unicodeRange: 'U+0000-00FF,U+0131,U+0152-0153,U+2000-206F,U+20AC,U+2122'
			})
		];
		for (const f of faces) set.add(await f.load());
	})();
	return fonts;
}

const POS: Record<string, [number, number]> = {
	tl: [0, 0], tc: [0.5, 0], tr: [1, 0],
	ml: [0, 0.5], center: [0.5, 0.5], mr: [1, 0.5],
	bl: [0, 1], bc: [0.5, 1], br: [1, 1]
};

/** Text or logo watermark: position (or tiled), size, opacity, angle. */
const adapter: Adapter = {
	async convert(input, options, progress) {
		const { image, kind } = await decodeImage(input);
		const c = toCanvas(image).getContext('2d')!;
		const W = image.width;
		const H = image.height;
		const size = (Math.max(2, Number(options.size) || 25) / 100) * W; // width of the mark
		const angle = ((Number(options.angle) || 0) * Math.PI) / 180;
		const margin = Math.round(Math.min(W, H) * 0.04);
		c.globalAlpha = Math.max(5, Math.min(100, Number(options.opacity) || 50)) / 100;

		let draw: () => void;
		let mw: number;
		let mh: number;
		if (options.kind === 'logo') {
			const logo = options.logo as FileData | null;
			if (!logo) throw new ConvertError('wrong-type', 'logo missing');
			const { image: li } = await decodeImage(logo);
			const s = size / li.width;
			const scaled = toCanvas(await resize(li, li.width * s, li.height * s));
			[mw, mh] = [scaled.width, scaled.height];
			draw = () => c.drawImage(scaled, -mw / 2, -mh / 2);
		} else {
			await loadFonts();
			const text = String(options.text || '©');
			c.font = `700 100px "${FAMILY}"`;
			const px = Math.max(8, (100 * size) / Math.max(1, c.measureText(text).width));
			c.font = `700 ${px}px "${FAMILY}"`;
			c.textAlign = 'center';
			c.textBaseline = 'middle';
			c.direction = /[؀-ۿ]/.test(text) ? 'rtl' : 'ltr';
			[mw, mh] = [c.measureText(text).width, px * 1.2];
			c.fillStyle = String(options.color || '#ffffff');
			c.strokeStyle = 'rgba(0,0,0,0.35)';
			c.lineWidth = Math.max(1, px / 24);
			draw = () => {
				c.strokeText(text, 0, 0);
				c.fillText(text, 0, 0);
			};
		}
		progress?.(0.5);

		const stamp = (x: number, y: number) => {
			c.save();
			c.translate(x, y);
			c.rotate(-angle);
			draw();
			c.restore();
		};
		if (options.position === 'tile') {
			const stepX = mw * 1.8;
			const stepY = mh * 3;
			for (let y = stepY / 2, row = 0; y < H + stepY; y += stepY, row++)
				for (let x = row % 2 ? stepX / 2 : 0; x < W + stepX; x += stepX) stamp(x, y);
		} else {
			const [px, py] = POS[String(options.position)] ?? POS.br;
			stamp(margin + mw / 2 + px * (W - mw - 2 * margin), margin + mh / 2 + py * (H - mh - 2 * margin));
		}
		const format = sameFormat(kind);
		return [output(input.name, format, await encodeImage(c.getImageData(0, 0, W, H), format, 0.9))];
	}
};

export default adapter;
