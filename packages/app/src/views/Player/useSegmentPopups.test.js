import {renderHook, act} from '@testing-library/react';

import useSegmentPopups from './useSegmentPopups';

// The framework's focus needs its own copy of React, so a stand in answers for it.
jest.mock('@enact/spotlight', () => ({__esModule: true, default: {focus: jest.fn(() => false)}}));

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

describe('the skip prompt over the controls, on a seek and under the remote', () => {
	const SECOND = 10000000;
	let now;

	// Playback is read twice a second, so it moves in small steps. A big jump is a seek.
	const playTo = (result, from, to) => {
		for (let at = from + 1; at <= to; at += 1) act(() => result.current.checkSegments(at * SECOND));
	};

	beforeEach(() => {
		now = 1000000;
		jest.spyOn(Date, 'now').mockImplementation(() => now);
	});
	afterEach(() => jest.restoreAllMocks());

	const setupPrompt = (props = {}, settings = {}) => {
		const onSeekToSegmentEnd = jest.fn();
		const showControls = jest.fn();
		const onLeavePromptDown = jest.fn();
		const {result} = renderHook((current) => useSegmentPopups({
			mediaSegments: {list: [{type: 'intro', start: 60 * SECOND, end: 120 * SECOND}]},
			nextEpisode: null,
			settings: {autoPlay: false, introAction: 'ask', ...settings},
			runTimeRef: {current: 1500 * SECOND},
			activeModal: null,
			controlsVisible: false,
			hideControls: () => {},
			showControls,
			onSeekToSegmentEnd,
			onLeavePromptDown,
			onPlayNext: () => {},
			onPausePlayback: () => {},
			...current
		}), {initialProps: props});
		return {result, onSeekToSegmentEnd, showControls, onLeavePromptDown};
	};
	const key = (keyCode, extra = {}) => ({keyCode, key: extra.key, preventDefault: jest.fn(), stopPropagation: jest.fn()});
	const BACK = 27;
	const ENTER = 13;

	test('shows with the controls up, and does not take them away', () => {
		const hideControls = jest.fn();
		const {result} = setupPrompt({controlsVisible: true, hideControls});
		act(() => result.current.checkSegments(70 * SECOND));
		expect(result.current.skipSegment).not.toBeNull();
		expect(hideControls).not.toHaveBeenCalled();
	});

	test('a seek into a dismissed segment offers it again with the progress from where it landed', () => {
		const {result} = setupPrompt();
		act(() => result.current.checkSegments(61 * SECOND));
		act(() => { result.current.handlePopupKeyDown(key(BACK)); });
		expect(result.current.skipSegment).toBeNull();
		// Still playing through it, so it stays away.
		act(() => result.current.checkSegments(61.5 * SECOND));
		expect(result.current.skipSegment).toBeNull();
		// Jumping to the middle of it brings it back.
		act(() => result.current.checkSegments(90 * SECOND));
		expect(result.current.skipSegment).toMatchObject({type: 'intro', remainingSeconds: 30});
		expect(result.current.skipSegment.progress).toBeCloseTo(0.5);
	});

	test('a seek back into it after its few seconds ran out starts the clock over', () => {
		const {result} = setupPrompt({}, {mediaSegmentAutoHide: 's5'});
		act(() => result.current.checkSegments(61 * SECOND));
		now += 6000;
		playTo(result, 61, 67);
		expect(result.current.skipSegment).toBeNull();
		act(() => result.current.checkSegments(62 * SECOND));
		expect(result.current.skipSegment).not.toBeNull();
	});

	test('skipping and landing a little short of the end does not offer it again, but a seek into it afterwards does', () => {
		const {result, onSeekToSegmentEnd} = setupPrompt();
		playTo(result, 60, 70);
		act(() => { result.current.handlePopupKeyDown(key(ENTER)); });
		expect(onSeekToSegmentEnd).toHaveBeenCalledWith(120 * SECOND);
		// AVPlay put it back on the keyframe before the end.
		act(() => result.current.checkSegments(118.5 * SECOND));
		expect(result.current.skipSegment).toBeNull();
		now += 6000;
		act(() => result.current.checkSegments(200 * SECOND));
		act(() => result.current.checkSegments(90 * SECOND));
		expect(result.current.skipSegment).not.toBeNull();
	});

	test('a seek out of it takes it away, and a segment that skips itself is not offered on a seek back', () => {
		const prompt = setupPrompt();
		act(() => prompt.result.current.checkSegments(61 * SECOND));
		act(() => prompt.result.current.checkSegments(300 * SECOND));
		expect(prompt.result.current.skipSegment).toBeNull();

		const auto = setupPrompt({}, {introAction: 'auto'});
		act(() => auto.result.current.checkSegments(61 * SECOND));
		expect(auto.onSeekToSegmentEnd).toHaveBeenCalledTimes(1);
		act(() => auto.result.current.checkSegments(200 * SECOND));
		act(() => auto.result.current.checkSegments(62 * SECOND));
		expect(auto.onSeekToSegmentEnd).toHaveBeenCalledTimes(1);
	});

	test('with the controls away, Back sends it off and OK takes it', () => {
		const first = setupPrompt();
		act(() => first.result.current.checkSegments(70 * SECOND));
		const back = key(BACK);
		let consumed;
		act(() => { consumed = first.result.current.handlePopupKeyDown(back); });
		expect(consumed).toBe(true);
		expect(first.result.current.skipSegment).toBeNull();

		const second = setupPrompt();
		act(() => second.result.current.checkSegments(70 * SECOND));
		act(() => { consumed = second.result.current.handlePopupKeyDown(key(ENTER)); });
		expect(consumed).toBe(true);
		expect(second.onSeekToSegmentEnd).toHaveBeenCalledWith(120 * SECOND);
	});

	test('with the controls away, any other key leaves the prompt up for the controls to come up with it', () => {
		const {result} = setupPrompt();
		act(() => result.current.checkSegments(70 * SECOND));
		let consumed;
		act(() => { consumed = result.current.handlePopupKeyDown(key(39)); });
		expect(consumed).toBe(false);
		expect(result.current.skipSegment).not.toBeNull();
	});

	test('with the controls up, Back is left to close them and the prompt stays', () => {
		const {result} = setupPrompt({controlsVisible: true});
		act(() => result.current.checkSegments(70 * SECOND));
		let consumed;
		act(() => { consumed = result.current.handlePopupKeyDown(key(BACK)); });
		expect(consumed).toBe(false);
		expect(result.current.skipSegment).not.toBeNull();
	});

	test('with the controls up, Down from the prompt goes back to the bar and the sides stay put', () => {
		const button = document.createElement('div');
		button.setAttribute('data-spotlight-id', 'skip-segment-btn');
		button.tabIndex = 0;
		document.body.appendChild(button);
		button.focus();
		const {result, onLeavePromptDown, showControls} = setupPrompt({controlsVisible: true});
		act(() => result.current.checkSegments(70 * SECOND));
		let consumed;
		act(() => { consumed = result.current.handlePopupKeyDown(key(40)); });
		expect(consumed).toBe(true);
		expect(onLeavePromptDown).toHaveBeenCalled();
		act(() => { consumed = result.current.handlePopupKeyDown(key(37)); });
		expect(consumed).toBe(true);
		expect(showControls).toHaveBeenCalled();
		act(() => { consumed = result.current.handlePopupKeyDown(key(ENTER)); });
		expect(consumed).toBe(false);
		document.body.removeChild(button);
	});
});
