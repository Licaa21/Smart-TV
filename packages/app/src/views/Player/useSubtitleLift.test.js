import {subtitleLiftFor} from './useSubtitleLift';

describe('subtitleLiftFor', () => {
	it('is zero when nothing is in the way', () => {
		expect(subtitleLiftFor(972, [])).toBe(0);
		expect(subtitleLiftFor(972, [null])).toBe(0);
	});

	it('lifts the subtitles to the top of what covers them', () => {
		expect(subtitleLiftFor(972, [900])).toBe(72);
	});

	it('clears the highest of several', () => {
		expect(subtitleLiftFor(972, [900, 700])).toBe(272);
	});

	it('leaves subtitles that already rest above it', () => {
		expect(subtitleLiftFor(500, [900])).toBe(0);
	});
});
