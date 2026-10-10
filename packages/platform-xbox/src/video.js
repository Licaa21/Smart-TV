// Playback on Xbox.
//
// The host has the console's own player behind the WebView, and that is what the
// page's video element drives unless the viewer turns it off, see nativeVideo.js.
// Otherwise the WebView plays through a plain HTML5 video element, and the element,
// its cleanup and the visibility handling are the webOS ones. Either way the screen,
// the app's comings and goings and the media remote are the host's to report.
import {isBurnInSubtitleCodec} from '@moonfin/app/src/utils/subtitleCodecs';
import {videoRangeTypeOf} from '@moonfin/app/src/utils/videoRange';
import {
	getSharedVideoElement as sharedVideoElement,
	cleanupVideoElement as cleanupWebVideoElement,
	waitForDecoderRelease as waitForWebDecoderRelease
} from '@moonfin/platform-webos/video';
import {onShellMessage, postToShell} from './bridge';
import {noteHevcRefusal} from './deviceProfile';
import {pressOnFocused, raiseHostBack} from './keys';
import {closeNativeVideo, getNativeVideoElement, isNativePlayerEnabled, isNativeVideoElement, placeNativeVideo} from './nativeVideo';

export {giveControllerToGame} from './keys';

// A console has no remote with a Back key to open a game's menu with
export const controllerIsOnlyRemote = true;

export {
	getMimeType,
	canRenderEmbeddedPgsInBand,
	setupVisibilityHandler
} from '@moonfin/platform-webos/video';

const H264_NAMES = ['h264', 'avc'];
const HEVC_NAMES = ['hevc', 'h265', 'hev1', 'hvc1'];
// What the console player decodes besides H.264 and HEVC, none of it past 1080p
const NATIVE_ONLY_NAMES = ['mpeg2video', 'mpeg4', 'vc1'];

export const getSharedVideoElement = () => {
	if (isNativePlayerEnabled()) return getNativeVideoElement();
	const video = sharedVideoElement();
	video.disableRemotePlayback = true;
	return video;
};

// The console player's element is let go of through the host. Any other element,
// like the one trailers play in, is the WebView's and is cleaned the webOS way.
export const cleanupVideoElement = (video) => (isNativeVideoElement(video) ? closeNativeVideo(video) : cleanupWebVideoElement(video));

// DVD and DVB bitmap subtitles have no renderer in the page, and the console player draws
// them itself out of a file it plays as it is.
export const rendersSubtitleInHost = (codec) => isNativePlayerEnabled() && isBurnInSubtitleCodec(codec);
export const showHostSubtitle = (video, index) => isNativeVideoElement(video) && video.selectSubtitleNative(index);

// The WebView's decoder isnt in play with the console player, so there is nothing to wait for.
export const waitForDecoderRelease = () => (isNativePlayerEnabled() ? Promise.resolve() : waitForWebDecoderRelease());

// A suspended app is frozen and may be ended at any moment, so the player lets
// go of playback and the user comes back to the details page.
export const leavesPlayerInBackground = true;

const hasHevcVideo = (mediaSource) => {
	const video = (mediaSource?.MediaStreams || []).find((stream) => stream.Type === 'Video');
	return HEVC_NAMES.includes((video?.Codec || '').toLowerCase());
};

// In the WebView a seek made before the first frame has shown never lands for HEVC,
// though one made after it does. So such a file is opened at its start and the player
// seeks to the resume point once that frame is in. The console player opens at the
// resume point itself.
export const resumesAfterFirstFrame = (mediaSource) => !isNativePlayerEnabled() && hasHevcVideo(mediaSource);

// A console whose WebView decoder wont open an HEVC file says so in the error, and
// the profile wants to know.
export const notePlaybackError = (error, mediaSource, playMethod) => {
	if (isNativePlayerEnabled() || playMethod === 'Transcode' || !hasHevcVideo(mediaSource)) return;
	if (!/DECODER_ERROR_NOT_SUPPORTED/.test(error?.message || '')) return;
	noteHevcRefusal(mediaSource.Id);
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

// The console player decodes every common sound format itself. The WebView plays
// the picture of a DTS or TrueHD file without a sound, so those arent offered there.
export const getSupportedAudioCodecs = (capabilities) => {
	const codecs = ['aac', 'mp3', 'flac', 'pcm_s16le', 'pcm_s24le'];
	if (capabilities.ac3) codecs.push('ac3');
	if (capabilities.eac3) codecs.push('eac3', 'ec3');
	if (capabilities.opus) codecs.push('opus');
	if (capabilities.vorbis) codecs.push('vorbis');
	if (capabilities.dts) codecs.push('dts', 'truehd');
	return codecs;
};

export const isAudioStreamPlayable = (stream, capabilities) => {
	if (!stream) return false;
	const codec = (stream.Codec || '').toLowerCase();
	return !codec || getSupportedAudioCodecs(capabilities).includes(codec);
};

// Chromium cant open an MPEG-TS or WebM file, so the server remuxes those for it
const VIDEO_CONTAINERS = ['mp4', 'm4v', 'mov', 'mkv', 'matroska'];
const NATIVE_VIDEO_CONTAINERS = [...VIDEO_CONTAINERS, 'webm', 'ts', 'mpegts'];
const AUDIO_CONTAINERS = ['mp3', 'aac', 'm4a', 'm4b', 'flac', 'wav', 'ogg', 'oga', 'opus'];

// Dolby Vision plays as its HDR10 base layer where there is one, profile 5 has none
const HDR10_BASED_DOVI = ['DOVIWITHHDR10', 'DOVIWITHHDR10PLUS', 'DOVIWITHEL', 'DOVIWITHELHDR10PLUS', 'DOVIINVALID'];

const rangeOk = (videoStream, capabilities) => {
	const rangeType = (videoRangeTypeOf(videoStream) || '').toUpperCase();
	if (!rangeType || rangeType === 'SDR') return true;
	if (HDR10_BASED_DOVI.includes(rangeType)) return !!capabilities.hdr10;
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
	const containers = capabilities.nativePlayer ? NATIVE_VIDEO_CONTAINERS : VIDEO_CONTAINERS;

	const videoOk = !videoCodec || H264_NAMES.includes(videoCodec) || (isHevc && !!capabilities.hevc) || (!!capabilities.nativePlayer && NATIVE_ONLY_NAMES.includes(videoCodec));
	const containerOk = !container || containerParts.some((part) => containers.includes(part));
	const hdrOk = rangeOk(videoStream, capabilities);
	// Only HEVC has the console's own decoder behind it, so nothing else goes past 1080p
	const sizeOk = !videoStream.Width || videoStream.Width <= 1920 || (capabilities.uhd && isHevc);
	const bitrateOk = !(options.maxBitrate > 0) || !videoStream.BitRate || videoStream.BitRate <= options.maxBitrate;

	const playable = videoOk && audioOk && containerOk && hdrOk && sizeOk && bitrateOk;
	if (mediaSource.SupportsDirectPlay && playable) return 'DirectPlay';
	if (mediaSource.SupportsDirectStream && playable) return 'DirectStream';
	return 'Transcode';
};

// The console player is put where the page laid its element out, so the subtitles
// drawn over it line up. The WebView's element needs nothing.
export const setDisplayWindow = async () => isNativePlayerEnabled() && placeNativeVideo();

// Only the host can keep the console from dimming the screen. The page says
// whether something is playing and the host holds or lets go of its request.
export const keepScreenOn = async (enable) => postToShell('KEEP_DISPLAY_ACTIVE', {active: !!enable});

export const getAudioOutputInfo = async () => null;
