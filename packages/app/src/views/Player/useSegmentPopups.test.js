import {renderHook, act} from '@testing-library/react';

import useSegmentPopups, {isSeekbarFocused} from './useSegmentPopups';

// The framework's focus needs its own copy of React, so a stand in answers for it.
jest.mock('@enact/spotlight', () => ({__esModule: true, default: {focus: jest.fn(() => false)}}));
// The channel list button is a Tizen key, and the platform is not Tizen under test
jest.mock('../../utils/keys', () => ({...jest.requireActual('../../utils/keys'), isChannelMenuKey: (e) => e.keyCode === 10073}));

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
	// Runs an episode to its end, where the ended handler starts the next one unless the prompt holds it.
	const playOut = () => {
		act(() => result.current.resetPopups());
		act(() => result.current.checkSegments(NEAR_END));
		let held = false;
		act(() => {
			held = result.current.shouldHoldForStillWatching();
		});
		if (!held) onPlayNext({Id: 'next'});
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

	// Playback is read twice a second, so it moves in small steps. A big jump is a seek.
	const playTo = (result, from, to) => {
		for (let at = from + 1; at <= to; at += 1) act(() => result.current.checkSegments(at * SECOND));
	};

	const setupAutoHide = () => renderHook((current) => useSegmentPopups({
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
		onPausePlayback: () => {},
		...current
	}), {initialProps: {}});

	test('takes the prompt off the picture after the time set, and brings it back with the controls until the segment ends', () => {
		const {result, rerender} = setupAutoHide();
		act(() => result.current.checkSegments(1 * SECOND));
		expect(result.current.skipPromptShown).toBe(true);
		now += 6000;
		playTo(result, 1, 7);
		// Still the segment's prompt, but away while the controls are
		expect(result.current.skipSegment).not.toBeNull();
		expect(result.current.skipPromptShown).toBe(false);
		rerender({controlsVisible: true});
		expect(result.current.skipPromptShown).toBe(true);
		rerender({controlsVisible: false});
		expect(result.current.skipPromptShown).toBe(false);
		// The segment ends, and so does the prompt
		act(() => result.current.checkSegments(70 * SECOND));
		expect(result.current.skipSegment).toBeNull();
		expect(result.current.skipPromptShown).toBe(false);
	});

	test('the next episode gets its prompt even when its intro starts at the same tick', () => {
		const {result} = setupAutoHide();
		act(() => result.current.checkSegments(1 * SECOND));
		now += 6000;
		playTo(result, 1, 7);
		expect(result.current.skipPromptShown).toBe(false);

		// The next episode: a new load, then its intro at the same position as the last one's.
		now += 120000;
		act(() => result.current.resetPopups());
		act(() => result.current.checkSegments(1 * SECOND));
		expect(result.current.skipPromptShown).toBe(true);
	});

	test('an intro that comes round again after leaving it gets a fresh clock', () => {
		const {result} = setupAutoHide();
		act(() => result.current.checkSegments(1 * SECOND));
		now += 6000;
		act(() => result.current.checkSegments(70 * SECOND));
		now += 60000;
		act(() => result.current.checkSegments(2 * SECOND));
		expect(result.current.skipPromptShown).toBe(true);
	});
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
		expect(result.current.skipPromptShown).toBe(false);
		act(() => result.current.checkSegments(62 * SECOND));
		expect(result.current.skipPromptShown).toBe(true);
	});

	test('Back with the controls up takes the prompt down first, and the Back after it is left to the player', () => {
		const {result} = setupPrompt({controlsVisible: true});
		playTo(result, 60, 70);
		let consumed;
		act(() => { consumed = result.current.handlePopupKeyDown(key(BACK)); });
		expect(consumed).toBe(true);
		expect(result.current.skipSegment).toBeNull();
		// A second Back that follows at once is swallowed too, so it does not also close the controls
		act(() => { consumed = result.current.handlePopupKeyDown(key(BACK)); });
		expect(consumed).toBe(true);
		now += 600;
		act(() => { consumed = result.current.handlePopupKeyDown(key(BACK)); });
		expect(consumed).toBe(false);
	});

	test('a prompt whose time ran out leaves Back to the player while the controls are away', () => {
		const {result} = setupPrompt({}, {mediaSegmentAutoHide: 's5'});
		playTo(result, 60, 62);
		now += 6000;
		playTo(result, 62, 64);
		expect(result.current.skipPromptShown).toBe(false);
		let consumed;
		act(() => { consumed = result.current.handlePopupKeyDown(key(BACK)); });
		expect(consumed).toBe(false);
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

	test('the next episode card a viewer sent away comes back on a seek into the credits', () => {
		const props = {
			mediaSegments: {creditsStart: 100 * SECOND, list: [{type: 'outro', start: 100 * SECOND, end: 160 * SECOND}]},
			nextEpisode: {Id: 'next'},
			runTimeRef: {current: 170 * SECOND}
		};
		const {result} = setupPrompt(props, {replaceSkipOutroWithNextUp: true, nextUpBehavior: 'extended'});
		playTo(result, 99, 105);
		expect(result.current.showSkipCredits).toBe(true);
		act(() => result.current.cancelNextEpisodeCountdown());
		expect(result.current.showSkipCredits).toBe(false);
		// Playing on through the credits leaves it away
		playTo(result, 106, 110);
		expect(result.current.showSkipCredits).toBe(false);
		// Seeking somewhere in the credits brings it back
		act(() => result.current.checkSegments(130 * SECOND));
		expect(result.current.showSkipCredits).toBe(true);
	});

	test('a seek to before the credits does not bring the card back early', () => {
		const props = {
			mediaSegments: {creditsStart: 100 * SECOND, list: [{type: 'outro', start: 100 * SECOND, end: 160 * SECOND}]},
			nextEpisode: {Id: 'next'},
			runTimeRef: {current: 170 * SECOND}
		};
		const {result} = setupPrompt(props, {replaceSkipOutroWithNextUp: true, nextUpBehavior: 'extended'});
		playTo(result, 99, 105);
		act(() => result.current.cancelNextEpisodeCountdown());
		act(() => result.current.checkSegments(30 * SECOND));
		expect(result.current.showSkipCredits).toBe(false);
		expect(result.current.showNextEpisode).toBe(false);
	});

	describe('the channel list button', () => {
		const CHANNEL_LIST = 10073;

		test('brings back the prompt of the segment the viewer is inside after it was sent away', () => {
			const {result} = setupPrompt();
			playTo(result, 60, 70);
			act(() => { result.current.handlePopupKeyDown(key(BACK)); });
			expect(result.current.skipSegment).toBeNull();
			let consumed;
			act(() => { consumed = result.current.handlePopupKeyDown(key(CHANNEL_LIST)); });
			expect(consumed).toBe(true);
			expect(result.current.skipSegment).toMatchObject({type: 'intro'});
		});

		test('brings back a prompt that hid itself', () => {
			const {result} = setupPrompt({}, {mediaSegmentAutoHide: 's5'});
			playTo(result, 60, 62);
			now += 6000;
			playTo(result, 62, 64);
			expect(result.current.skipPromptShown).toBe(false);
			let consumed;
			act(() => { consumed = result.current.handlePopupKeyDown(key(CHANNEL_LIST)); });
			expect(consumed).toBe(true);
			expect(result.current.skipPromptShown).toBe(true);
		});

		test('is left alone outside every segment, and while the prompt is already up', () => {
			const outside = setupPrompt();
			playTo(outside.result, 20, 30);
			let consumed;
			act(() => { consumed = outside.result.current.handlePopupKeyDown(key(CHANNEL_LIST)); });
			expect(consumed).toBe(false);

			const showing = setupPrompt();
			playTo(showing.result, 60, 70);
			expect(showing.result.current.skipSegment).not.toBeNull();
			act(() => { consumed = showing.result.current.handlePopupKeyDown(key(CHANNEL_LIST)); });
			expect(consumed).toBe(false);
		});

		test('leaves the key alone inside a segment that offers no prompt', () => {
			const none = setupPrompt({}, {introAction: 'none'});
			playTo(none.result, 60, 70);
			let consumed;
			act(() => { consumed = none.result.current.handlePopupKeyDown(key(CHANNEL_LIST)); });
			expect(consumed).toBe(false);
			const auto = setupPrompt({}, {introAction: 'auto'});
			playTo(auto.result, 60, 70);
			act(() => { consumed = auto.result.current.handlePopupKeyDown(key(CHANNEL_LIST)); });
			expect(consumed).toBe(false);
		});

		test('brings back the next episode card in the credits', () => {
			const props = {
				mediaSegments: {creditsStart: 100 * SECOND, list: [{type: 'outro', start: 100 * SECOND, end: 160 * SECOND}]},
				nextEpisode: {Id: 'next'},
				runTimeRef: {current: 170 * SECOND}
			};
			const {result} = setupPrompt(props, {replaceSkipOutroWithNextUp: true, nextUpBehavior: 'extended'});
			playTo(result, 99, 105);
			act(() => result.current.cancelNextEpisodeCountdown());
			expect(result.current.showSkipCredits).toBe(false);
			act(() => { result.current.handlePopupKeyDown(key(CHANNEL_LIST)); });
			expect(result.current.showSkipCredits).toBe(true);
		});
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

	test('knows when focus sits anywhere inside the seek bar', () => {
		document.body.innerHTML = '<div data-spotlight-id="progress-bar"><button id="in-bar"></button></div><button id="outside"></button>';
		expect(isSeekbarFocused()).toBe(false);
		document.getElementById('in-bar').focus();
		expect(isSeekbarFocused()).toBe(true);
		document.getElementById('outside').focus();
		expect(isSeekbarFocused()).toBe(false);
		document.body.innerHTML = '';
	});
});

describe('the next up card', () => {
	const SECOND = 10000000;

	beforeEach(() => jest.useFakeTimers());
	afterEach(() => jest.useRealTimers());

	const setupNextUp = (settings = {}) => {
		const onPlayNext = jest.fn();
		const {result} = renderHook(() => useSegmentPopups({
			mediaSegments: null,
			nextEpisode: {Id: 'next'},
			settings: {autoPlay: true, nextUpBehavior: 'extended', nextUpTimeout: 10, stillWatchingBehavior: 'short_', ...settings},
			runTimeRef: {current: 100 * SECOND},
			activeModal: null,
			controlsVisible: false,
			hideControls: () => {},
			showControls: () => {},
			onPlayNext,
			onPausePlayback: () => {}
		}));
		const at = (seconds) => act(() => result.current.checkSegments(seconds * SECOND));
		return {result, at, onPlayNext};
	};

	test('the card comes up for the last seconds of the timeout and counts down what is left', () => {
		const {result, at} = setupNextUp();
		at(85);
		expect(result.current.showNextEpisode).toBe(false);
		at(91.5);
		expect(result.current.showNextEpisode).toBe(true);
		expect(result.current.nextEpisodeCountdown).toBe(9);
		at(96);
		expect(result.current.nextEpisodeCountdown).toBe(4);
	});

	test('an Instant timeout shows no card and leaves the move to the end of the file', () => {
		const {result, at, onPlayNext} = setupNextUp({nextUpTimeout: 0});
		at(99.9);
		expect(result.current.showNextEpisode).toBe(false);
		expect(onPlayNext).not.toHaveBeenCalled();
	});

	test('a seek back out of the window takes the card down until playback reaches it again', () => {
		const {result, at} = setupNextUp();
		at(95);
		at(50);
		expect(result.current.showNextEpisode).toBe(false);
		expect(result.current.nextEpisodeCountdown).toBeNull();
		at(95);
		expect(result.current.showNextEpisode).toBe(true);
	});

	test('nothing moves on before the file ends', () => {
		const {at, onPlayNext} = setupNextUp();
		at(95);
		act(() => jest.advanceTimersByTime(60000));
		expect(onPlayNext).not.toHaveBeenCalled();
	});

	test('Back takes the card down for the rest of the episode', () => {
		const {result, at} = setupNextUp();
		at(95);
		let consumed;
		act(() => {
			consumed = result.current.handlePopupKeyDown({keyCode: 27, preventDefault: jest.fn(), stopPropagation: jest.fn()});
		});
		expect(consumed).toBe(true);
		at(97);
		expect(result.current.showNextEpisode).toBe(false);
	});

	test('with autoplay off the card comes up as before, with no countdown', () => {
		const {result, at} = setupNextUp({autoPlay: false});
		at(75);
		expect(result.current.showNextEpisode).toBe(true);
		expect(result.current.nextEpisodeCountdown).toBeNull();
	});
});
