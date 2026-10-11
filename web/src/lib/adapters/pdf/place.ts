import { degrees, type PDFImage, type PDFPage } from '@cantoo/pdf-lib';

/** The page as the reader sees it: size after /Rotate, in points. */
export function visualSize(page: PDFPage) {
	const box = page.getCropBox();
	const rot = ((page.getRotation().angle % 360) + 360) % 360;
	return rot === 90 || rot === 270 ? { w: box.height, h: box.width, rot } : { w: box.width, h: box.height, rot };
}

/** Visual point (origin bottom-left of what the reader sees) → the page's own coordinates. */
function toUser(page: PDFPage, vx: number, vy: number) {
	const box = page.getCropBox();
	const { rot } = visualSize(page);
	const [W, H] = [box.width, box.height];
	const [x, y] =
		rot === 90 ? [W - vy, vx] : rot === 180 ? [W - vx, H - vy] : rot === 270 ? [vy, H - vx] : [vx, vy];
	return { x: x + box.x, y: y + box.y, rot };
}

/**
 * Draws `img` so that, as the reader sees the page, its centre is at (cx, cy),
 * it is w×h points, and it is turned `angle` degrees counter-clockwise.
 */
export function stamp(
	page: PDFPage,
	img: PDFImage,
	{ cx, cy, w, h, angle = 0, opacity = 1 }: { cx: number; cy: number; w: number; h: number; angle?: number; opacity?: number }
) {
	const a = (angle * Math.PI) / 180;
	// The bottom-left corner of the rotated box, in visual space.
	const vx = cx - (Math.cos(a) * w) / 2 + (Math.sin(a) * h) / 2;
	const vy = cy - (Math.sin(a) * w) / 2 - (Math.cos(a) * h) / 2;
	const { x, y, rot } = toUser(page, vx, vy);
	page.drawImage(img, { x, y, width: w, height: h, rotate: degrees(rot + angle), opacity });
}

/** Centre point for a named spot ("bc", "tr", …) with a margin, for a w×h box. */
export function spot(page: PDFPage, pos: string, w: number, h: number, margin: number) {
	const { w: W, h: H } = visualSize(page);
	const col = pos.endsWith('l') ? 0 : pos.endsWith('r') ? 2 : 1;
	const row = pos.startsWith('t') ? 0 : pos.startsWith('b') ? 2 : 1;
	return {
		cx: [margin + w / 2, W / 2, W - margin - w / 2][col],
		cy: [H - margin - h / 2, H / 2, margin + h / 2][row]
	};
}
