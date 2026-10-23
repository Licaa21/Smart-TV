import {useState, useEffect, useCallback, useRef} from 'react';
import Spotlight from '@enact/spotlight';

import {stopPlaybackForTrailer} from '../../utils/trailerPlayback';
import {trailersOf} from '../../utils/seerrDetailItem';
import seerrApi from '../../services/seerrApi';
import {
	attachTrailerStream, fetchVideoStream, extractYouTubeIdFromUrl, fetchSponsorSegments, isManifestUrl, nativeManifestSkipped,
	needsHlsJs, noteNativeManifest, playsManifestNatively, watchManifestPlayback
} from '../../services/youtubeTrailer';
import serverLogger from '../../services/serverLogger';
import {volumeLevel} from '../../utils/volumeLevel';

// What the trailer's element is listened to for, and how many of them a trailer logs.
const TRAILER_EVENTS = ['waiting', 'stalled', 'seeking', 'seeked', 'playing', 'pause', 'error', 'ended'];
const TRAILER_EVENTS_LOGGED = 40;

// What Seerr said about each TMDB title this session: the YouTube id of its trailer, or '' for none.
const seerrTrailerCache = new Map();

// Plays a title's trailer. A local one goes to the real player, and a YouTube link plays in
// an overlay here, since the player has no way to open a stream that isn't on the server.
const useDetailsTrailer = ({item, effectiveApi, onPlay, trailerVolume, seerrOnly, backRef}) => {
	const [trailerOverlay, setTrailerOverlay] = useState(null);
	const [trailerStreamUrl, setTrailerStreamUrl] = useState(null);

	const trailerVideoRef = useRef(null);
	const trailerAudioLanguageRef = useRef('');
	const trailerVideoOnlyRef = useRef(null);
	const trailerResumeAtRef = useRef(0);
	const sponsorSegmentsRef = useRef([]);
	const sponsorSkipIntervalRef = useRef(null);
	// The trailer Seerr knows of for a library title that carries none of its own, found ahead of the press so the
	// button is only there when there is something behind it.
	const [lookedUpVideoId, setLookedUpVideoId] = useState('');

	useEffect(() => {
		const tmdbId = item?.ProviderIds?.Tmdb;
		const wanted = !seerrOnly && tmdbId && (item.Type === 'Movie' || item.Type === 'Series') &&
			!(item.LocalTrailerCount > 0) && !(item.RemoteTrailers?.length > 0);
		if (!wanted) {
			setLookedUpVideoId('');
			return undefined;
		}
		const key = `${item.Type}:${tmdbId}`;
		if (seerrTrailerCache.has(key)) {
			setLookedUpVideoId(seerrTrailerCache.get(key));
			return undefined;
		}
		let cancelled = false;
		setLookedUpVideoId('');
		(item.Type === 'Movie' ? seerrApi.getMovie(tmdbId) : seerrApi.getTv(tmdbId))
			.then((details) => {
				const found = trailersOf(details || {});
				let videoId = '';
				for (let i = 0; i < found.length && !videoId; i++) videoId = extractYouTubeIdFromUrl(found[i].Url) || '';
				seerrTrailerCache.set(key, videoId);
				if (!cancelled) setLookedUpVideoId(videoId);
			})
			.catch((err) => { void err; });
		return () => { cancelled = true; };
	}, [item, seerrOnly]);

	const handleTrailer = useCallback(() => {
		const openTrailer = async () => {
			if (!item?.Id) return;
			await stopPlaybackForTrailer(trailerVideoRef.current);

			try {
				// A Seerr title has no id the library would recognise, so asking it for a local
				// trailer only spends a failed request before the Seerr one plays.
				if (!seerrOnly && effectiveApi?.getLocalTrailers) {
					const localResult = await effectiveApi.getLocalTrailers(item.Id);
					const localItems = Array.isArray(localResult?.Items)
						? localResult.Items
						: (Array.isArray(localResult) ? localResult : []);
					const localTrailer = localItems.find((t) => t?.Id);

					if (localTrailer) {
						const trailerItem = {
							...localTrailer,
							_serverUrl: item._serverUrl,
							_serverType: item._serverType,
							_serverAccessToken: item._serverAccessToken,
							_serverUserId: item._serverUserId,
							_serverName: item._serverName,
							_serverId: item._serverId
						};
						onPlay?.(trailerItem, false, {});
						return;
					}
				}
				} catch (err) { void err; }

			if (item?.RemoteTrailers?.length > 0) {
				for (let i = 0; i < item.RemoteTrailers.length; i++) {
					const trailerUrl = item.RemoteTrailers[i]?.Url || item.RemoteTrailers[i]?.url || '';
					if (!trailerUrl) continue;

					const videoId = extractYouTubeIdFromUrl(trailerUrl);
					if (videoId) {
						setTrailerOverlay(videoId);
						return;
					}

					window.open(trailerUrl, '_blank');
					return;
				}
			}

			// A library title with none of its own plays the one Seerr was found to know of.
			if (lookedUpVideoId) setTrailerOverlay(lookedUpVideoId);
		};

		openTrailer();
	}, [effectiveApi, item, onPlay, seerrOnly, lookedUpVideoId]);

	const clearSponsorSkip = useCallback(() => {
		if (sponsorSkipIntervalRef.current) {
			clearInterval(sponsorSkipIntervalRef.current);
			sponsorSkipIntervalRef.current = null;
		}
	}, []);

	// The trailer takes the speakers while it plays, so the app is told when it opens and closes, to put the title's theme
	// song away and bring it back. The first run, with nothing open, says nothing.
	const trailerOpen = Boolean(trailerOverlay);
	const trailerWasOpenRef = useRef(false);
	useEffect(() => {
		if (trailerOpen === trailerWasOpenRef.current) return;
		trailerWasOpenRef.current = trailerOpen;
		window.dispatchEvent(new CustomEvent('moonfin:trailer', {detail: {open: trailerOpen}}));
	}, [trailerOpen]);
	useEffect(() => () => {
		if (trailerWasOpenRef.current) window.dispatchEvent(new CustomEvent('moonfin:trailer', {detail: {open: false}}));
	}, []);

	const handleCloseTrailer = useCallback(() => {
		clearSponsorSkip();
		sponsorSegmentsRef.current = [];
		if (trailerVideoRef.current) {
			try {
				trailerVideoRef.current.pause();
				// Calling load() here corrupts the Chrome 53 hardware decoder.
				trailerVideoRef.current.src = '';
				trailerVideoRef.current.removeAttribute('src');
			} catch { /* ignore */ }
		}
		setTrailerOverlay(null);
		setTrailerStreamUrl(null);
		window.requestAnimationFrame(() => Spotlight.focus('details-action-buttons'));
	}, [clearSponsorSkip]);

	// BACK is settled by the app before the overlay ever sees the key, so the
	// trailer answers through the detail screen's handler like its other overlays.
	useEffect(() => {
		if (!backRef) return undefined;
		const handler = () => {
			if (!trailerOverlay) return false;
			handleCloseTrailer();
			return true;
		};
		backRef.current = handler;
		return () => {
			if (backRef.current === handler) backRef.current = null;
		};
	}, [backRef, trailerOverlay, handleCloseTrailer]);

	useEffect(() => {
		if (!trailerOverlay) {
			setTrailerStreamUrl(null);
			return;
		}
		let cancelled = false;

		const resolveStream = async () => {
			// Segments are a bonus, so a failed lookup must not hold up the trailer.
			const [segments, stream] = await Promise.all([
				fetchSponsorSegments(trailerOverlay).catch(() => []),
				fetchVideoStream(trailerOverlay, true, '', nativeManifestSkipped())
			]);
			if (cancelled) return;
			if (stream) {
				sponsorSegmentsRef.current = segments || [];
				trailerAudioLanguageRef.current = stream.audioLanguage || '';
				trailerVideoOnlyRef.current = stream.videoOnly || null;
				trailerResumeAtRef.current = 0;
				serverLogger.playback(`Trailer: ${isManifestUrl(stream.url) ? `YouTube ${stream.videoOnly ? 'picture only ' : ''}manifest` : 'YouTube 360p file'}${stream.client ? ` from ${stream.client}` : ''}`);
				setTrailerStreamUrl(stream.url);
			} else {
				setTrailerOverlay(null);
			}
		};

		resolveStream();
		return () => { cancelled = true; };
	}, [trailerOverlay]);

	// The overlay's video mounts once there is a stream to put on it. A manifest the TV cant play
	// gives way to YouTube's small muxed file.
	useEffect(() => {
		const video = trailerVideoRef.current;
		if (!trailerStreamUrl || !video) return undefined;
		let cancelled = false;
		let fellBack = false;
		let release = null;
		let stopWatch = null;
		const nativeManifest = playsManifestNatively(trailerStreamUrl);

		// A trailer that stalls or drifts leaves nothing in the log to explain it, so what the element
		// reports while it plays is kept, capped so a stuttering one cannot fill the report.
		let logged = 0;
		const reportEvent = (event) => {
			if (logged >= TRAILER_EVENTS_LOGGED) return;
			logged += 1;
			const ranges = video.buffered;
			serverLogger.playback(`Trailer ${event.type}`, {
				at: Math.round(video.currentTime * 10) / 10,
				ready: video.readyState,
				bufferedTo: ranges && ranges.length ? Math.round(ranges.end(ranges.length - 1) * 10) / 10 : null,
				manifest: isManifestUrl(trailerStreamUrl)
			});
		};
		TRAILER_EVENTS.forEach((name) => video.addEventListener(name, reportEvent));


		// A manifest that errors, never starts or stops partway gives way to the muxed file, picking up
		// where it stopped.
		const fallBack = (reason = 'failed to play') => {
			if (cancelled || fellBack || !isManifestUrl(trailerStreamUrl)) return;
			fellBack = true;
			if (stopWatch) stopWatch();
			serverLogger.warn(serverLogger.LOG_CATEGORIES.PLAYBACK, `Trailer ${reason} on the YouTube manifest, trying the 360p file`);
			if (nativeManifest) noteNativeManifest(false);
			const at = video.currentTime;
			fetchVideoStream(trailerOverlay, true, '', true).then((stream) => {
				if (cancelled || !stream) return;
				trailerAudioLanguageRef.current = '';
				trailerVideoOnlyRef.current = null;
				trailerResumeAtRef.current = at > 0 ? at : 0;
				setTrailerStreamUrl(stream.url);
			});
		};
		video.onerror = () => fallBack();

		const loadHls = needsHlsJs(trailerStreamUrl) ? import('hls.js').then((m) => m.default) : Promise.resolve(null);
		loadHls.then((Hls) => {
			if (cancelled) return;
			release = attachTrailerStream(video, trailerStreamUrl, {Hls, audioLanguage: trailerAudioLanguageRef.current, videoOnly: trailerVideoOnlyRef.current, startTime: trailerResumeAtRef.current, onError: () => fallBack()});
			if (isManifestUrl(trailerStreamUrl)) {
				stopWatch = watchManifestPlayback(video, {
					onStall: fallBack,
					onConfirmed: nativeManifest ? () => noteNativeManifest(true) : null
				});
			}
		}).catch(() => fallBack());

		return () => {
			cancelled = true;
			video.onerror = null;
			TRAILER_EVENTS.forEach((name) => video.removeEventListener(name, reportEvent));
			if (stopWatch) stopWatch();
			if (release) release();
		};
	}, [trailerStreamUrl, trailerOverlay]);

	// Skips sponsor segments by polling, the same way the home screen previews do.
	useEffect(() => {
		const segments = sponsorSegmentsRef.current;
		if (!trailerStreamUrl || segments.length === 0) return undefined;

		let skipsLogged = 0;
		sponsorSkipIntervalRef.current = setInterval(() => {
			const video = trailerVideoRef.current;
			// Not while it is still starting up. A seek before there is picture and sound to seek in
			// sends the video one way while the audio, which hls.js loads apart from it, plays on.
			if (!video || video.paused || video.seeking || video.readyState < 3) return;
			const t = video.currentTime;
			for (let i = 0; i < segments.length; i++) {
				if (t >= segments[i].start && t < segments[i].end - 0.5) {
					if (skipsLogged < 5) {
						skipsLogged += 1;
						serverLogger.playback('Trailer skipped a segment', {from: Math.round(t * 10) / 10, to: Math.round(segments[i].end * 10) / 10});
					}
					video.currentTime = segments[i].end;
					break;
				}
			}
		}, 500);

		return clearSponsorSkip;
	}, [trailerStreamUrl, clearSponsorSkip]);

	useEffect(() => {
		if (!trailerOverlay || !trailerVideoRef.current) return;
		trailerVideoRef.current.volume = volumeLevel(trailerVolume);
	}, [trailerVolume, trailerOverlay, trailerStreamUrl]);

	return {
		trailerOverlay,
		trailerStreamUrl,
		trailerVideoRef,
		handleTrailer,
		handleCloseTrailer,
		hasLookedUpTrailer: Boolean(lookedUpVideoId)
	};
};

export default useDetailsTrailer;
