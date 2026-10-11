import { describe, expect, it } from 'vitest';
import { bookletOrder } from '../../src/lib/adapters/pdf/layout';

describe('booklet order (saddle stitch)', () => {
	it('8 pages, left binding', () => {
		expect(bookletOrder(8, false)).toEqual([[7, 0], [1, 6], [5, 2], [3, 4]]);
	});
	it('right binding (Arabic) mirrors each side', () => {
		expect(bookletOrder(4, true)).toEqual([[0, 3], [2, 1]]);
	});
	it('every page appears exactly once', () => {
		const pages = bookletOrder(16, false).flat().sort((a, b) => a - b);
		expect(pages).toEqual(Array.from({ length: 16 }, (_, i) => i));
	});
});
