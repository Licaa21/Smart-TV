import {renderHook, act} from '@testing-library/react';

import useSegmentPopups from './useSegmentPopups';

const RUNTIME = 100 * 10000000;
const NEAR_END = 99 * 10000000;

const setup = () => {
	const onPlayNext = jest.fn();
	const onSeekToSegmentEnd = jest.fn();
	const {result} = renderHook(() => useSegmentPopups({
		mediaSegments: {list: [{type: 'intro', start: 0, end: 30 * 10000000}]},
		nextEpisode: {Id: 'next'},
		settings: {autoPlay: true, nextUpTimeout: 0, stillWatchingBehavior: 'short_', nextUpBehavior: 'extended', introAction: 'ask'},
		runTimeRef: {current: RUNTIME},
		activeModal: null,
		controlsVisible: false,
		hideControls: () => {},
		showControls: () => {},
		onSeekToSegmentEnd,
		onPlayNext,
		onPausePlayback: () => {}
	}));
	// Runs an episode to its end, where the next one starts by itself.
	const playOut = () => {
		act(() => result.current.resetPopups());
		act(() => result.current.checkSegments(NEAR_END));
	};
	return {result, playOut, onPlayNext};
};

test('episodes that play themselves out raise the prompt', () => {
	const {result, playOut, onPlayNext} = setup();
	playOut();
	playOut();
	expect(onPlayNext).toHaveBeenCalledTimes(2);
	playOut();
	expect(result.current.askStillWatching).toBe(true);
});

test('the viewer reaching for the remote starts the count over', () => {
	const {result, playOut} = setup();
	playOut();
	playOut();
	act(() => result.current.noteViewerActivity());
	playOut();
	expect(result.current.askStillWatching).toBe(false);
});

test('pressing skip counts as the viewer being there, an automatic skip doesnt', () => {
	const {result, playOut} = setup();
	playOut();
	playOut();
	act(() => result.current.handleSkipSegment({type: 'intro', start: 0, end: 30 * 10000000}));
	playOut();
	expect(result.current.askStillWatching).toBe(true);

	const second = setup();
	second.playOut();
	second.playOut();
	act(() => second.result.current.checkSegments(10 * 10000000));
	act(() => second.result.current.handleSkipSegment({type: 'click'}));
	second.playOut();
	expect(second.result.current.askStillWatching).toBe(false);
});

describe('the auto hide of the skip prompt', () => {
	const SECOND = 10000000;
	let now;

	beforeEach(() => {
		now = 1000000;
		jest.spyOn(Date, 'now').mockImplementation(() => now);
	});
	afterEach(() => jest.restoreAllMocks());

	const setupAutoHide = () => renderHook(() => useSegmentPopups({
		mediaSegments: {list: [{type: 'intro', start: 0, end: 60 * SECOND}]},
		nextEpisode: null,
		settings: {autoPlay: false, introAction: 'ask', mediaSegmentAutoHide: 's5'},
		runTimeRef: {current: 1500 * SECOND},
		activeModal: null,
		controlsVisible: false,
		hideControls: () => {},
		showControls: () => {},
		onSeekToSegmentEnd: () => {},
		onPlayNext: () => {},
		onPausePlayback: () => {}
	})).result;

	test('hides the prompt after the time set', () => {
		const result = setupAutoHide();
		act(() => result.current.checkSegments(1 * SECOND));
		expect(result.current.skipSegment).not.toBeNull();
		now += 6000;
		act(() => result.current.checkSegments(7 * SECOND));
		expect(result.current.skipSegment).toBeNull();
	});

	test('the next episode gets its prompt even when its intro starts at the same tick', () => {
		const result = setupAutoHide();
		act(() => result.current.checkSegments(1 * SECOND));
		now += 6000;
		act(() => result.current.checkSegments(7 * SECOND));
		expect(result.current.skipSegment).toBeNull();

		// The next episode: a new load, then its intro at the same position as the last one's.
		now += 120000;
		act(() => result.current.resetPopups());
		act(() => result.current.checkSegments(1 * SECOND));
		expect(result.current.skipSegment).not.toBeNull();
	});

	test('an intro that comes round again after leaving it gets a fresh clock', () => {
		const result = setupAutoHide();
		act(() => result.current.checkSegments(1 * SECOND));
		now += 6000;
		act(() => result.current.checkSegments(70 * SECOND));
		now += 60000;
		act(() => result.current.checkSegments(2 * SECOND));
		expect(result.current.skipSegment).not.toBeNull();
	});
});
