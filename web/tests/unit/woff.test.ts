import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import fontkit from '@pdf-lib/fontkit';
import { woffToSfnt } from '../../src/lib/adapters/pdf/woff';

it('turns the Amiri WOFF into a TrueType font that keeps every glyph', () => {
	const woff = new Uint8Array(readFileSync('node_modules/@fontsource/amiri/files/amiri-arabic-400-normal.woff'));
	const ttf = woffToSfnt(woff);
	expect(new DataView(ttf.buffer).getUint32(0)).toBe(0x00010000);
	const a = fontkit.create(woff as Buffer);
	const b = fontkit.create(ttf as Buffer);
	expect(b.numGlyphs).toBe(a.numGlyphs);
	expect(b.hasGlyphForCodePoint(0x0645)).toBe(true); // م
	expect(woffToSfnt(ttf)).toBe(ttf); // already TrueType: unchanged
});
