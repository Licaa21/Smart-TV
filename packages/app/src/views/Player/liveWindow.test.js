import {isAtLive, liveWindowFor, nextLiveWindow} from './liveWindow';

describe('liveWindowFor', () => {
	it('puts the live point as far behind the end as playback started', () => {
		expect(liveWindowFor({start: 0, end: 90}, 14)).toEqual({start: 0, edge: 76});
	});

	it('stays away until the stream keeps a minute and until playback has started', () => {
		expect(liveWindowFor({start: 0, end: 70}, 14)).toBeNull();
		expect(liveWindowFor({start: 0, end: 90}, null)).toBeNull();
		expect(liveWindowFor(null, 14)).toBeNull();
	});
});

describe('nextLiveWindow', () => {
	it('keeps the old window when nothing moved and takes the new one otherwise', () => {
		const held = {start: 0, edge: 76};
		expect(nextLiveWindow(held, {start: 0, edge: 76})).toBe(held);
		expect(nextLiveWindow(held, {start: 0, edge: 79})).toEqual({start: 0, edge: 79});
		expect(nextLiveWindow(held, null)).toBeNull();
	});
});

describe('isAtLive', () => {
	it('counts ten seconds behind the live point as live', () => {
		const liveWindow = {start: 0, edge: 100};
		expect(isAtLive(liveWindow, 90)).toBe(true);
		expect(isAtLive(liveWindow, 89)).toBe(false);
		expect(isAtLive(null, 0)).toBe(true);
	});
});
