import { CURRENCIES, tafqeet, tafqeetEnglish } from './tafqeet';
import { makeQr, qrSvg } from './qr';

export type Party = { name: string; address: string; phone: string; taxId: string };
export type Line = { desc: string; qty: number; price: number };
export type Invoice = {
	seller: Party;
	buyer: Party;
	number: string;
	date: string; // yyyy-mm-dd
	due: string;
	currency: string;
	vatRate: number; // percent
	discount: number; // amount, before VAT
	lines: Line[];
	notes: string;
	/** Saudi ZATCA (Fatoora) QR on simplified tax invoices. */
	zatcaQr: boolean;
	logo: string; // data: URL or ''
	accent: string;
};

/** Half-up to 2 decimals without float drift (150.075 → 150.08, not 150.07). */
const round2 = (n: number) => {
	const r = Number(`${Math.round(Number(`${n}e2`))}e-2`);
	return Number.isFinite(r) ? r : Math.round(n * 100) / 100; // e.g. 1e-7 has no plain "e2" form
};

export function totals(inv: Invoice) {
	const lines = inv.lines.map((l) => round2((Number(l.qty) || 0) * (Number(l.price) || 0)));
	const subtotal = round2(lines.reduce((s, n) => s + n, 0));
	const discount = round2(Math.min(Math.max(0, Number(inv.discount) || 0), subtotal));
	const net = round2(subtotal - discount);
	const vat = round2((net * (Number(inv.vatRate) || 0)) / 100);
	return { lines, subtotal, discount, net, vat, total: round2(net + vat) };
}

/**
 * ZATCA phase-1 QR payload: TLV (tag, length, UTF-8 value) for seller name, VAT number,
 * timestamp, total with VAT and VAT amount, base64-encoded.
 */
export function zatcaPayload(seller: string, vatNumber: string, timestamp: string, total: number, vat: number): string {
	const enc = new TextEncoder();
	const parts: number[] = [];
	const values = [seller, vatNumber, timestamp, total.toFixed(2), vat.toFixed(2)];
	values.forEach((v, i) => {
		let bytes = enc.encode(v);
		// One length byte: cut on a character boundary if a name is very long.
		while (bytes.length > 255) bytes = enc.encode((v = [...v].slice(0, -1).join('')));
		parts.push(i + 1, bytes.length, ...bytes);
	});
	let bin = '';
	for (const b of parts) bin += String.fromCharCode(b);
	return btoa(bin);
}

const esc = (s: string) =>
	String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
/** Only real image data URLs for the logo (never a remote address). */
const safeLogo = (u: string) => (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(u) ? u : '');
const safeColor = (c: string) => (/^#[0-9a-fA-F]{6}$/.test(c) ? c : '#0f6e66');

/** The invoice as a printable A4 page (Arabic first, English labels beside). `fonts`: @font-face rules. */
export function invoiceHtml(inv: Invoice, fonts: string): string {
	const tt = totals(inv);
	const cur = CURRENCIES.find((c) => c.code === inv.currency) ?? null;
	const money = (n: number) => `${n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
	const taxInvoice = (Number(inv.vatRate) || 0) > 0;
	const accent = safeColor(inv.accent);
	const logo = safeLogo(inv.logo);
	const party = (p: Party, title: string) => `
		<div class="party"><h3>${title}</h3>
			<p class="pname">${esc(p.name) || '—'}</p>
			${p.address ? `<p>${esc(p.address).replace(/\n/g, '<br>')}</p>` : ''}
			${p.phone ? `<p dir="ltr" class="ltr">${esc(p.phone)}</p>` : ''}
			${p.taxId ? `<p>الرقم الضريبي / VAT No.: <span dir="ltr">${esc(p.taxId)}</span></p>` : ''}
		</div>`;
	const rows = inv.lines
		.map(
			(l, i) => `<tr><td>${i + 1}</td><td class="desc">${esc(l.desc)}</td><td>${Number(l.qty) || 0}</td><td>${money(Number(l.price) || 0)}</td><td>${money(tt.lines[i])}</td></tr>`
		)
		.join('');
	let qr = '';
	if (inv.zatcaQr && taxInvoice) {
		const stamp = `${inv.date || new Date().toISOString().slice(0, 10)}T12:00:00Z`;
		qr = `<div class="qr">${qrSvg(makeQr(zatcaPayload(inv.seller.name, inv.seller.taxId, stamp, tt.total, tt.vat), 'M'))}</div>`;
	}
	const words = cur ? `${tafqeet(tt.total, cur)}<br><span dir="ltr" class="en">${esc(tafqeetEnglish(tt.total, cur))}</span>` : '';
	return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(inv.number ? `فاتورة ${inv.number}` : 'فاتورة')}</title>
<style>${fonts}
@page{size:A4;margin:14mm}
@media screen{body{padding:14mm}}
*{box-sizing:border-box}
body{margin:0;font-family:"Cairo Variable",sans-serif;color:#1d2321;font-size:10.5pt;line-height:1.6;background:#fff}
.top{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:3px solid ${accent};padding-bottom:10px}
.brand{display:flex;gap:12px;align-items:center}.brand img{max-height:70px;max-width:160px;object-fit:contain}
.brand .pname{font-size:15pt;font-weight:800;color:${accent};margin:0}
.title{text-align:left}.title h1{margin:0;font-size:18pt;color:${accent}}.title p{margin:2px 0}
.parties{display:flex;gap:16px;margin:14px 0}.party{flex:1;background:#f6f7f6;border-radius:8px;padding:10px 12px}
.party h3{margin:0 0 4px;font-size:9.5pt;color:#59625f}.party p{margin:0}.party .pname{font-weight:700}
table{width:100%;border-collapse:collapse;margin-top:6px}th{background:${accent};color:#fff;font-weight:600;font-size:9.5pt}
th,td{padding:7px 8px;text-align:center;border-bottom:1px solid #e3e3df}td.desc{text-align:right}
tbody tr:nth-child(even) td{background:#fafaf8}
.sum{display:flex;justify-content:space-between;gap:16px;margin-top:12px;align-items:flex-start}
.totals{min-width:260px}.totals div{display:flex;justify-content:space-between;padding:4px 8px}
.totals .grand{background:${accent};color:#fff;font-weight:800;border-radius:6px;font-size:12pt}
.words{margin-top:12px;padding:8px 12px;border-inline-start:4px solid ${accent};background:#f6f7f6}.words .en{font-size:9pt;color:#59625f}
.qr svg{width:110px;height:110px}.notes{margin-top:14px;white-space:pre-wrap}.ltr{text-align:right}
.sm{font-size:8.5pt;color:#59625f}
</style></head><body>
<div class="top">
	<div class="brand">${logo ? `<img src="${logo}" alt="">` : ''}<div><p class="pname">${esc(inv.seller.name)}</p>
		${inv.seller.address ? `<p class="sm">${esc(inv.seller.address).replace(/\n/g, ' · ')}</p>` : ''}
		${inv.seller.phone ? `<p class="sm" dir="ltr">${esc(inv.seller.phone)}</p>` : ''}
		${inv.seller.taxId ? `<p class="sm">الرقم الضريبي / VAT No.: <span dir="ltr">${esc(inv.seller.taxId)}</span></p>` : ''}</div></div>
	<div class="title"><h1>${taxInvoice ? 'فاتورة ضريبية' : 'فاتورة'}</h1><p class="sm">${taxInvoice ? 'Tax Invoice' : 'Invoice'}</p>
		${inv.number ? `<p>رقم / No.: <b dir="ltr">${esc(inv.number)}</b></p>` : ''}
		${inv.date ? `<p>التاريخ / Date: <span dir="ltr">${esc(inv.date)}</span></p>` : ''}
		${inv.due ? `<p>الاستحقاق / Due: <span dir="ltr">${esc(inv.due)}</span></p>` : ''}</div>
</div>
<div class="parties">${party(inv.buyer, 'العميل / Bill to')}</div>
<table><thead><tr><th>#</th><th>الوصف / Description</th><th>الكمية / Qty</th><th>السعر / Price</th><th>الإجمالي / Amount</th></tr></thead><tbody>${rows}</tbody></table>
<div class="sum">
	<div>${qr}</div>
	<div class="totals">
		<div><span>المجموع / Subtotal</span><span dir="ltr">${money(tt.subtotal)}</span></div>
		${tt.discount ? `<div><span>الخصم / Discount</span><span dir="ltr">− ${money(tt.discount)}</span></div>` : ''}
		${taxInvoice ? `<div><span>ضريبة القيمة المضافة ${Number(inv.vatRate)}% / VAT</span><span dir="ltr">${money(tt.vat)}</span></div>` : ''}
		<div class="grand"><span>الإجمالي / Total</span><span dir="ltr">${money(tt.total)} ${esc(inv.currency)}</span></div>
	</div>
</div>
${words ? `<div class="words">${words}</div>` : ''}
${inv.notes ? `<div class="notes">${esc(inv.notes)}</div>` : ''}
</body></html>`;
}
