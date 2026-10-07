import {renderHook, act} from '@testing-library/react';

import * as jellyfinApi from '../services/jellyfinApi';
import {useThemeMusic} from './useThemeMusic';

jest.mock('../context/SettingsContext', () => ({
	useSettings: () => ({settings: {themeMusicEnabled: true, themeMusicVolume: 30, themeMusicLoop: true}})
}));

jest.mock('../services/jellyfinApi', () => ({
	getServerUrl: () => 'http://server',
	getApiKey: () => 'token',
	getTokenParam: () => 'api_key',
	api: {getThemeSongs: jest.fn()}
}));

// jsdom has no audio pipeline, so the element is stood in for by something that
// records what the hook asks of it and lets the test fire canplaythrough itself.
class FakeAudio {
	constructor () {
		this.paused = true;
		this.volume = 0;
		this.listeners = {};
		FakeAudio.last = this;
	}
	addEventListener (type, handler) {
		this.listeners[type] = handler;
	}
	play () {
		this.paused = false;
		return Promise.resolve();
	}
	pause () {
		this.paused = true;
	}
}

const setHidden = (value) => {
	Object.defineProperty(document, 'hidden', {configurable: true, get: () => value});
};

const setWebkitHidden = (value) => {
	Object.defineProperty(document, 'webkitHidden', {configurable: true, get: () => value});
};

const startPlaying = async (result) => {
	await act(async () => {
		await result.current.playThemeMusic('item1');
	});
	act(() => FakeAudio.last.listeners.canplaythrough());
};

describe('useThemeMusic while the app is off screen', () => {
	beforeEach(() => {
		// The suite resets mocks before every test, so the answer is set here rather
		// than in the module factory.
		jellyfinApi.api.getThemeSongs.mockResolvedValue({Items: [{Id: 'song1'}]});
		window.Audio = FakeAudio;
		setHidden(false);
	});

	afterEach(() => {
		setHidden(false);
		setWebkitHidden(false);
	});

	test('the track stops when the app is hidden', async () => {
		const {result} = renderHook(() => useThemeMusic());
		await startPlaying(result);
		expect(result.current.isPlaying()).toBe(true);

		setHidden(true);
		act(() => document.dispatchEvent(new Event('visibilitychange')));

		expect(FakeAudio.last.paused).toBe(true);
		expect(result.current.isPlaying()).toBe(false);
	});

	test('a set that only reports the prefixed event still stops the track', async () => {
		const {result} = renderHook(() => useThemeMusic());
		await startPlaying(result);

		// The unprefixed flag stays absent, which is what an old set looks like.
		setHidden(undefined);
		setWebkitHidden(true);
		act(() => document.dispatchEvent(new Event('webkitvisibilitychange')));

		expect(FakeAudio.last.paused).toBe(true);
	});

	test('coming back to the screen leaves the track alone', async () => {
		const {result} = renderHook(() => useThemeMusic());
		await startPlaying(result);

		act(() => document.dispatchEvent(new Event('visibilitychange')));

		expect(FakeAudio.last.paused).toBe(false);
		expect(result.current.isPlaying()).toBe(true);
	});

	test('the listeners come off with the hook', async () => {
		const remove = jest.spyOn(document, 'removeEventListener');
		const {unmount} = renderHook(() => useThemeMusic());

		unmount();

		const removed = remove.mock.calls.map((call) => call[0]);
		expect(removed).toContain('visibilitychange');
		expect(removed).toContain('webkitvisibilitychange');
		remove.mockRestore();
	});
});

describe('useThemeMusic when focus moves on', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jellyfinApi.api.getThemeSongs.mockResolvedValue({Items: [{Id: 'song1'}]});
		window.Audio = FakeAudio;
		setHidden(false);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	test('a card with no theme ends the track the last card started', async () => {
		const {result} = renderHook(() => useThemeMusic());
		await startPlaying(result);
		expect(result.current.isPlaying()).toBe(true);
		act(() => {
			result.current.stopForFocus();
			jest.advanceTimersByTime(2000);
		});
		expect(result.current.isPlaying()).toBe(false);
	});

	test('a theme still being fetched when focus moves on is called off', async () => {
		let resolveSongs;
		jellyfinApi.api.getThemeSongs.mockReturnValue(new Promise((resolve) => { resolveSongs = resolve; }));
		FakeAudio.last = null;
		const {result} = renderHook(() => useThemeMusic());
		let started;
		act(() => { started = result.current.playThemeMusic('item2'); });
		act(() => result.current.stopForFocus());
		await act(async () => {
			resolveSongs({Items: [{Id: 'song2'}]});
			await started;
		});
		expect(FakeAudio.last).toBeNull();
	});
});
