import {renderHook, act} from '@testing-library/react';

import useAudioTransport from './useAudioTransport';
import {handleAudioFocusKey, nextAudioFocusRow} from './audioFocus';

jest.mock('@enact/spotlight', () => ({focus: jest.fn()}));
jest.mock('../../../services/playback', () => ({reportStop: jest.fn()}));

describe('nextAudioFocusRow', () => {
	test('up walks from the dock to the seekbar and on into the panel', () => {
		expect(nextAudioFocusRow('bottom', 'up')).toBe('progress');
		expect(nextAudioFocusRow('progress', 'up')).toBe('panel');
	});

	test('down walks back to the dock and stops there', () => {
		expect(nextAudioFocusRow('progress', 'down')).toBe('bottom');
		expect(nextAudioFocusRow('bottom', 'down')).toBe('bottom');
	});
});

describe('useAudioTransport panel toggles', () => {
	beforeEach(() => {
		jest.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);
	});

	afterEach(() => jest.restoreAllMocks());

	const setup = (hasLyrics) => {
		const setFocusRow = jest.fn();
		const {result} = renderHook(() => useAudioTransport({
			item: {Id: 'a'},
			audioPlaylist: [{Id: 'a'}, {Id: 'b'}],
			isAudioMode: true,
			positionRef: {current: 0},
			setFocusRow,
			hasLyrics
		}));
		return {result, setFocusRow};
	};

	test('lyrics lead when the track has them, and Up Next stands in when it has none', () => {
		expect(setup(true).result.current.audioPanel).toBe('lyrics');
		expect(setup(false).result.current.audioPanel).toBe('queue');
	});

	test('the other toggle swaps the panel and the one showing walks into it', () => {
		const {result, setFocusRow} = setup(true);
		act(() => result.current.handleSelectAudioPanel('queue'));
		expect(result.current.audioPanel).toBe('queue');
		expect(setFocusRow).not.toHaveBeenCalled();

		act(() => result.current.handleSelectAudioPanel('queue'));
		expect(setFocusRow).toHaveBeenCalledWith('panel');
	});

	test('Up Next walks straight in when there are no lyrics to swap from', () => {
		const {result, setFocusRow} = setup(false);
		act(() => result.current.handleSelectAudioPanel('queue'));
		expect(setFocusRow).toHaveBeenCalledWith('panel');
	});
});

describe('the queue the panel lists', () => {
	const playlist = [{Id: 'a'}, {Id: 'b'}, {Id: 'c'}, {Id: 'd'}];
	const setup = () => renderHook(() => useAudioTransport({
		item: {Id: 'c'},
		audioPlaylist: playlist,
		isAudioMode: true,
		positionRef: {current: 0},
		setFocusRow: jest.fn(),
		hasLyrics: false
	})).result;

	test('lists every track, the played ones included', () => {
		expect(setup().current.queueTracks.map((t) => t.Id)).toEqual(['a', 'b', 'c', 'd']);
	});

	test('a shuffle puts the playing track first and keeps every track', () => {
		const result = setup();
		act(() => result.current.setShuffleMode(true));
		const ids = result.current.queueTracks.map((t) => t.Id);
		expect(ids[0]).toBe('c');
		expect([...ids].sort()).toEqual(['a', 'b', 'c', 'd']);
	});
});

describe('handleAudioFocusKey in the panel', () => {
	afterEach(() => {
		document.body.innerHTML = '';
	});

	const press = (keyCode, focusIndex) => {
		document.body.innerHTML = '<div data-spotlight-id="audio-panel"><div class="spottable" tabindex="0"></div><div class="spottable" tabindex="0"></div></div>';
		document.querySelectorAll('.spottable')[focusIndex].focus();
		const setFocusRow = jest.fn();
		handleAudioFocusKey({keyCode, preventDefault: jest.fn()}, {focusRow: 'panel', setFocusRow, showControls: jest.fn()});
		return setFocusRow;
	};

	test('down past the last row leaves for the seekbar', () => {
		expect(press(40, 1)).toHaveBeenCalledWith('progress');
	});

	test('down from an earlier row stays in the panel', () => {
		expect(press(40, 0)).not.toHaveBeenCalled();
	});
});

describe('handleAudioFocusKey on the dock', () => {
	test('down has nowhere to go, so it leaves focus alone', () => {
		const setFocusRow = jest.fn();
		expect(handleAudioFocusKey({keyCode: 40, preventDefault: jest.fn()}, {focusRow: 'bottom', setFocusRow, showControls: jest.fn()})).toBe(true);
		expect(setFocusRow).not.toHaveBeenCalled();
	});
});
