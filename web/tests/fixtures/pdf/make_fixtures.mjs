// Regenerates the PDF fixtures (each well under 50 KB). Run from web/: node tests/fixtures/pdf/make_fixtures.mjs
// photo-src.jpg (the photo inside photo.pdf) is a committed fixture too.
import { degrees, PDFDocument, StandardFonts, rgb } from '@cantoo/pdf-lib';
import { readFileSync, writeFileSync } from 'node:fs';

const here = new URL('.', import.meta.url);
const out = (name, bytes) => writeFileSync(new URL(name, here), bytes);

async function textDoc(sentences, { rotateSecond = false } = {}) {
	const doc = await PDFDocument.create();
	const font = await doc.embedFont(StandardFonts.Helvetica);
	sentences.forEach((s, i) => {
		const page = doc.addPage([595, 842]);
		page.drawText(`Page ${i + 1}`, { x: 60, y: 760, size: 28, font, color: rgb(0.06, 0.43, 0.4) });
		page.drawText(s, { x: 60, y: 700, size: 14, font });
		if (rotateSecond && i === 1) page.setRotation(degrees(90));
	});
	doc.setTitle('Fixture document');
	doc.setAuthor('Fixture Author');
	return doc;
}

const base = ['The quick brown fox jumps over the lazy dog.', 'Invoice total is 1500 pounds.', 'Signed in Cairo.'];
out('text3.pdf', await (await textDoc(base, { rotateSecond: true })).save());
out('text3-changed.pdf', await (await textDoc([base[0], 'Invoice total is 1750 pounds.', base[2]])).save());

const locked = await textDoc(['This file is locked.']);
locked.encrypt({ userPassword: '1234', ownerPassword: 'owner-secret' });
out('locked.pdf', await locked.save());

const photo = await PDFDocument.create();
const jpg = await photo.embedJpg(readFileSync(new URL('photo-src.jpg', here)));
photo.addPage([720, 540]).drawImage(jpg, { x: 0, y: 0, width: 720, height: 540 });
out('photo.pdf', await photo.save());

const formDoc = await PDFDocument.create();
const formFont = await formDoc.embedFont(StandardFonts.Helvetica);
const fp = formDoc.addPage([595, 842]);
const form = formDoc.getForm();
fp.drawText('Request form', { x: 60, y: 770, size: 22, font: formFont });
[['Name', 700], ['City', 650]].forEach(([label, y]) => fp.drawText(label, { x: 60, y: y + 8, size: 12, font: formFont }));
form.createTextField('name').addToPage(fp, { x: 140, y: 695, width: 300, height: 26 });
form.createTextField('city').addToPage(fp, { x: 140, y: 645, width: 300, height: 26 });
fp.drawText('I agree', { x: 90, y: 605, size: 12, font: formFont });
form.createCheckBox('agree').addToPage(fp, { x: 60, y: 600, width: 18, height: 18 });
const kind = form.createDropdown('kind');
kind.addOptions(['Contract', 'Visit', 'Report']);
kind.addToPage(fp, { x: 140, y: 555, width: 200, height: 26 });
out('form.pdf', await formDoc.save());

console.log('PDF fixtures written');
