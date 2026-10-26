import {renderHook, act} from '@testing-library/react';

import Spotlight from '@enact/spotlight';

import useCinemaSkip from './useCinemaSkip';
import {KEYS} from '../../utils/keys';

// The framework's focus needs its own copy of React, so a stand in answers for it.
jest.mock('@enact/spotlight', () => ({__esModule: true, default: {focus: jest.fn(() => false)}}));

const SECOND = 10000000;
const trailer = {Id: 'trailer', _preroll: true};
const second = {Id: 'second', _preroll: true};
const movie = {Id: 'movie'};
const queue = [trailer, second, movie];

const key = (keyCode) => ({keyCode, preventDefault: jest.fn(), stopPropagation: jest.fn()});

// Puts focus on a stand in for the seek bar or the skip button.
const focusOn = (spotlightId) => {
	const el = document.createElement('div');
	el.setAttribute('data-spotlight-id', spotlightId);
	el.innerHTML = '<div tabindex="0"></div>';
	document.body.appendChild(el);
	el.firstChild.focus();
};

afterEach(() => {
	document.body.innerHTML = '';
	Spotlight.focus.mockClear();
});

const setup = (props = {}) => {
	const onSkip = jest.fn();
	const view = renderHook((p) => useCinemaSkip(p), {
		initialProps: {item: trailer, videoQueue: queue, enabled: true, duration: 60, controlsVisible: false, activeModal: null, onSkip, ...props}
	});
	return {...view, onSkip};
};

describe('useCinemaSkip', () => {
	it('shows on a long enough pre-roll and skips to the next item', () => {
		const {result, onSkip} = setup();

		expect(result.current.shown).toBe(true);
		act(() => result.current.skip());
		expect(onSkip).toHaveBeenCalledWith(second);
		expect(result.current.shown).toBe(false);
	});

	it('stays away when turned off, on the feature itself or on a short pre-roll', () => {
		expect(setup({enabled: false}).result.current.shown).toBe(false);
		expect(setup({item: movie}).result.current.shown).toBe(false);
		expect(setup({duration: 10}).result.current.shown).toBe(false);
	});

	it('goes away after ten seconds of playing from where it came up', () => {
		const {result} = setup();

		act(() => result.current.update(5 * SECOND));
		act(() => result.current.update(14 * SECOND));
		expect(result.current.shown).toBe(true);
		act(() => result.current.update(15 * SECOND));
		expect(result.current.shown).toBe(false);
	});

	it('hides on Back, comes back on Right and skips on Fast Forward while hidden', () => {
		const {result, onSkip} = setup();

		act(() => { expect(result.current.handleKeyDown(key(461))).toBe(true); });
		expect(result.current.shown).toBe(false);

		act(() => { expect(result.current.handleKeyDown(key(KEYS.RIGHT))).toBe(true); });
		expect(result.current.shown).toBe(true);

		act(() => { result.current.handleKeyDown(key(461)); });
		act(() => { expect(result.current.handleKeyDown(key(KEYS.FAST_FORWARD))).toBe(true); });
		expect(onSkip).toHaveBeenCalledWith(second);
	});

	it('swallows a repeated Back, then leaves Back to the player and Right alone while the controls are up', () => {
		const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
		const {result} = setup({controlsVisible: true});

		act(() => { result.current.handleKeyDown(key(461)); });
		expect(result.current.handleKeyDown(key(461))).toBe(true);
		now.mockReturnValue(1600);
		expect(result.current.handleKeyDown(key(461))).toBe(false);
		expect(result.current.handleKeyDown(key(KEYS.RIGHT))).toBe(false);
		now.mockRestore();
	});

	it('comes up again on the next pre-roll', () => {
		const {result, rerender, onSkip} = setup();

		act(() => result.current.skip());
		rerender({item: second, videoQueue: queue, enabled: true, duration: 60, controlsVisible: false, activeModal: null, onSkip});
		expect(result.current.shown).toBe(true);
	});

	it('with the controls up, Up on the seek bar goes to the button and Down from it goes back to the bar', () => {
		const {result} = setup({controlsVisible: true});

		focusOn('progress-bar');
		expect(result.current.handleKeyDown(key(KEYS.UP))).toBe(true);
		expect(Spotlight.focus).toHaveBeenLastCalledWith('skip-segment-btn');

		focusOn('skip-segment-btn');
		expect(result.current.handleKeyDown(key(KEYS.DOWN))).toBe(true);
		expect(Spotlight.focus).toHaveBeenLastCalledWith('progress-bar');
	});

	it('leaves Up on the seek bar alone with the controls away or the button put away', () => {
		focusOn('progress-bar');
		expect(setup().result.current.handleKeyDown(key(KEYS.UP))).toBe(false);

		const {result} = setup({controlsVisible: true});
		act(() => { result.current.handleKeyDown(key(461)); });
		expect(result.current.handleKeyDown(key(KEYS.UP))).toBe(false);
		expect(Spotlight.focus).not.toHaveBeenCalled();
	});
});
