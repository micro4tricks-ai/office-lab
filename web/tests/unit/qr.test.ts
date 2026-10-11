import jsQR from 'jsqr';
import { describe, expect, it } from 'vitest';
import { makeQr, qrSvg, vcardPayload, wifiPayload } from '../../src/lib/office/qr';

/** Draws the matrix to RGBA pixels (4 px per module, quiet zone) and reads it back with jsQR. */
function readBack(text: string) {
	const m = makeQr(text);
	const scale = 4;
	const margin = 4;
	const n = (m.size + margin * 2) * scale;
	const data = new Uint8ClampedArray(n * n * 4).fill(255);
	for (let r = 0; r < m.size; r++)
		for (let c = 0; c < m.size; c++)
			if (m.dark(r, c))
				for (let y = 0; y < scale; y++)
					for (let x = 0; x < scale; x++) {
						const i = (((r + margin) * scale + y) * n + (c + margin) * scale + x) * 4;
						data[i] = data[i + 1] = data[i + 2] = 0;
					}
	return jsQR(data, n, n)?.data;
}

describe('QR codes', () => {
	it('encode Arabic as UTF-8 so phones read it back correctly', () => {
		expect(readBack('مرحبا بكم في المعمل')).toBe('مرحبا بكم في المعمل');
		expect(readBack('https://example.com/?q=1')).toBe('https://example.com/?q=1');
	});

	it('SVG has the quiet zone and only safe colours', () => {
		const svg = qrSvg(makeQr('x'), { fg: 'red"/><script>', margin: 4 });
		expect(svg).toContain('viewBox="0 0 29 29"');
		expect(svg).not.toContain('<script>');
		expect(svg).toContain('fill="#000000"');
	});

	it('Wi-Fi and contact payloads escape what they must', () => {
		expect(wifiPayload('My;Net', 'p:ss', 'WPA')).toBe('WIFI:T:WPA;S:My\\;Net;P:p\\:ss;H:false;;');
		expect(wifiPayload('Open', '', 'nopass')).toBe('WIFI:T:nopass;S:Open;H:false;;');
		expect(vcardPayload({ name: 'أحمد علي', phone: '+20 100 123', org: 'المعمل, فرع' })).toBe(
			'BEGIN:VCARD\nVERSION:3.0\nN:أحمد علي;;;;\nFN:أحمد علي\nORG:المعمل\\, فرع\nTEL;TYPE=CELL:+20100123\nEND:VCARD'
		);
	});
});
