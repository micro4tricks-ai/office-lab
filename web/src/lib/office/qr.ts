import qrcode from 'qrcode-generator';

export type Ecl = 'L' | 'M' | 'Q' | 'H';
export type QrMatrix = { size: number; dark: (r: number, c: number) => boolean };

/**
 * The library writes each character's low byte (Latin-1), which breaks Arabic. Give it the
 * UTF-8 bytes as one character per byte instead, so phones decode the text correctly.
 */
const utf8AsLatin1 = (s: string) => String.fromCharCode(...new TextEncoder().encode(s));

export function makeQr(text: string, ecl: Ecl = 'M'): QrMatrix {
	const qr = qrcode(0, ecl);
	qr.addData(utf8AsLatin1(text), 'Byte');
	qr.make();
	return { size: qr.getModuleCount(), dark: (r, c) => qr.isDark(r, c) };
}

/** Crisp SVG: one path for all dark modules, `margin` modules of quiet zone. */
export function qrSvg(m: QrMatrix, { fg = '#000000', bg = '#ffffff', margin = 4 } = {}): string {
	const n = m.size + margin * 2;
	let d = '';
	for (let r = 0; r < m.size; r++)
		for (let c = 0; c < m.size; c++) if (m.dark(r, c)) d += `M${c + margin} ${r + margin}h1v1h-1z`;
	const safe = (s: string) => (/^#[0-9a-f]{3,8}$/i.test(s) ? s : '#000000');
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="${safe(bg)}"/><path fill="${safe(fg)}" d="${d}"/></svg>`;
}

/** Wi-Fi join code (special characters escaped as the format requires). */
export function wifiPayload(ssid: string, password: string, security: 'WPA' | 'WEP' | 'nopass', hidden = false) {
	const esc = (s: string) => s.replace(/([\\;,:"])/g, '\\$1');
	return `WIFI:T:${security};S:${esc(ssid)};${security === 'nopass' ? '' : `P:${esc(password)};`}H:${hidden};;`;
}

/** Contact card (vCard 3.0), readable by phone cameras. */
export function vcardPayload(c: { name: string; phone?: string; email?: string; org?: string; title?: string; url?: string }) {
	const esc = (s: string) => s.replace(/([\\;,])/g, '\\$1').replace(/\r?\n/g, '\\n');
	const lines = ['BEGIN:VCARD', 'VERSION:3.0', `N:${esc(c.name)};;;;`, `FN:${esc(c.name)}`];
	if (c.org) lines.push(`ORG:${esc(c.org)}`);
	if (c.title) lines.push(`TITLE:${esc(c.title)}`);
	if (c.phone) lines.push(`TEL;TYPE=CELL:${c.phone.replace(/[^\d+]/g, '')}`);
	if (c.email) lines.push(`EMAIL:${c.email.trim()}`);
	if (c.url) lines.push(`URL:${c.url.trim()}`);
	lines.push('END:VCARD');
	return lines.join('\n');
}
