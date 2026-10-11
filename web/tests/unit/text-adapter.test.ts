import { describe, expect, it } from 'vitest';
import text from '../../src/lib/adapters/text';

const enc = (s: string) => new TextEncoder().encode(s);

describe('text adapter', () => {
	it('wraps paragraphs, escapes HTML and keeps Arabic', async () => {
		const [out] = await text.convert(
			{ name: 'note.txt', type: 'text/plain', bytes: enc('مرحبا\nسطر\n\n<b>hi</b>') },
			{ dir: 'rtl' }
		);
		const html = new TextDecoder().decode(out.bytes);
		expect(out.name).toBe('note.html');
		expect(html).toContain('<html dir="rtl">');
		expect(html).toContain('<p dir="auto">مرحبا<br>سطر</p>');
		expect(html).toContain('&lt;b&gt;hi&lt;/b&gt;');
	});

	it('rejects non-UTF-8 input as corrupted', async () => {
		const bad = new Uint8Array([0xff, 0xfe, 0xfd]);
		await expect(text.convert({ name: 'x.txt', type: '', bytes: bad }, {})).rejects.toHaveProperty(
			'code',
			'corrupted'
		);
	});
});
