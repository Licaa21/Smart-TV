import $L from '@enact/i18n/$L';

import {formatDirectPlayReason, resolveDirectPlayFailureDetails} from '../../utils/directPlayReasons';
import {videoLines} from './nouveau/nouveauFooterFields';
import {buildForkNotes} from './playbackInfoNotes';

// What the Playback Info popup says, worked out from the server's answer for the selected tracks
// (see detailPlaybackInfo). Nothing here asks the server anything.

const audioCodecOf = (streams, index) => String(streams.find((stream) => stream.Type === 'Audio' && stream.Index === index)?.Codec || '').toLowerCase();

const lower = (value) => String(value || '').toLowerCase();

export const bitrateText = (bitrate) => {
	if (!(bitrate > 0)) return null;
	return bitrate >= 1000000 ? `${(bitrate / 1000000).toFixed(1)} Mbps` : `${Math.round(bitrate / 1000)} kbps`;
};

export const playMethod = ({supportsDirectPlay, supportsDirectStream}) => {
	if (supportsDirectPlay) return 'direct';
	return supportsDirectStream ? 'stream' : 'transcode';
};

// Jellyfin names the reason the file can't play as it is, and the reason says which part the server
// has to rework. A container alone is only repackaged, anything audio is the sound, the rest (codec,
// profile, bit depth, range, bitrate, a burned in subtitle) is the picture.
const partsChanged = (reasons) => {
	const keys = reasons.map(lower).filter((key) => key && key !== 'directplayerror');
	return {
		audio: keys.some((key) => key.indexOf('audio') === 0 || key === 'secondaryaudionotsupported'),
		video: keys.some((key) => key !== 'containernotsupported' && key.indexOf('audio') !== 0 && key !== 'secondaryaudionotsupported'),
		known: keys.length > 0
	};
};

const changesText = (method, reasons) => {
	if (method === 'direct') return $L('The file is sent as it is.');

	const {audio, video, known} = partsChanged(reasons);
	// A direct stream is a repackage unless the reasons name something more.
	if (method === 'stream' && !video && !audio) return $L('Only the container changes. Video and audio are sent as they are.');
	if (video && audio) return $L('Video and audio are re-encoded.');
	if (video) return $L('Video is re-encoded. Audio is sent as it is.');
	if (audio) return $L('Audio is re-encoded. Video is sent as it is.');
	return known ? $L('Only the container changes. Video and audio are sent as they are.') : $L('The server did not say which parts change.');
};

const subtitleText = (stream, method, reasons) => {
	if (!stream) return $L('Off');
	const name = stream.DisplayTitle || String(stream.Codec || '').toUpperCase() || $L('Unknown');
	// Either the reason says so or the server marked this very track to be encoded into the picture.
	const burned = method !== 'direct' && (reasons.map(lower).indexOf('subtitlecodecnotsupported') !== -1 || lower(stream.DeliveryMethod) === 'encode');
	return `${name} · ${burned ? $L('Burned into the video') : $L('Sent as it is')}`;
};

const audioText = (stream) => {
	if (!stream) return null;
	const name = stream.DisplayTitle || [String(stream.Codec || '').toUpperCase(), stream.Channels ? `${stream.Channels}ch` : ''].filter(Boolean).join(' ');
	return [name, bitrateText(stream.BitRate)].filter(Boolean).join(' · ');
};

// The player opens a file on one track, and only a pick in that codec is switched by the player. Any other is
// built by the server, with the picture copied, so the popup would be wrong to call it a plain direct play.
const builtAudioReason = (opening, wanted) => ({
	description: $L('Opens on {first} audio, but you picked {picked}.')
		.replace('{first}', String(opening || '').toUpperCase())
		.replace('{picked}', String(wanted || '').toUpperCase()),
	hint: $L('This TV\'s player cannot switch to another codec dependably, so the server builds your track with the picture copied. If that needs a re-encode, the file plays as it is instead.')
});

// `audioStreamIndex` and `subtitleStreamIndex` are the tracks' own indexes, the ones the server was
// asked with, and a subtitle left undefined means none.
export const buildPlaybackInfo = (result, {audioStreamIndex, subtitleStreamIndex, settings, tizen = false} = {}) => {
	const {source, deviceProfile, maxStreamingBitrate} = result;
	// The server builds the picked track when the player would open the file on another codec, which the
	// start has already found out. Its answer is then a stream the server makes, whatever it was asked first.
	const built = Boolean(result.audioBuilt);
	const method = built ? 'stream' : playMethod(result);
	const streams = Array.isArray(source.MediaStreams) ? source.MediaStreams : [];
	const video = streams.find((stream) => stream.Type === 'Video');
	const audio = streams.find((stream) => stream.Type === 'Audio' && stream.Index === audioStreamIndex)
		|| streams.find((stream) => stream.Type === 'Audio');
	const subtitle = subtitleStreamIndex != null && subtitleStreamIndex >= 0
		? streams.find((stream) => stream.Type === 'Subtitle' && stream.Index === subtitleStreamIndex)
		: null;

	// The server's reasons and whatever the profile shows on top of them, so the summary and the list
	// under it come from the same set.
	const details = (method === 'direct' || built) ? [] : resolveDirectPlayFailureDetails({
		serverReasons: result.transcodeReasons,
		mediaStreams: streams,
		container: source.Container,
		sourceBitrate: source.Bitrate > 0 ? Math.trunc(source.Bitrate) : null,
		maxStreamingBitrate,
		audioStreamIndex,
		subtitleStreamIndex,
		deviceProfile
	});
	const reasons = details.map((detail) => detail.reason);

	const fileLines = [
		source.Container ? $L('Container: {container}').replace('{container}', String(source.Container).toUpperCase()) : null,
		bitrateText(source.Bitrate) ? $L('Bitrate: {bitrate}').replace('{bitrate}', bitrateText(source.Bitrate)) : null,
		bitrateText(maxStreamingBitrate) ? $L('Streaming limit: {bitrate}').replace('{bitrate}', bitrateText(maxStreamingBitrate)) : null
	];
	// The server's own words for what it would send, where it gave them.
	if (method !== 'direct' && source.TranscodingContainer) {
		const protocol = source.TranscodingSubProtocol ? ` (${String(source.TranscodingSubProtocol).toUpperCase()})` : '';
		fileLines.push($L('Sent as: {format}').replace('{format}', `${String(source.TranscodingContainer).toUpperCase()}${protocol}`));
	}

	const sections = [
		{id: 'file', title: $L('File Information'), lines: fileLines},
		{id: 'video', title: $L('Video'), lines: [videoLines(video).join(' · ')]},
		{id: 'audio', title: $L('Audio'), lines: [audioText(audio)]},
		{id: 'subtitle', title: $L('Subtitle'), lines: [subtitleText(subtitle, method, reasons)]}
	].map((section) => ({...section, lines: section.lines.filter(Boolean)})).filter((section) => section.lines.length);

	return {
		// Amber, since the picture is copied and only the sound is rebuilt.
		method,
		title: built ? $L('Audio built on the server') : {direct: $L('Direct Play'), stream: $L('Direct Stream'), transcode: $L('Transcoding')}[method],
		summary: built ? $L('The server is asked to build the audio track you picked, with the picture copied.') : changesText(method, reasons),
		// A pick the player cannot open the file on is not something a setting decides, so it is told as a reason.
		reasons: built ? [builtAudioReason(result.openingAudioCodec, audioCodecOf(streams, audioStreamIndex))] : details.map((detail) => formatDirectPlayReason(detail, settings)),
		notes: buildForkNotes({tizen, method, source, reasonKeys: reasons.map((reason) => String(reason).toLowerCase()), settings}),
		sections
	};
};
