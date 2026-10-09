import {useRef, useCallback, useEffect} from 'react';
import {useSettings} from '../context/SettingsContext';
import * as jellyfinApi from '../services/jellyfinApi';

const FADE_DURATION = 1500;
const FADE_INTERVAL = 50;
const HOME_ROW_DELAY = 1500;

const buildAudioUrl = (itemId) => {
	const server = jellyfinApi.getServerUrl();
	const token = jellyfinApi.getApiKey();
	return `${server}/Audio/${encodeURIComponent(itemId)}/stream?static=true&audioCodec=mp3&audioBitrate=128000&${jellyfinApi.getTokenParam()}=${encodeURIComponent(token)}`;
};

export const useThemeMusic = () => {
	const {settings} = useSettings();
	const audioRef = useRef(null);
	const currentItemIdRef = useRef(null);
	const fadeTimerRef = useRef(null);
	const delayTimerRef = useRef(null);
	const targetVolumeRef = useRef(0);
	// a fade-out is running, which focus coming back to the same card has to turn around
	const fadingOutRef = useRef(false);
	// the card whose theme a delayed start is waiting to play
	const pendingIdRef = useRef(null);
	// the theme that was playing, or about to, when the screensaver came up, for it to pick up again when it goes
	const suspendedIdRef = useRef(null);
	// the screensaver is up, when no theme starts and focus moving about behind it is not the viewer's doing
	const suspendedRef = useRef(false);

	const getTargetVolume = useCallback(() => {
		return Math.max(0, Math.min(100, settings.themeMusicVolume || 30)) / 100;
	}, [settings.themeMusicVolume]);

	const clearFade = useCallback(() => {
		fadingOutRef.current = false;
		if (fadeTimerRef.current) {
			clearInterval(fadeTimerRef.current);
			fadeTimerRef.current = null;
		}
	}, []);

	// Ends the track that is playing and leaves a delayed start for another card alone
	const stopAudio = useCallback(() => {
		clearFade();
		if (audioRef.current) {
			audioRef.current.pause();
			audioRef.current.src = '';
			audioRef.current = null;
		}
		currentItemIdRef.current = null;
	}, [clearFade]);

	const stopImmediate = useCallback(() => {
		if (delayTimerRef.current) {
			clearTimeout(delayTimerRef.current);
			delayTimerRef.current = null;
		}
		stopAudio();
	}, [stopAudio]);

	const fadeIn = useCallback((audio, fromVolume = 0) => {
		clearFade();
		const target = getTargetVolume();
		targetVolumeRef.current = target;
		const from = Math.min(fromVolume, target);
		audio.volume = from;
		const steps = FADE_DURATION / FADE_INTERVAL;
		let step = 0;
		fadeTimerRef.current = setInterval(() => {
			step++;
			if (step >= steps) {
				audio.volume = target;
				clearFade();
			} else {
				audio.volume = from + ((step / steps) * (target - from));
			}
		}, FADE_INTERVAL);
	}, [clearFade, getTargetVolume]);

	const fadeOut = useCallback((finish) => {
		const audio = audioRef.current;
		if (!audio) return;
		clearFade();
		const startVolume = audio.volume;
		if (startVolume <= 0) {
			finish();
			return;
		}
		fadingOutRef.current = true;
		const steps = FADE_DURATION / FADE_INTERVAL;
		let step = 0;
		fadeTimerRef.current = setInterval(() => {
			step++;
			if (step >= steps) {
				finish();
			} else {
				audio.volume = startVolume * (1 - step / steps);
			}
		}, FADE_INTERVAL);
	}, [clearFade]);

	const fadeOutAndStop = useCallback(() => fadeOut(stopImmediate), [fadeOut, stopImmediate]);

	const playThemeMusic = useCallback(async (itemId) => {
		if (!settings.themeMusicEnabled) return;
		if (!itemId) return;
		if (suspendedRef.current) {
			suspendedIdRef.current = itemId;
			return;
		}
		suspendedIdRef.current = null;

		if (currentItemIdRef.current === itemId && audioRef.current) {
			if (fadingOutRef.current) fadeIn(audioRef.current, audioRef.current.volume);
			return;
		}

		stopImmediate();
		currentItemIdRef.current = itemId;

		try {
			const result = await jellyfinApi.api.getThemeSongs(itemId, true);
			const songs = result?.Items || [];
			if (songs.length === 0 || currentItemIdRef.current !== itemId) return;

			const song = songs[Math.floor(Math.random() * songs.length)];
			const url = buildAudioUrl(song.Id);

			const audio = new window.Audio();
			// A profile synced from another client can hold null here, which keeps
			// the looping the track always did.
			audio.loop = settings.themeMusicLoop !== false;
			audio.volume = 0;
			audioRef.current = audio;

			audio.addEventListener('canplaythrough', () => {
				if (currentItemIdRef.current === itemId && audioRef.current === audio) {
					audio.play().then(() => fadeIn(audio)).catch(() => {});
				}
			}, {once: true});

			audio.addEventListener('error', () => {
				if (audioRef.current === audio) {
					stopImmediate();
				}
			}, {once: true});

			audio.src = url;
		} catch {
			if (currentItemIdRef.current === itemId) {
				currentItemIdRef.current = null;
			}
		}
	}, [settings.themeMusicEnabled, settings.themeMusicLoop, stopImmediate, fadeIn]);

	const playThemeMusicDelayed = useCallback((itemId) => {
		if (!settings.themeMusicEnabled || !settings.themeMusicOnHomeRows) return;
		if (!itemId) return;
		if (suspendedRef.current) {
			suspendedIdRef.current = itemId;
			return;
		}
		suspendedIdRef.current = null;

		if (delayTimerRef.current) {
			clearTimeout(delayTimerRef.current);
		}

		if (currentItemIdRef.current === itemId && audioRef.current) {
			// focus came back to the card whose theme was fading, so it picks up from where it had got to
			if (fadingOutRef.current) fadeIn(audioRef.current, audioRef.current.volume);
			return;
		}

		// A theme plays while its own card is in focus, so the one playing for another card fades out now and the
		// new one starts after the delay, if it has any
		if (audioRef.current) fadeOut(stopAudio);

		pendingIdRef.current = itemId;
		delayTimerRef.current = setTimeout(() => {
			delayTimerRef.current = null;
			pendingIdRef.current = null;
			playThemeMusic(itemId);
		}, HOME_ROW_DELAY);
	}, [settings.themeMusicEnabled, settings.themeMusicOnHomeRows, playThemeMusic, fadeOut, fadeIn, stopAudio]);

	const cancelDelayed = useCallback(() => {
		pendingIdRef.current = null;
		if (delayTimerRef.current) {
			clearTimeout(delayTimerRef.current);
			delayTimerRef.current = null;
		}
	}, []);

	const endTheme = useCallback(() => {
		cancelDelayed();
		// a theme still being fetched is called off too, since the fetch checks which card it was for
		if (!audioRef.current) currentItemIdRef.current = null;
		fadeOutAndStop();
	}, [cancelDelayed, fadeOutAndStop]);

	// Focus moved to a card with no theme of its own, so what was playing for the last one ends
	const stopForFocus = useCallback(() => {
		if (!suspendedRef.current) suspendedIdRef.current = null;
		endTheme();
	}, [endTheme]);

	// The screensaver came up. The theme fades out, and is kept in mind for when the screensaver goes.
	const suspend = useCallback(() => {
		const id = pendingIdRef.current || currentItemIdRef.current;
		if (id) suspendedIdRef.current = id;
		suspendedRef.current = true;
		endTheme();
	}, [endTheme]);

	// The screensaver went. The theme starts again unless something has been focused or opened since, which
	// would have cleared it.
	const resume = useCallback(() => {
		suspendedRef.current = false;
		const id = suspendedIdRef.current;
		suspendedIdRef.current = null;
		if (id) playThemeMusic(id);
	}, [playThemeMusic]);

	useEffect(() => {
		if (audioRef.current && targetVolumeRef.current > 0) {
			const newTarget = getTargetVolume();
			targetVolumeRef.current = newTarget;
			if (!fadeTimerRef.current) {
				audioRef.current.volume = newTarget;
			}
		}
	}, [getTargetVolume]);

	// Nothing else stops the track once the app leaves the screen, so standby leaves a
	// looping theme playing out of the speakers. Older sets only fire the prefixed
	// event, so both are watched.
	useEffect(() => {
		const stopWhenHidden = () => {
			if (document.hidden || document.webkitHidden) stopImmediate();
		};
		document.addEventListener('visibilitychange', stopWhenHidden);
		document.addEventListener('webkitvisibilitychange', stopWhenHidden);
		return () => {
			document.removeEventListener('visibilitychange', stopWhenHidden);
			document.removeEventListener('webkitvisibilitychange', stopWhenHidden);
		};
	}, [stopImmediate]);

	useEffect(() => {
		return () => stopImmediate();
	}, [stopImmediate]);

	return {
		playThemeMusic,
		playThemeMusicDelayed,
		cancelDelayed,
		stopForFocus,
		suspend,
		resume,
		stopThemeMusic: fadeOutAndStop,
		stopThemeMusicImmediate: stopImmediate,
		isPlaying: () => !!(audioRef.current && !audioRef.current.paused)
	};
};
