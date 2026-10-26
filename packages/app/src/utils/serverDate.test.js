import {parseServerDate} from './serverDate';

describe('parseServerDate', () => {
	test('reads a date the server sent', () => {
		expect(parseServerDate('2026-10-25T18:30:00.0000000Z').toISOString()).toBe('2026-10-25T18:30:00.000Z');
	});

	test(".NET's minimum date, a blank and junk are no date", () => {
		expect(parseServerDate('0001-01-01T00:00:00.0000000Z')).toBeNull();
		expect(parseServerDate('0001-01-01T00:00:00')).toBeNull();
		expect(parseServerDate('')).toBeNull();
		expect(parseServerDate(null)).toBeNull();
		expect(parseServerDate('not a date')).toBeNull();
	});
});
