import { describe, expect, it } from 'vitest';
import { chunks, digits, parseGroups, parsePages } from '../../src/lib/adapters/pdf/pages';

describe('parsePages', () => {
	it('reads ranges, single pages and open ends, in order', () => {
		expect(parsePages('1-3, 5, 8-', 10)).toEqual([0, 1, 2, 4, 7, 8, 9]);
		expect(parsePages('-2', 10)).toEqual([0, 1]);
		expect(parsePages('3-1', 10)).toEqual([2, 1, 0]);
		expect(parsePages('last', 4)).toEqual([3]);
		expect(parsePages('', 3)).toEqual([0, 1, 2]);
	});

	it('accepts Arabic digits and the Arabic comma', () => {
		expect(parsePages('١-٢، ٤', 5)).toEqual([0, 1, 3]);
	});

	it('clamps a range end, rejects pages past the end and nonsense', () => {
		expect(parsePages('9-20', 10)).toEqual([8, 9]);
		expect(() => parsePages('11', 10)).toThrow();
		expect(() => parsePages('12-14', 10)).toThrow();
		expect(() => parsePages('abc', 10)).toThrow();
		expect(() => parsePages('0', 10)).toThrow();
	});
});

describe('splitting helpers', () => {
	it('groups ranges and chunks', () => {
		expect(parseGroups('1-2, 3-4', 4)).toEqual([[0, 1], [2, 3]]);
		expect(chunks(7, 3)).toEqual([[0, 1, 2], [3, 4, 5], [6]]);
		expect(chunks(2, 0)).toEqual([[0], [1]]);
	});

	it('writes Arabic-Indic digits', () => {
		expect(digits(120, true)).toBe('١٢٠');
		expect(digits(7, false)).toBe('7');
	});
});
