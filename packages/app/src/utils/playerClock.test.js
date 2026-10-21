import {playerClockStale, playerClockWanted} from './playerClock';

// The same on every performance level: Ultra felt a key press wait behind the redraws that Medium never made.
describe('playerClockWanted', () => {
	const hidden = {controlsVisible: false, activeModal: null, isAudioMode: false};

	it('skips the redraw while nothing shows the time', () => {
		expect(playerClockWanted(hidden)).toBe(false);
		// a level that is passed in changes nothing
		expect(playerClockWanted({...hidden, tier: 'high'})).toBe(false);
		expect(playerClockWanted({...hidden, tier: 'low'})).toBe(false);
	});

	it('redraws for the controls, a modal, or a song', () => {
		expect(playerClockWanted({...hidden, controlsVisible: true})).toBe(true);
		expect(playerClockWanted({...hidden, activeModal: 'chapters'})).toBe(true);
		expect(playerClockWanted({...hidden, isAudioMode: true})).toBe(true);
	});
});

describe('playerClockStale', () => {
	it('waits for the next whole second', () => {
		expect(playerClockStale({time: 10.6, shownSecond: 10})).toBe(false);
		expect(playerClockStale({time: 11.1, shownSecond: 10})).toBe(true);
		expect(playerClockStale({time: 3, shownSecond: -1})).toBe(true);
		expect(playerClockStale({time: 10.2, shownSecond: 10, tier: 'high'})).toBe(false);
	});

	it('follows a song more closely, for its lyrics', () => {
		expect(playerClockStale({time: 10.6, shownSecond: 10, isAudioMode: true})).toBe(true);
	});
});
