import {trimLogBuffer} from './logBuffer';

const request = (n) => ({category: 'Network', level: 'Debug', n});
const other = (n) => ({category: 'Playback', level: 'Information', n});
const isRequestLine = (entry) => entry.category === 'Network' && entry.level === 'Debug';

describe('trimLogBuffer', () => {
	test('drops the oldest request line before anything else', () => {
		const buffer = [other(1), request(2), other(3), request(4)];
		expect(trimLogBuffer(buffer, 3, isRequestLine).map((e) => e.n)).toEqual([1, 3, 4]);
	});

	test('keeps playback lines while there are request lines to give up', () => {
		const buffer = [other(1), ...Array.from({length: 10}, (_, i) => request(i + 2))];
		trimLogBuffer(buffer, 5, isRequestLine);
		expect(buffer[0]).toEqual(other(1));
		expect(buffer).toHaveLength(5);
	});

	test('falls back to the oldest line when nothing is a request', () => {
		const buffer = [other(1), other(2), other(3)];
		expect(trimLogBuffer(buffer, 2, isRequestLine).map((e) => e.n)).toEqual([2, 3]);
	});

	test('leaves a buffer that fits alone', () => {
		const buffer = [request(1), other(2)];
		expect(trimLogBuffer(buffer, 5, isRequestLine)).toEqual([request(1), other(2)]);
	});
});
