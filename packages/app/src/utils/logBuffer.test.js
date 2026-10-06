import {persistableLines, restoreLines, trimLogBuffer} from './logBuffer';

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

describe('keeping the report across a restart', () => {
	test('persists only the lines that are not requests, without the device block', () => {
		const line = (n, extra = {}) => ({timestamp: `t${n}`, level: 'Information', category: 'Playback', message: `m${n}`, context: {}, ...extra});
		const buffer = [request(1), line(2, {device: {big: 'block'}}), request(3), line(4)];
		const kept = persistableLines(buffer, 10, isRequestLine);
		expect(kept.map((e) => e.message)).toEqual(['m2', 'm4']);
		expect(kept.every((e) => !('device' in e))).toBe(true);
	});

	test('keeps only the last lines when there are many', () => {
		const buffer = Array.from({length: 8}, (_, i) => ({...other(i), message: `m${i}`, timestamp: `t${i}`}));
		expect(persistableLines(buffer, 3, isRequestLine).map((e) => e.message)).toEqual(['m5', 'm6', 'm7']);
	});

	test('brings the lines back marked as from the previous run', () => {
		const raw = JSON.stringify([{timestamp: 't1', level: 'Information', category: 'Playback', message: 'a', context: {x: 1}}]);
		expect(restoreLines(raw)).toEqual([{timestamp: 't1', level: 'Information', category: 'Playback', message: 'a', context: {x: 1, previousRun: true}}]);
	});

	test('survives storage that is empty or broken', () => {
		expect(restoreLines(null)).toEqual([]);
		expect(restoreLines('not json')).toEqual([]);
		expect(restoreLines('{"a":1}')).toEqual([]);
		expect(restoreLines(JSON.stringify([{foo: 1}]))).toEqual([]);
	});
});
