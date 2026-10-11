// Regenerates the document fixtures. Run from web/: node tests/fixtures/doc/make_fixtures.mjs
import { AlignmentType, Document, HeadingLevel, ImageRun, Packer, Paragraph, Table, TableCell, TableRow, TextRun } from 'docx';
import { readFileSync, writeFileSync } from 'node:fs';

const here = new URL('.', import.meta.url);
const png = readFileSync(new URL('../images/alpha.png', here));
const rtl = (text, opts = {}) => new Paragraph({ bidirectional: true, alignment: AlignmentType.RIGHT, ...opts, children: [new TextRun({ text, rightToLeft: true, ...(opts.run ?? {}) })] });

const doc = new Document({
	sections: [{
		children: [
			new Paragraph({ heading: HeadingLevel.HEADING_1, bidirectional: true, children: [new TextRun({ text: 'تقرير الزيارة', rightToLeft: true })] }),
			rtl('تمت زيارة الموقع وفحص المعدات.', { run: { bold: true } }),
			new Paragraph({ text: 'Filter replaced', bullet: { level: 0 } }),
			new Paragraph({ text: 'Belt checked', bullet: { level: 0 } }),
			new Table({ rows: [
				new TableRow({ children: [new TableCell({ children: [new Paragraph('البند')] }), new TableCell({ children: [new Paragraph('الحالة')] })] }),
				new TableRow({ children: [new TableCell({ children: [new Paragraph('الفلتر')] }), new TableCell({ children: [new Paragraph('تم التغيير')] })] })
			] }),
			new Paragraph({ children: [new ImageRun({ type: 'png', data: png, transformation: { width: 64, height: 48 } })] })
		]
	}]
});
writeFileSync(new URL('report.docx', here), await Packer.toBuffer(doc));
console.log('doc fixtures written');
