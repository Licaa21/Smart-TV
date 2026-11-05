import {isTizen} from '../../platform';
import * as playback from '../../services/playback';
import {getDeviceProfile} from '../../services/deviceProfile';
import {getFromStorage} from '../../services/storage';

// Some servers list the reasons on the source. Jellyfin leaves them off and only writes them into
// the url it would transcode from.
const transcodeReasonsOf = (source, result) => {
	const listed = source.TranscodeReasons || source.TranscodingReasons || result?.TranscodeReasons;
	if (Array.isArray(listed) && listed.length) return listed;
	if (typeof listed === 'string' && listed) return listed.split(',');
	const match = /[?&]TranscodeReasons=([^&]+)/.exec(source.TranscodingUrl || '');
	return match ? decodeURIComponent(match[1]).split(',') : [];
};

// Silo opens a playback session on getPlaybackInfo, so it is asked through its own preview call with the profile and the
// cap playback would use (the viewer's own bitrate only, as in playback), not through the dry run below.
const fetchPreviewPlaybackInfo = async (api, {itemId, serverType, mediaSourceId, audioStreamIndex, subtitleStreamIndex, maxBitrate}) => {
	const deviceProfile = await getDeviceProfile(serverType, {}, api).catch(() => null);
	const maxStreamingBitrate = maxBitrate > 0 ? maxBitrate : serverType === 'silo' ? null : deviceProfile?.MaxStreamingBitrate;

	const body = {
		EnableDirectPlay: true,
		EnableDirectStream: true,
		EnableTranscoding: true
	};
	if (deviceProfile) body.DeviceProfile = deviceProfile;
	if (maxStreamingBitrate) body.MaxStreamingBitrate = maxStreamingBitrate;
	if (mediaSourceId) body.MediaSourceId = mediaSourceId;
	if (audioStreamIndex != null) body.AudioStreamIndex = audioStreamIndex;
	if (subtitleStreamIndex != null) body.SubtitleStreamIndex = subtitleStreamIndex;

	const result = await api.previewPlaybackInfo(itemId, body);
	const sources = result?.MediaSources || [];
	const source = (mediaSourceId && sources.find((s) => s.Id === mediaSourceId)) || sources[0];
	if (!source) return null;

	return {
		supportsDirectPlay: source.SupportsDirectPlay === true,
		supportsDirectStream: source.SupportsDirectStream === true,
		transcodeReasons: transcodeReasonsOf(source, result),
		source,
		deviceProfile,
		maxStreamingBitrate
	};
};

// What a press of Play would do with the tracks the screen has selected, found by running the start
// itself without starting anything: the same profile with every setting of this app laid on it, the same
// bitrate, the same choice of version and audio track, the same questions to the server and the same
// decision about how it plays. A copy of that decision here drifted from the real one, and a file that
// plays as it is read as a transcode.
//
// `item` is the title, which sends the request to the server it belongs to.
export const fetchDetailPlaybackInfo = async (api, {
	item,
	itemId,
	serverType,
	mediaSourceId,
	audioStreamIndex,
	subtitleStreamIndex,
	maxBitrate
} = {}) => {
	if (!api?.getPlaybackInfo || !itemId) return null;
	if (api.previewPlaybackInfo) {
		return fetchPreviewPlaybackInfo(api, {itemId, serverType, mediaSourceId, audioStreamIndex, subtitleStreamIndex, maxBitrate});
	}

	const settings = (await getFromStorage('settings')) || {};
	// The Samsung player opens a file on its first audio track, and queues a switch to the pick.
	const tizen = isTizen();

	const preview = await playback.getPlaybackInfo(itemId, {
		item,
		serverType,
		mediaSourceId,
		audioStreamIndex,
		subtitleStreamIndex,
		maxBitrate: maxBitrate > 0 ? maxBitrate : (settings.maxBitrate || undefined),
		// Prefer Transcoding turns direct play off for every start, which the player reads the same way.
		enableDirectPlay: !settings.preferTranscode,
		enableDirectStream: !settings.preferTranscode,
		forceDirectPlay: settings.forceDirectPlay,
		stereoUpmixEnabled: settings.stereoUpmixEnabled,
		directPlayOpensFirstAudio: tizen,
		switchInPlayer: tizen,
		dryRun: true
	});
	if (!preview?.mediaSource) return null;


	const {mediaSource: source, playMethod} = preview;
	return {
		supportsDirectPlay: playMethod === playback.PlayMethod.DirectPlay,
		supportsDirectStream: playMethod === playback.PlayMethod.DirectStream,
		// Only some servers say why they would transcode, so nothing here means no reason was
		// given rather than that there is no reason.
		transcodeReasons: transcodeReasonsOf(source),
		source,
		deviceProfile: preview.deviceProfile,
		maxStreamingBitrate: preview.maxBitrate,
		// The track the start would use, which is not the one asked for when that one cannot be played.
		audioStreamIndex: preview.audioStreamIndex,
		// The server builds the picked track, because the player opens on another codec.
		audioBuilt: preview.audioRebuilt,
		openingAudioCodec: preview.openingAudioCodec
	};
};
