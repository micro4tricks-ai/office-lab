import { describe, expect, it } from 'vitest';
import { formatTime, parseTime, splitName } from '../../src/lib/adapters/media/time';
import { planFrom } from '../../src/lib/adapters/media/convert';

describe('media times', () => {
	it('reads seconds, m:ss, h:mm:ss, Arabic digits and decimal commas', () => {
		expect(parseTime('75')).toBe(75);
		expect(parseTime('1:15')).toBe(75);
		expect(parseTime('01:01:15.5')).toBe(3675.5);
		expect(parseTime('١:٣٠')).toBe(90);
		expect(parseTime('2,5')).toBe(2.5);
		expect(parseTime('  ')).toBeNull();
		expect(parseTime('abc')).toBeNaN();
		expect(parseTime('1:2:3:4')).toBeNaN();
	});

	it('formats times and splits names', () => {
		expect(formatTime(83.5)).toBe('1:23.5');
		expect(formatTime(5)).toBe('0:05');
		expect(splitName('Clip.MOV')).toEqual(['Clip', 'mov']);
		expect(splitName('noext')).toEqual(['noext', '']);
	});

	it('turns options into a plan and refuses an end before the start', () => {
		expect(planFrom({ to: 'mp3', kbps: '192', start: '0:10', end: '' })).toMatchObject({ to: 'mp3', kbps: 192, start: 10, end: undefined });
		expect(planFrom({ to: 'same', quality: 'low', height: '720', mute: true })).toMatchObject({ quality: 'low', height: 720, mute: true });
		expect(() => planFrom({ start: '0:20', end: '0:10' })).toThrow();
		expect(() => planFrom({ start: 'soon' })).toThrow();
	});
});
