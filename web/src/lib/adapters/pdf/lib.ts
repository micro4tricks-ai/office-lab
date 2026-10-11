import type { PDFDocument } from '@cantoo/pdf-lib';
import { ConvertError, type FileData } from '../../registry/types';

export const pdfLib = () => import('@cantoo/pdf-lib');

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Opens a PDF with pdf-lib. "Restricted" PDFs (owner password only) open with an empty
 * user password; a real user password must be given, or we report `password`.
 */
export async function loadPdf(file: FileData, password?: string): Promise<PDFDocument> {
	const { PDFDocument, EncryptedPDFError } = await pdfLib();
	const bytes = file.bytes;
	try {
		return await PDFDocument.load(bytes, { password: password || undefined, updateMetadata: false });
	} catch (e) {
		if (e instanceof EncryptedPDFError || /password/i.test(message(e))) {
			if (!password) {
				try {
					return await PDFDocument.load(bytes, { password: '', updateMetadata: false });
				} catch {
					/* needs a real password */
				}
			}
			throw new ConvertError('password');
		}
		throw new ConvertError('corrupted', message(e));
	}
}

export async function savePdf(doc: PDFDocument): Promise<Uint8Array> {
	doc.setProducer('Office Lab');
	return doc.save({ useObjectStreams: true });
}

export const pdfOut = (name: string, bytes: Uint8Array): FileData => ({ name, type: 'application/pdf', bytes });

/** "report.pdf" + "-2" → "report-2.pdf". */
export const withSuffix = (name: string, suffix: string, ext = 'pdf') =>
	name.replace(/\.[^.]+$/, '') + suffix + '.' + ext;

/** A new document with the given pages of `src` (0-based), in order. */
export async function pickPages(src: PDFDocument, indexes: number[]): Promise<PDFDocument> {
	const { PDFDocument } = await pdfLib();
	const out = await PDFDocument.create();
	const pages = await out.copyPages(src, indexes);
	for (const p of pages) out.addPage(p);
	return out;
}

/** Throws a friendly error for an empty or out-of-range page list. */
export function requirePages(indexes: number[], count: number) {
	if (!indexes.length || indexes.some((i) => i < 0 || i >= count)) throw new ConvertError('pages');
}
