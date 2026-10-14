import {playerClockStale, playerClockWanted} from './playerClock';

describe('playerClockWanted', () => {
	const hidden = {controlsVisible: false, activeModal: null, isAudioMode: false};

	it('always redraws on a fast set', () => {
		expect(playerClockWanted({...hidden, tier: 'high'})).toBe(true);
	});

	it('skips the redraw on a slow set while nothing shows the time', () => {
		expect(playerClockWanted({...hidden, tier: 'mid'})).toBe(false);
		expect(playerClockWanted({...hidden, tier: 'low'})).toBe(false);
	});

	it('redraws for the controls, a modal, or a song', () => {
		expect(playerClockWanted({...hidden, tier: 'mid', controlsVisible: true})).toBe(true);
		expect(playerClockWanted({...hidden, tier: 'mid', activeModal: 'chapters'})).toBe(true);
		expect(playerClockWanted({...hidden, tier: 'low', isAudioMode: true})).toBe(true);
	});
});

describe('playerClockStale', () => {
	it('is always stale on a fast set', () => {
		expect(playerClockStale({tier: 'high', time: 10.2, shownSecond: 10})).toBe(true);
	});

	it('waits for the next whole second on a slow one', () => {
		expect(playerClockStale({tier: 'mid', time: 10.6, shownSecond: 10})).toBe(false);
		expect(playerClockStale({tier: 'low', time: 11.1, shownSecond: 10})).toBe(true);
		expect(playerClockStale({tier: 'low', time: 3, shownSecond: -1})).toBe(true);
		expect(playerClockStale({tier: 'low', time: 10.6, shownSecond: 10, isAudioMode: true})).toBe(true);
	});
});
