import { readFileSync, writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { formatsMarkdown } from '../../src/lib/registry/formats';

const FILE = '../docs/FORMATS.md';

it('docs/FORMATS.md matches the registry (UPDATE_FORMATS=1 rewrites it)', () => {
	const md = formatsMarkdown();
	if (process.env.UPDATE_FORMATS) writeFileSync(FILE, md);
	expect(readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n')).toBe(md);
});
