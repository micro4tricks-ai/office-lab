import { describe, expect, it } from 'vitest';
import { invoiceHtml, totals, zatcaPayload, type Invoice } from '../../src/lib/office/invoice';

const base: Invoice = {
	seller: { name: 'شركة النور', address: 'القاهرة', phone: '0100', taxId: '310122393500003' },
	buyer: { name: 'العميل', address: '', phone: '', taxId: '' },
	number: 'INV-7',
	date: '2026-10-12',
	due: '',
	currency: 'SAR',
	vatRate: 15,
	discount: 100,
	lines: [
		{ desc: 'صيانة', qty: 2, price: 450 },
		{ desc: 'قطع غيار', qty: 1, price: 200.5 }
	],
	notes: '',
	zatcaQr: true,
	logo: '',
	accent: '#0f6e66'
};

/** Reads ZATCA TLV back: [tag, value] pairs. */
function tlv(b64: string) {
	const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
	const out: [number, string][] = [];
	for (let i = 0; i < bytes.length; ) {
		const tag = bytes[i];
		const len = bytes[i + 1];
		out.push([tag, new TextDecoder().decode(bytes.slice(i + 2, i + 2 + len))]);
		i += 2 + len;
	}
	return out;
}

describe('invoice', () => {
	it('adds up lines, discount and VAT', () => {
		expect(totals(base)).toEqual({ lines: [900, 200.5], subtotal: 1100.5, discount: 100, net: 1000.5, vat: 150.08, total: 1150.58 });
		expect(totals({ ...base, discount: 5000 }).net).toBe(0); // discount never goes below zero
	});

	it('ZATCA QR payload is TLV in base64 with UTF-8 Arabic', () => {
		const p = zatcaPayload('شركة النور', '310122393500003', '2026-10-12T12:00:00Z', 1150.58, 150.08);
		expect(tlv(p)).toEqual([
			[1, 'شركة النور'],
			[2, '310122393500003'],
			[3, '2026-10-12T12:00:00Z'],
			[4, '1150.58'],
			[5, '150.08']
		]);
		const long = tlv(zatcaPayload('ش'.repeat(300), '1', 't', 1, 0));
		expect(new TextEncoder().encode(long[0][1]).length).toBeLessThanOrEqual(255);
		expect(long[1]).toEqual([2, '1']);
	});

	it('escapes what people type and refuses remote logos', () => {
		const html = invoiceHtml(
			{ ...base, notes: '<script>alert(1)</script>', buyer: { ...base.buyer, name: '<img src=x onerror=alert(1)>' }, logo: 'https://evil.example/x.png', accent: 'red;}</style><script>' },
			''
		);
		expect(html).not.toContain('<script>');
		expect(html).not.toContain('<img src=x');
		expect(html).not.toContain('evil.example');
		expect(html).toContain('&lt;script&gt;');
		expect(html).toContain('فاتورة ضريبية');
		expect(html).toContain('<svg'); // the QR
		expect(html).toContain('ريال');
	});

	it('no VAT: a plain invoice without the VAT line or QR', () => {
		const html = invoiceHtml({ ...base, vatRate: 0 }, '');
		expect(html).toContain('<h1>فاتورة</h1>');
		expect(html).not.toContain('<svg');
	});
});
