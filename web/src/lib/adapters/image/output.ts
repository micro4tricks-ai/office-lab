import type { FileData, NoteKey } from '../../registry/types';
import { MIME, rename, type OutFormat } from './formats';

export const output = (inputName: string, format: OutFormat, bytes: Uint8Array, note?: NoteKey): FileData => ({
	name: rename(inputName, format),
	type: MIME[format],
	bytes,
	...(note ? { note } : {})
});

/** Quality option (1–100 in the UI) → 0–1. */
export const quality = (v: unknown, fallback = 82) => (Number(v) || fallback) / 100;
