/**
 * Finds the best encode that fits under `targetBytes`: binary search on quality first,
 * then shrink the image and search again. `encode(quality, scale)` does the real work.
 */
export async function fitToSize(
	encode: (quality: number, scale: number) => Promise<Uint8Array>,
	targetBytes: number,
	{ minQ = 0.35, maxQ = 0.95, steps = 7, minScale = 0.05 } = {}
): Promise<{ bytes: Uint8Array; quality: number; scale: number; fits: boolean }> {
	let scale = 1;
	let smallest: { bytes: Uint8Array; quality: number; scale: number } | null = null;
	for (let round = 0; round < 8; round++) {
		let lo = minQ;
		let hi = maxQ;
		let best: { bytes: Uint8Array; quality: number } | null = null;
		const top = await encode(maxQ, scale);
		if (top.length <= targetBytes) return { bytes: top, quality: maxQ, scale, fits: true };
		for (let s = 0; s < steps; s++) {
			const q = (lo + hi) / 2;
			const bytes = await encode(q, scale);
			if (bytes.length <= targetBytes) {
				best = { bytes, quality: q };
				lo = q;
			} else hi = q;
			if (!smallest || bytes.length < smallest.bytes.length) smallest = { bytes, quality: q, scale };
		}
		if (best) return { ...best, scale, fits: true };
		const low = await encode(minQ, scale);
		if (low.length <= targetBytes) return { bytes: low, quality: minQ, scale, fits: true };
		if (!smallest || low.length < smallest.bytes.length) smallest = { bytes: low, quality: minQ, scale };
		// Size grows roughly with pixel count, so shrink by the square root of the overshoot.
		const next = scale * Math.max(0.5, Math.min(0.9, Math.sqrt(targetBytes / low.length)));
		if (next < minScale) break;
		scale = next;
	}
	return { ...smallest!, fits: false };
}
