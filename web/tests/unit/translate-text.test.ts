import { describe, expect, it } from 'vitest';
import { fixNumbers, preEdit, splitSentences, translatable } from '../../src/lib/translate/text';

describe('translation helpers', () => {
	it('splits paragraphs into sentences, Arabic punctuation too', () => {
		expect(splitSentences('First one. Second one? Third!')).toEqual(['First one.', 'Second one?', 'Third!']);
		expect(splitSentences('جملة أولى؟ جملة ثانية؛ ثالثة.')).toEqual(['جملة أولى؟', 'جملة ثانية؛', 'ثالثة.']);
		expect(splitSentences('  ')).toEqual([]);
		expect(splitSentences('x'.repeat(900), 400).map((s) => s.length)).toEqual([400, 400, 100]);
	});

	it('puts numbers back when the model reverses their groups', () => {
		expect(fixNumbers('Total: 4,750 EGP', 'المجموع: 750 4 جنيه')).toBe('المجموع: 4,750 جنيه');
		expect(fixNumbers('Pay 1,200,000.50 now', 'ادفع 000 200 1.50 الآن')).toBe('ادفع 1,200,000.50 الآن');
		expect(fixNumbers('Room 12', 'الغرفة 12')).toBe('الغرفة 12');
	});

	it('spells out currency codes before English → Arabic', () => {
		expect(preEdit('4,750 EGP and 10 USD', 'en-ar')).toBe('4,750 Egyptian pounds and 10 US dollars');
		expect(preEdit('EGP', 'ar-en')).toBe('EGP');
	});

	it('skips what has nothing to translate', () => {
		for (const s of ['', '  ', '12,500', '—', 'https://example.com/x', 'a@b.co', '#']) expect(translatable(s), s).toBe(false);
		for (const s of ['Hello', 'مرحبا', 'Invoice 7']) expect(translatable(s), s).toBe(true);
	});
});
