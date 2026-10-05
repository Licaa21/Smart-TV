import {useEffect} from 'react';

const ACTIONS = ['play', 'pause', 'seekforward', 'seekbackward', 'stop'];

const setHandler = (session, action, handler) => {
	try {
		session.setActionHandler(action, handler);
	} catch (e) {
		// an action this browser doesnt know
	}
};

// Lets the system's own transport controls drive the player, which on Fire TV is
// how Alexa and the remote's media keys arrive once the shell forwards them.
const useMediaSession = ({title, artist, artwork, paused, onPlay, onPause, onSeekForward, onSeekBackward, onStop}) => {
	const session = typeof navigator !== 'undefined' ? navigator.mediaSession : null;

	useEffect(() => {
		if (!session || !title || typeof window.MediaMetadata !== 'function') return;
		session.metadata = new window.MediaMetadata({title, artist: artist || '', artwork: artwork ? [{src: artwork}] : []});
		return () => {
			session.metadata = null;
		};
	}, [session, title, artist, artwork]);

	useEffect(() => {
		if (!session) return;
		session.playbackState = paused ? 'paused' : 'playing';
		return () => {
			session.playbackState = 'none';
		};
	}, [session, paused]);

	useEffect(() => {
		if (!session) return;
		const handlers = [onPlay, onPause, onSeekForward, onSeekBackward, onStop];
		ACTIONS.forEach((action, index) => setHandler(session, action, handlers[index]));
		return () => ACTIONS.forEach((action) => setHandler(session, action, null));
	}, [session, onPlay, onPause, onSeekForward, onSeekBackward, onStop]);
};

export default useMediaSession;
