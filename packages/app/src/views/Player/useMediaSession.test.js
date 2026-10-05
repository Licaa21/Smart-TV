import {renderHook} from '@testing-library/react';
import useMediaSession from './useMediaSession';

describe('useMediaSession', () => {
	let session;

	beforeEach(() => {
		session = {metadata: null, playbackState: 'none', setActionHandler: jest.fn()};
		Object.defineProperty(window.navigator, 'mediaSession', {value: session, configurable: true});
		window.MediaMetadata = function (init) { Object.assign(this, init); };
	});

	afterEach(() => {
		delete window.navigator.mediaSession;
		delete window.MediaMetadata;
	});

	test('tells the system what is playing and how to drive it', () => {
		const onPlay = jest.fn();
		const onPause = jest.fn();
		const {rerender, unmount} = renderHook((props) => useMediaSession(props), {
			initialProps: {title: 'Avatar', artist: '2022', artwork: 'http://nas/poster.jpg', paused: false, onPlay, onPause, onSeekForward: null, onSeekBackward: null, onStop: null}
		});

		expect(session.metadata.title).toBe('Avatar');
		expect(session.metadata.artwork).toEqual([{src: 'http://nas/poster.jpg'}]);
		expect(session.playbackState).toBe('playing');
		expect(session.setActionHandler).toHaveBeenCalledWith('play', onPlay);
		expect(session.setActionHandler).toHaveBeenCalledWith('pause', onPause);
		expect(session.setActionHandler).toHaveBeenCalledWith('seekforward', null);

		rerender({title: 'Avatar', artist: '2022', artwork: 'http://nas/poster.jpg', paused: true, onPlay, onPause, onSeekForward: null, onSeekBackward: null, onStop: null});
		expect(session.playbackState).toBe('paused');

		unmount();
		expect(session.metadata).toBeNull();
		expect(session.playbackState).toBe('none');
		expect(session.setActionHandler).toHaveBeenLastCalledWith('stop', null);
	});

	test('does nothing where the browser has no media session', () => {
		delete window.navigator.mediaSession;
		expect(() => renderHook(() => useMediaSession({title: 'Avatar', paused: true}))).not.toThrow();
	});
});
