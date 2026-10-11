import { describe, expect, it } from 'vitest';
import { safeEntryName } from '../../src/lib/zip-names';

describe('safeEntryName (zip-slip guard)', () => {
	it.each([
		['report-images/image-1.png', 'report-images/image-1.png'],
		['a/../../etc/passwd', 'a/etc/passwd'],
		['../../x.png', 'x.png'],
		['/abs/path.txt', 'abs/path.txt'],
		[String.raw`C:\Windows\evil.dll`, 'C_/Windows/evil.dll'],
		['./././', 'file'],
		['ok\u0000name.txt', 'okname.txt']
	])('%s → %s', (input, out) => {
		expect(safeEntryName(input)).toBe(out);
	});
});
