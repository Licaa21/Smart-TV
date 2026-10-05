// Playback in WebView2 on Xbox.
//
// The WebView plays through a plain HTML5 video element, so the element, its
// cleanup and the visibility handling are the webOS ones. What differs is which
// files it can take as they are, and that the screen, the app's comings and
// goings and the media remote are the host's to report.
import {videoRangeTypeOf} from '@moonfin/app/src/utils/videoRange';
import {getSharedVideoElement as sharedVideoElement} from '@moonfin/platform-webos/video';
import {onShellMessage, postToShell} from './bridge';
import {pressOnFocused, raiseHostBack} from './keys';

export {giveControllerToGame} from './keys';

export {
	getMimeType,
	canRenderEmbeddedPgsInBand,
	cleanupVideoElement,
	waitForDecoderRelease,
	setupVisibilityHandler
} from '@moonfin/platform-webos/video';

const H264_NAMES = ['h264', 'avc'];
const HEVC_NAMES = ['hevc', 'h265', 'hev1', 'hvc1'];

export const getSharedVideoElement = () => {
	const video = sharedVideoElement();
	video.disableRemotePlayback = true;
	return video;
};

// A suspended app is frozen and may be ended at any moment, so the player lets
// go of playback and the user comes back to the details page.
export const leavesPlayerInBackground = true;

// A seek made before the first frame has shown never lands for HEVC here, though
// one made after it does. So such a file is opened at its start and the player seeks
// to the resume point once that frame is in.
export const resumesAfterFirstFrame = (mediaSource) => {
	const video = (mediaSource?.MediaStreams || []).find((stream) => stream.Type === 'Video');
	return HEVC_NAMES.includes((video?.Codec || '').toLowerCase());
};

// The page hears of its own visibility and the host of the app's, and one trip
// to the background can be told both ways, so only a change is passed on.
export const registerAppStateObserver = (onForeground, onBackground) => {
	let background = false;
	const set = (now) => {
		if (now === background) return;
		background = now;
		if (now) onBackground?.();
		else onForeground?.();
	};
	const onVisibility = () => set(document.hidden);
	document.addEventListener('visibilitychange', onVisibility);
	const removeState = onShellMessage('APP_STATE', (payload) => set(payload?.state !== 'active'));
	return () => {
		document.removeEventListener('visibilitychange', onVisibility);
		removeState();
	};
};

// What the host calls a button of the media remote, as the key the app handles for it.
const HOST_KEYS = {
	Play: 250,
	Pause: 19,
	Stop: 178,
	Rewind: 227,
	FastForward: 228
};

// The page cant count on the WebView noticing a dropped network on its own, so
// the host's word on it becomes the online and offline events the no connection
// screen listens for. The first message only says where things stand at boot.
// The media remote and a Back the system handed the host arrive the same way,
// and are raised on whatever has focus as the keys they stand for.
export const setupXboxLifecycle = () => {
	let connected = null;
	const removeNetwork = onShellMessage('NETWORK', (payload) => {
		const now = payload?.connected !== false;
		if (connected !== null && now !== connected) window.dispatchEvent(new Event(now ? 'online' : 'offline'));
		connected = now;
	});
	const removeKeys = onShellMessage('KEY', (payload) => {
		if (payload?.key === 'Back') raiseHostBack();
		else if (HOST_KEYS[payload?.key]) pressOnFocused({keyCode: HOST_KEYS[payload.key]});
	});
	return () => {
		removeNetwork();
		removeKeys();
	};
};

// What was heard to play on a console. DTS and TrueHD arent here, since the WebView
// plays the picture of such a file without a sound.
export const getSupportedAudioCodecs = (capabilities) => {
	const codecs = ['aac', 'mp3', 'flac', 'pcm_s16le', 'pcm_s24le'];
	if (capabilities.ac3) codecs.push('ac3');
	if (capabilities.eac3) codecs.push('eac3', 'ec3');
	if (capabilities.opus) codecs.push('opus');
	if (capabilities.vorbis) codecs.push('vorbis');
	return codecs;
};

export const isAudioStreamPlayable = (stream, capabilities) => {
	if (!stream) return false;
	const codec = (stream.Codec || '').toLowerCase();
	return !codec || getSupportedAudioCodecs(capabilities).includes(codec);
};

// No MPEG-TS, Chromium cant open one, so the server remuxes it
const VIDEO_CONTAINERS = ['mp4', 'm4v', 'mov', 'mkv', 'matroska'];
const AUDIO_CONTAINERS = ['mp3', 'aac', 'm4a', 'm4b', 'flac', 'wav', 'ogg', 'oga', 'opus'];

const rangeOk = (videoStream, capabilities) => {
	const rangeType = (videoRangeTypeOf(videoStream) || '').toUpperCase();
	if (!rangeType || rangeType === 'SDR') return true;
	if (rangeType.includes('DOVI') || rangeType.includes('DOLBY') || rangeType === 'DV') return false;
	if (rangeType.includes('HLG')) return !!capabilities.hlg;
	if (rangeType.includes('HDR')) return !!capabilities.hdr10;
	return true;
};

export const getPlayMethod = (mediaSource, capabilities, options = {}) => {
	if (!mediaSource) return 'Transcode';

	const container = (mediaSource.Container || '').toLowerCase();
	const containerParts = container.split(',').map((part) => part.trim());
	const streams = mediaSource.MediaStreams || [];
	const videoStream = streams.find((stream) => stream.Type === 'Video');
	const audioStreams = streams.filter((stream) => stream.Type === 'Audio');

	const audioOk = audioStreams.length === 0 || audioStreams.some((stream) => isAudioStreamPlayable(stream, capabilities));

	if (!videoStream) {
		const audioContainerOk = !container || containerParts.some((part) => AUDIO_CONTAINERS.includes(part));
		if (mediaSource.SupportsDirectPlay && audioOk && audioContainerOk) return 'DirectPlay';
		if (mediaSource.SupportsDirectStream && audioOk) return 'DirectStream';
		return 'Transcode';
	}

	const videoCodec = (videoStream.Codec || '').toLowerCase();
	const isHevc = HEVC_NAMES.includes(videoCodec);

	const videoOk = !videoCodec || H264_NAMES.includes(videoCodec) || (isHevc && !!capabilities.hevc);
	const containerOk = !container || containerParts.some((part) => VIDEO_CONTAINERS.includes(part));
	const hdrOk = rangeOk(videoStream, capabilities);
	// Only HEVC has the console's own decoder behind it, so nothing else goes past 1080p
	const sizeOk = !videoStream.Width || videoStream.Width <= 1920 || (capabilities.uhd && isHevc);
	const bitrateOk = !(options.maxBitrate > 0) || !videoStream.BitRate || videoStream.BitRate <= options.maxBitrate;

	const playable = videoOk && audioOk && containerOk && hdrOk && sizeOk && bitrateOk;
	if (mediaSource.SupportsDirectPlay && playable) return 'DirectPlay';
	if (mediaSource.SupportsDirectStream && playable) return 'DirectStream';
	return 'Transcode';
};

export const setDisplayWindow = async () => false;

// Only the host can keep the console from dimming the screen. The page says
// whether something is playing and the host holds or lets go of its request.
export const keepScreenOn = async (enable) => postToShell('KEEP_DISPLAY_ACTIVE', {active: !!enable});

export const getAudioOutputInfo = async () => null;
