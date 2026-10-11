import type { PDFDocument, PDFField } from '@cantoo/pdf-lib';
import { ConvertError, type Adapter, type FormValues } from '../../registry/types';
import { isArabic, textToPng } from '../text-image';
import { loadPdf, pdfLib, pdfOut } from './lib';

export type FieldInfo = {
	name: string;
	type: 'text' | 'checkbox' | 'dropdown' | 'radio' | 'list' | 'other';
	value: string | boolean;
	options?: string[];
	multiline?: boolean;
};

async function describe(doc: PDFDocument): Promise<FieldInfo[]> {
	const lib = await pdfLib();
	return doc.getForm().getFields().map((f): FieldInfo => {
		const name = f.getName();
		if (f instanceof lib.PDFTextField) return { name, type: 'text', value: f.getText() ?? '', multiline: f.isMultiline() };
		if (f instanceof lib.PDFCheckBox) return { name, type: 'checkbox', value: f.isChecked() };
		if (f instanceof lib.PDFDropdown) return { name, type: 'dropdown', value: f.getSelected()[0] ?? '', options: f.getOptions() };
		if (f instanceof lib.PDFOptionList) return { name, type: 'list', value: f.getSelected()[0] ?? '', options: f.getOptions() };
		if (f instanceof lib.PDFRadioGroup) return { name, type: 'radio', value: f.getSelected() ?? '', options: f.getOptions() };
		return { name, type: 'other', value: '' };
	});
}

/**
 * Can pdf-lib's standard font draw this text? Only Latin-1 (WinAnsi). It does not throw on
 * Arabic — it silently writes "?" — so check the characters instead of trying.
 */
const encodable = (text: string) => /^[\x20-\x7E\xA0-\xFF\n\r\t]*$/.test(text);

/** Draws a field's value as a shaped image inside each of its boxes (used when flattening). */
async function drawValue(doc: PDFDocument, field: PDFField, text: string) {
	for (const widget of field.acroField.getWidgets()) {
		const ref = doc.context.getObjectRef(widget.dict);
		const page = ref ? doc.findPageForAnnotationRef(ref) : undefined;
		if (!page) continue;
		const r = widget.getRectangle();
		const pt = Math.min(12, r.height * 0.62);
		const png = await textToPng(text, { px: pt * 4, color: '#000000', weight: 500 });
		const img = await doc.embedPng(png.png);
		let w = png.width / 4;
		let h = png.height / 4;
		const fit = Math.min(1, (r.width - 4) / w);
		w *= fit;
		h *= fit;
		const x = isArabic(text) ? r.x + r.width - w - 2 : r.x + 2;
		page.drawImage(img, { x, y: r.y + (r.height - h) / 2, width: w, height: h });
	}
}

/**
 * Lists form fields (params.action = 'fields', returns JSON) or fills them from options.fields,
 * optionally flattening so the values can no longer be edited.
 */
const adapter: Adapter = {
	async convert(input, options) {
		const doc = await loadPdf(input);
		if (options.action === 'fields') {
			const fields = await describe(doc);
			return [{ name: 'fields.json', type: 'application/json', bytes: new TextEncoder().encode(JSON.stringify(fields)) }];
		}
		const lib = await pdfLib();
		const form = doc.getForm();
		const fields = form.getFields();
		if (!fields.length) throw new ConvertError('nothing');
		const values = (options.fields ?? {}) as FormValues;
		const flatten = options.flatten === true;
		const font = await doc.embedFont(lib.StandardFonts.Helvetica);
		const needsViewer: string[] = [];

		for (const f of fields) {
			const v = values[f.getName()];
			if (v === undefined) continue;
			if (f instanceof lib.PDFCheckBox) {
				if (v === true) f.check();
				else f.uncheck();
				continue;
			}
			const text = String(v);
			if (f instanceof lib.PDFRadioGroup) {
				if (text) f.select(text);
				continue;
			}
			const native = encodable(text);
			if (flatten && !native) {
				// pdf-lib can't shape Arabic: draw it ourselves, then drop the field.
				await drawValue(doc, f, text);
				form.removeField(f);
				continue;
			}
			if (f instanceof lib.PDFTextField) f.setText(text);
			else if (f instanceof lib.PDFDropdown || f instanceof lib.PDFOptionList) {
				if (text) f.select(text);
			}
			if (native) f.defaultUpdateAppearances(font);
			else needsViewer.push(f.getName());
		}

		if (flatten) {
			form.flatten({ updateFieldAppearances: false });
		} else if (needsViewer.length) {
			// Ask the viewer to draw these values itself (it can shape Arabic; pdf-lib can't).
			form.acroForm.dict.set(lib.PDFName.of('NeedAppearances'), lib.PDFBool.True);
		}
		doc.setProducer('Office Lab');
		return [pdfOut(input.name, await doc.save({ useObjectStreams: true, updateFieldAppearances: false }))];
	}
};

export default adapter;
