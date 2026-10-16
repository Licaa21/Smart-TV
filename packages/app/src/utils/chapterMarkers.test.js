import {chapterMarkerPositions, chapterStep} from './chapterMarkers';

const chapters = (startsMs) => startsMs.map((ms) => ({name: 'Chapter', startPositionTicks: ms * 10000}));

test('keeps the starts that fall inside the runtime, in order', () => {
	expect(chapterMarkerPositions(chapters([90000, 30000, 60000]), 120000)).toEqual([30000, 60000, 90000]);
});

test('drops a start at zero, at the runtime, or past it', () => {
	expect(chapterMarkerPositions(chapters([0, 30000, 120000, 130000]), 120000)).toEqual([30000]);
});

test('collapses duplicate starts', () => {
	expect(chapterMarkerPositions(chapters([30000, 30000, 60000]), 120000)).toEqual([30000, 60000]);
});

test('is empty without a runtime to place marks against', () => {
	expect(chapterMarkerPositions(chapters([30000]), 0)).toEqual([]);
	expect(chapterMarkerPositions(chapters([30000]), -1)).toEqual([]);
});

test('is empty when the item has no chapters', () => {
	expect(chapterMarkerPositions([], 120000)).toEqual([]);
});

test('skips an entry with no usable start', () => {
	expect(chapterMarkerPositions([
		{name: 'Chapter'},
		{name: 'Chapter', startPositionTicks: 'nope'},
		{name: 'Chapter', startPositionTicks: 30000 * 10000}
	], 120000)).toEqual([30000]);
});

describe('chapterStep', () => {
	const SECOND = 10000000;
	const marks = chapters([0, 600000, 1200000]);

	test('Up goes to the next chapter, then past the last one to whatever follows', () => {
		expect(chapterStep(marks, 300 * SECOND, 1)).toBe(600 * SECOND);
		expect(chapterStep(marks, 1300 * SECOND, 1)).toBeNull();
	});

	test('a jump that landed on the keyframe just before a chapter counts as that chapter', () => {
		expect(chapterStep(marks, 599.5 * SECOND, 1)).toBe(1200 * SECOND);
		expect(chapterStep(marks, 599.5 * SECOND, -1)).toBe(0);
	});

	test('Down goes back to the start of this chapter, or the one before once it has just begun', () => {
		expect(chapterStep(marks, 700 * SECOND, -1)).toBe(600 * SECOND);
		expect(chapterStep(marks, 601 * SECOND, -1)).toBe(0);
		expect(chapterStep(marks, 2 * SECOND, -1)).toBeNull();
	});

	test('without chapters the whole item is one chapter', () => {
		expect(chapterStep([], 300 * SECOND, 1)).toBeNull();
		expect(chapterStep([], 300 * SECOND, -1)).toBe(0);
		expect(chapterStep(null, 1 * SECOND, -1)).toBeNull();
	});
});
