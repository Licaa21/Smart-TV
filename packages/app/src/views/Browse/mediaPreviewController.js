import {getPlatform} from '../../platform';
import {getDeviceId} from '../../services/jellyfinApi';
import {getDeviceCapabilities} from '../../services/deviceProfile';
import serverLogger from '../../services/serverLogger';
import {
	PREVIEW_DWELL_MS,
	PREVIEW_OPEN_TIMEOUT_MS,
	PREVIEW_PLAY_CAP_MS,
	buildMediaPreviewUrl,
	newPlaySessionId,
	pickPreviewAudioIndex,
	previewApiFor,
	previewSegmentContainer,
	previewServerOf,
	previewStartSeconds,
	resolvePreviewTarget,
	supportsMediaPreview
} from '../../services/mediaPreviewSource';
import {claimSharedVideo, isMusicPlaying, releaseSharedVideo} from '../../utils/sharedVideoOwner';
import {coverVideoInBox, resetVideoBox} from '../../utils/videoCover';

const noop = () => {};

// Plays a short clip of the focused home row card into a frame the card renders.
// Nothing here is React: the cards subscribe by key and hear the phase they should
// draw, idle, attached (frame wanted, artwork still showing) or playing (reveal).
//
// A preview goes idle, pending (the dwell), resolving (next up, media info and the
// URL), attached (element in the frame, stream opening) and playing. Every step
// after an await checks the request it belongs to is still the current one, so a
// stop can never be overtaken by the start it interrupted.
export const createMediaPreviewController = ({getSettings, api, onThemeMusicHold, platform = getPlatform()}) => {
	const listeners = new Map();
	const frames = new Map();
	const timers = {dwell: null, open: null, cap: null};
	let enabled = false;
	let audioEnabled = true;
	let themeHeld = false;
	let requestId = 0;
	let current = null;
	// The card that has focus, kept while previews are off so the one under focus
	// when they come back on (the screensaver ending, the rows returning) starts.
	let focused = null;
	let videoModule = null;
	let trailerModule = null;

	const notify = (key, phase) => {
		const listener = listeners.get(key);
		if (listener) listener(phase);
	};

	const clearTimer = (name) => {
		if (timers[name]) {
			clearTimeout(timers[name]);
			timers[name] = null;
		}
	};

	const clearTimers = () => {
		clearTimer('dwell');
		clearTimer('open');
		clearTimer('cap');
	};

	const isActive = (id) => !!current && current.requestId === id;

	const holdThemeMusic = (held) => {
		if (themeHeld === held) return;
		themeHeld = held;
		if (onThemeMusicHold) onThemeMusicHold(held);
	};

	// The screensaver counts a playing preview as the screen doing something.
	const announce = (active) => {
		window.dispatchEvent(new CustomEvent('moonfin:trailerPreview', {detail: {active}}));
	};

	const applyAudio = (video) => {
		video.muted = !audioEnabled;
		video.volume = audioEnabled ? 1 : 0;
	};

	// Everything a preview took is handed back here, in an order that frees the
	// decoder first and tells the server last. Moving to a neighboring card keeps
	// the theme music hold so the music doesn't blip between the two.
	const stop = (reason, {release = true} = {}) => {
		const was = current;
		clearTimers();
		requestId += 1;
		current = null;
		if (!was) {
			if (reason !== 'replaced') holdThemeMusic(false);
			return;
		}
		const video = was.video;
		if (video) {
			video.onloadedmetadata = null;
			video.onresize = null;
			video.onplaying = null;
			video.onended = null;
			video.onerror = null;
			if (was.releaseStream) {
				try { was.releaseStream(); } catch (e) { /* ignore */ }
				was.releaseStream = null;
			}
			if (videoModule) {
				try { videoModule.cleanupVideoElement(video).catch(noop); } catch (e) { /* ignore */ }
			}
			resetVideoBox(video);
			if (video.parentNode) video.parentNode.removeChild(video);
		}
		if (release) releaseSharedVideo('preview');
		if (was.streamAttached && was.playSessionId) {
			try {
				Promise.resolve(was.serverApi.stopActiveEncodings(was.playSessionId)).catch(noop);
			} catch (e) { /* ignore */ }
		}
		if (reason !== 'replaced') holdThemeMusic(false);
		if (was.announced) announce(false);
		notify(was.key, 'idle');
	};

	// The element goes into the card's frame, so the stream only starts once the
	// card has drawn one. The open timer already runs, so a frame that never comes
	// still ends in a stop.
	const mount = async (entry, frame) => {
		if (entry.mounted) return;
		entry.mounted = true;
		const id = entry.requestId;
		let Hls = null;
		if (trailerModule.needsHlsJs(entry.url)) {
			Hls = (await import('hls.js')).default;
			if (!isActive(id)) return;
		}
		claimSharedVideo('preview', () => stop('evicted', {release: false}));
		const video = videoModule.getSharedVideoElement();
		entry.video = video;
		video.className = '';
		video.playsInline = true;
		video.controls = false;
		video.autoplay = true;
		video.loop = false;
		applyAudio(video);
		resetVideoBox(video);
		if (video.parentNode !== frame) frame.appendChild(video);

		video.onloadedmetadata = () => coverVideoInBox(video, frame);
		video.onresize = video.onloadedmetadata;
		video.onplaying = () => {
			if (!isActive(id) || entry.phase !== 'attached') return;
			entry.phase = 'playing';
			clearTimer('open');
			timers.cap = setTimeout(() => {
				timers.cap = null;
				if (isActive(id)) stop('cap');
			}, PREVIEW_PLAY_CAP_MS);
			coverVideoInBox(video, frame);
			entry.announced = true;
			announce(true);
			notify(entry.key, 'playing');
		};
		video.onended = () => {
			if (isActive(id)) stop('ended');
		};
		const fail = (what) => {
			if (!isActive(id)) return;
			serverLogger.warn(serverLogger.LOG_CATEGORIES.PLAYBACK, `Media preview ${what}`);
			stop('error');
		};
		video.onerror = () => fail('failed to play');

		entry.releaseStream = trailerModule.attachTrailerStream(video, entry.url, {
			Hls,
			startTime: entry.startTime,
			onError: () => fail('gave up on the manifest')
		});
		entry.streamAttached = true;
		let playPromise = null;
		try { playPromise = video.play(); } catch (e) { /* the error event reports it */ }
		if (playPromise && playPromise.catch) {
			playPromise.catch(() => {
				// A stop pauses the element, which rejects this same promise, and
				// autoplay with sound can be refused, so the retry is muted.
				if (!isActive(id) || video.muted) return;
				video.muted = true;
				video.volume = 0;
				let retry = null;
				try { retry = video.play(); } catch (e) { /* ignore */ }
				if (retry && retry.catch) retry.catch(noop);
			});
		}
	};

	const resolve = async (entry) => {
		const id = entry.requestId;
		entry.phase = 'resolving';
		holdThemeMusic(true);
		try {
			const serverApi = previewApiFor(entry.item, api);
			entry.serverApi = serverApi;
			const [target, loadedVideoModule, loadedTrailerModule, caps] = await Promise.all([
				resolvePreviewTarget(serverApi, entry.item),
				videoModule || import('@moonfin/platform-webos/video'),
				trailerModule || import('../../services/youtubeTrailer'),
				platform === 'webos' ? getDeviceCapabilities().catch(() => null) : null
			]);
			if (!isActive(id)) return;
			videoModule = loadedVideoModule;
			trailerModule = loadedTrailerModule;
			const server = previewServerOf(entry.item);
			if (!target || !server.serverUrl || !server.token) {
				stop('unavailable');
				return;
			}
			const source = target.MediaSources[0];
			entry.playSessionId = newPlaySessionId();
			entry.startTime = previewStartSeconds(target);
			entry.url = buildMediaPreviewUrl({
				serverUrl: server.serverUrl,
				serverType: server.serverType,
				token: server.token,
				deviceId: getDeviceId(),
				playSessionId: entry.playSessionId,
				itemId: target.Id,
				mediaSourceId: source.Id,
				audioStreamIndex: pickPreviewAudioIndex(source, getSettings() || {}),
				segmentContainer: previewSegmentContainer(platform, caps)
			});
			entry.phase = 'attached';
			timers.open = setTimeout(() => {
				timers.open = null;
				if (!isActive(id)) return;
				serverLogger.warn(serverLogger.LOG_CATEGORIES.PLAYBACK, 'Media preview didn\'t start in time');
				stop('timeout');
			}, PREVIEW_OPEN_TIMEOUT_MS);
			notify(entry.key, 'attached');
			const frame = frames.get(entry.key);
			if (frame) await mount(entry, frame);
		} catch (e) {
			if (isActive(id)) stop('error');
		}
	};

	// Focus on a card. The card already pending or playing is left alone, which is
	// what keeps the row's parking scroll and a re-focus from restarting the dwell.
	const schedule = (key, item) => {
		if (key) focused = {key, item};
		if (current && current.key === key) return;
		const qualifies = enabled && !!key && supportsMediaPreview(item) && !isMusicPlaying();
		if (current) stop(qualifies ? 'replaced' : 'blur');
		if (!qualifies) return;
		requestId += 1;
		current = {
			key,
			item,
			requestId,
			phase: 'pending',
			serverApi: null,
			video: null,
			releaseStream: null,
			streamAttached: false,
			mounted: false,
			announced: false,
			playSessionId: null,
			startTime: 0,
			url: null
		};
		const entry = current;
		timers.dwell = setTimeout(() => {
			timers.dwell = null;
			if (isActive(entry.requestId)) resolve(entry);
		}, PREVIEW_DWELL_MS);
	};

	const cancel = (key) => {
		if (focused && focused.key === key) focused = null;
		if (current && current.key === key) stop('blur');
	};

	const attachFrame = (key, el) => {
		if (el) frames.set(key, el);
		else frames.delete(key);
		if (!el || !current || current.key !== key) return;
		if (current.phase !== 'attached' && current.phase !== 'playing') return;
		if (current.video && current.video.parentNode !== el) el.appendChild(current.video);
		const entry = current;
		mount(entry, el).catch(() => {
			if (isActive(entry.requestId)) stop('error');
		});
	};

	const subscribe = (key, listener) => {
		listeners.set(key, listener);
		if (current && current.key === key && (current.phase === 'attached' || current.phase === 'playing')) {
			listener(current.phase);
		}
		return () => {
			if (listeners.get(key) === listener) listeners.delete(key);
		};
	};

	const setEnabled = (value) => {
		const was = enabled;
		enabled = !!value;
		if (!enabled && current) stop('disabled');
		if (enabled && !was && !current && focused) schedule(focused.key, focused.item);
	};

	const setAudioEnabled = (value) => {
		audioEnabled = value !== false;
		if (current && current.video) applyAudio(current.video);
	};

	const getCurrent = () => (current ? {key: current.key, phase: current.phase} : null);

	const dispose = () => {
		stop('unmount');
		focused = null;
		listeners.clear();
		frames.clear();
	};

	return {schedule, cancel, stop, setEnabled, setAudioEnabled, attachFrame, subscribe, getCurrent, dispose};
};
