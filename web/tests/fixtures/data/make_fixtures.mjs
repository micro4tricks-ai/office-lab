// Regenerates the data fixtures. Run from web/: node tests/fixtures/data/make_fixtures.mjs
import { writeFileSync } from 'node:fs';
import * as XLSX from 'xlsx';

const here = new URL('.', import.meta.url);
const out = (name, data) => writeFileSync(new URL(name, here), data);

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
	['العميل', 'المدينة', 'المبلغ'],
	['شركة النور', 'القاهرة', 1500],
	['مؤسسة الأمل', 'الإسكندرية', 2750.5],
	['Delta Co', 'Giza', 980]
]), 'Sales');
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Item', 'Qty'], ['Filter', 4], ['Belt', 2]]), 'Stock');
out('sales.xlsx', XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

// Arabic CSV the way old Excel saves it: Windows-1256, semicolons.
const csv = 'الاسم;الهاتف\r\nأحمد;0100\r\nسارة;0122\r\n';
const table = new Map();
const dec = new TextDecoder('windows-1256');
for (let b = 0; b < 256; b++) table.set(dec.decode(new Uint8Array([b])), b);
out('arabic-1256.csv', Uint8Array.from([...csv].map((ch) => table.get(ch) ?? 63)));

const obj = { company: 'المعمل', year: 2026, active: true, tags: ['pdf', 'images'], owner: { name: 'Office Lab', city: 'Cairo' } };
out('sample.json', JSON.stringify(obj, null, 2) + '\n');
out('sample.yaml', 'company: المعمل\nyear: 2026\nactive: true\ntags:\n  - pdf\n  - images\nowner:\n  name: Office Lab\n  city: Cairo\n');
out('sample.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<company year="2026"><name>المعمل</name><city>Cairo</city></company>\n');
out('sample.toml', 'company = "المعمل"\nyear = 2026\n\n[owner]\nname = "Office Lab"\n');
console.log('data fixtures written');
