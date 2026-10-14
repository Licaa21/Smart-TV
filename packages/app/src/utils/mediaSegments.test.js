import {describeSegments, mergeOverlappingSegments} from './mediaSegments';

const S = 10000000;
const seg = (type, from, to) => ({type, start: from * S, end: to * S});

describe('mergeOverlappingSegments', () => {
	it('joins two intros that overlap into one that ends where the later one ends', () => {
		const merged = mergeOverlappingSegments([seg('intro', 10, 70), seg('intro', 40, 100)]);
		expect(merged).toEqual([seg('intro', 40, 100)]);
	});

	it('starts at the latest start, so no prompt shows before the intro has begun', () => {
		expect(mergeOverlappingSegments([seg('intro', 0, 80), seg('intro', 25, 90)])[0].start).toBe(25 * S);
	});

	it('leaves segments of different types, and ones that do not overlap, alone', () => {
		const list = [seg('intro', 10, 60), seg('recap', 0, 30), seg('intro', 1200, 1260), seg('outro', 1300, 1400)];
		expect(mergeOverlappingSegments(list).map((s) => s.type)).toEqual(['recap', 'intro', 'intro', 'outro']);
	});

	it('does not join segments that only touch', () => {
		expect(mergeOverlappingSegments([seg('intro', 10, 60), seg('intro', 60, 90)])).toHaveLength(2);
	});

	it('keeps a segment with no end as it is, and drops one with no start', () => {
		const open = {type: 'intro', start: 5 * S, end: null};
		expect(mergeOverlappingSegments([open, seg('intro', 0, 60), {type: 'intro', end: 5}])).toEqual([seg('intro', 0, 60), open]);
	});

	it('does not change what it was given', () => {
		const list = [seg('intro', 10, 70), seg('intro', 40, 100)];
		mergeOverlappingSegments(list);
		expect(list[0]).toEqual(seg('intro', 10, 70));
	});
});

describe('describeSegments', () => {
	it('reads in whole seconds', () => {
		expect(describeSegments([seg('intro', 12, 95), {type: 'outro', start: 1300 * S, end: null}])).toEqual(['intro 12-95', 'outro 1300-null']);
	});
});
