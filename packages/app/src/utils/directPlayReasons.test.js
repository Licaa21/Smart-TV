import {buildDirectPlayReasonItems, formatDirectPlayReason, resolveDirectPlayFailureDetails, transcodeReasonLabel} from './directPlayReasons';

jest.mock('@enact/i18n/$L', () => ({__esModule: true, default: (str) => str}));

const videoDirectPlay = [{Type: 'Video', Container: 'mkv,mp4,ts', VideoCodec: 'h264,hevc', AudioCodec: 'aac,ac3'}];

const profile = {
	DirectPlayProfiles: [
		...videoDirectPlay,
		{Type: 'Audio', Container: 'flac,mp3', AudioCodec: 'flac,mp3'}
	]
};

// Encode is the server burning the frames in, so a PGS stream can only reach the set through a
// transcode.
const encodeOnlyPgs = {
	DirectPlayProfiles: videoDirectPlay,
	SubtitleProfiles: [
		{Format: 'srt', Method: 'External'},
		{Format: 'pgs', Method: 'Encode'},
		{Format: 'pgssub', Method: 'Encode'}
	]
};

const streams = ({videoCodec = 'h264', audioCodec = 'aac', subtitleCodec, subtitleIndex = 4} = {}) => [
	{Type: 'Video', Index: 0, Codec: videoCodec},
	{Type: 'Audio', Index: 1, Codec: audioCodec},
	...(subtitleCodec ? [{Type: 'Subtitle', Index: subtitleIndex, Codec: subtitleCodec}] : [])
];

const reasonsOf = (details) => details.map((detail) => detail.reason);

describe('resolveDirectPlayFailureDetails', () => {
	test('keeps the server reasons first and as they were written', () => {
		expect(reasonsOf(resolveDirectPlayFailureDetails({serverReasons: ['VideoCodecNotSupported', 'DirectPlayError']})))
			.toEqual(['VideoCodecNotSupported', 'DirectPlayError']);
	});

	test('names a bitrate over the ceiling with both numbers', () => {
		const [first] = resolveDirectPlayFailureDetails({sourceBitrate: 25000000, maxStreamingBitrate: 10000000, container: 'mkv', deviceProfile: profile});
		expect(first).toEqual({reason: 'VideoBitrateExceedsLimit', sourceBitrate: 25000000, maxStreamingBitrate: 10000000});
	});

	test('takes another spelling of the ceiling from the server as already said', () => {
		const details = resolveDirectPlayFailureDetails({
			serverReasons: ['ContainerBitrateExceedsLimit'], sourceBitrate: 25000000, maxStreamingBitrate: 10000000, deviceProfile: profile
		});
		expect(reasonsOf(details)).toEqual(['ContainerBitrateExceedsLimit']);
	});

	test('names a container the profile leaves out', () => {
		const details = resolveDirectPlayFailureDetails({container: 'avi', deviceProfile: profile});
		expect(details).toContainEqual({reason: 'ContainerNotSupported', container: 'avi'});
	});

	test('names the video and audio codecs a silent server left out', () => {
		const details = resolveDirectPlayFailureDetails({container: 'mkv', mediaStreams: streams({videoCodec: 'vp9', audioCodec: 'truehd'}), deviceProfile: profile});
		expect(details).toContainEqual({reason: 'VideoCodecNotSupported', codec: 'vp9'});
		expect(details).toContainEqual({reason: 'AudioCodecNotSupported', codec: 'truehd'});
	});

	test('reads a range the codec profile turns away', () => {
		const details = resolveDirectPlayFailureDetails({
			container: 'mkv',
			mediaStreams: [{Type: 'Video', Index: 0, Codec: 'hevc', VideoRangeType: 'DOVI'}, {Type: 'Audio', Index: 1, Codec: 'aac'}],
			deviceProfile: {
				DirectPlayProfiles: videoDirectPlay,
				CodecProfiles: [{Type: 'Video', Codec: 'hevc', Conditions: [{Property: 'VideoRangeType', Condition: 'NotEquals', Value: 'DOVI|DOVI_WITH_HDR10'}]}]
			}
		});
		expect(details).toContainEqual({reason: 'VideoRangeTypeNotSupported', codec: 'hevc', rangeType: 'DOVI'});
	});

	test("reads a video profile the codec profile doesn't list", () => {
		const details = resolveDirectPlayFailureDetails({
			container: 'mkv',
			mediaStreams: [{Type: 'Video', Index: 0, Codec: 'h264', Profile: 'High 10'}, {Type: 'Audio', Index: 1, Codec: 'aac'}],
			deviceProfile: {
				DirectPlayProfiles: videoDirectPlay,
				CodecProfiles: [{Type: 'Video', Codec: 'h264', Conditions: [{Property: 'VideoProfile', Condition: 'EqualsAny', Value: 'high|main|baseline'}]}]
			}
		});
		expect(details).toContainEqual({reason: 'VideoProfileNotSupported', codec: 'h264', videoProfile: 'high 10'});
	});

	test('reads an audio channel cap', () => {
		const details = resolveDirectPlayFailureDetails({
			container: 'mkv',
			mediaStreams: [{Type: 'Video', Index: 0, Codec: 'h264'}, {Type: 'Audio', Index: 1, Codec: 'aac', Channels: 6}],
			deviceProfile: {
				DirectPlayProfiles: videoDirectPlay,
				CodecProfiles: [{Type: 'VideoAudio', Codec: 'aac', Conditions: [{Property: 'AudioChannels', Condition: 'LessThanEqual', Value: '2'}]}]
			}
		});
		expect(details).toContainEqual({reason: 'AudioChannelsNotSupported', codec: 'aac', audioChannels: 6});
	});

	test('names a subtitle the profile can only burn in', () => {
		const details = resolveDirectPlayFailureDetails({
			container: 'mkv',
			mediaStreams: streams({videoCodec: 'hevc', subtitleCodec: 'pgssub'}),
			subtitleStreamIndex: 4,
			deviceProfile: encodeOnlyPgs
		});
		expect(details).toContainEqual({reason: 'SubtitleCodecNotSupported', codec: 'pgssub'});
	});

	test('leaves a subtitle alone when none is picked or flagged', () => {
		const details = resolveDirectPlayFailureDetails({
			container: 'mkv', mediaStreams: streams({subtitleCodec: 'pgssub'}), deviceProfile: encodeOnlyPgs
		});
		expect(reasonsOf(details)).toEqual(['DirectPlayError']);
	});

	test('falls back to a general reason when nothing else explains it', () => {
		expect(reasonsOf(resolveDirectPlayFailureDetails({container: 'mkv', mediaStreams: streams(), deviceProfile: profile})))
			.toEqual(['DirectPlayError']);
	});
});

describe('formatDirectPlayReason', () => {
	test('names the audio codec and points at passthrough while it is off or automatic', () => {
		const reason = {reason: 'AudioCodecNotSupported', codec: 'truehd'};
		expect(formatDirectPlayReason(reason, {audioPassthroughMode: 'auto'})).toEqual({
			description: 'Audio codec (TRUEHD) is not supported directly.',
			hint: 'Tip: If your audio receiver or soundbar supports TRUEHD, enable Audio Passthrough in Audio Preferences.'
		});
		expect(formatDirectPlayReason(reason, {audioPassthroughMode: 'manual'}).hint).toBeNull();
	});

	test('points at no passthrough setting on Xbox', () => {
		window.__MOONFIN_XBOX__ = {v: 1};
		try {
			expect(formatDirectPlayReason({reason: 'AudioCodecNotSupported', codec: 'truehd'}, {audioPassthroughMode: 'auto'}).hint).toBeNull();
		} finally {
			delete window.__MOONFIN_XBOX__;
		}
	});

	test('says what the channel count is', () => {
		expect(formatDirectPlayReason({reason: 'AudioChannelsNotSupported', audioChannels: 8}).description)
			.toBe('Audio channel count (8ch) exceeds the player limit.');
	});

	test('points a styled subtitle at its setting only while that setting is off', () => {
		expect(formatDirectPlayReason({reason: 'SubtitleCodecNotSupported', codec: 'ass'}, {assDirectPlay: false}).hint)
			.toBe('Tip: Enable \'Direct play ASS/SSA subtitles\' in Subtitle Preferences to play directly without transcoding.');
		expect(formatDirectPlayReason({reason: 'SubtitleCodecNotSupported', codec: 'ass'}, {assDirectPlay: true})).toEqual({
			description: 'Subtitle format (ASS) is not supported directly and must be burned in.'
		});
		expect(formatDirectPlayReason({reason: 'SubtitleCodecNotSupported', codec: 'pgssub'}, {enablePgsRendering: false}).description)
			.toBe('PGS subtitles require transcoding because direct play is turned off.');
	});

	test('reads every spelling of the bitrate ceiling the same way, with the numbers', () => {
		['VideoBitrateExceedsLimit', 'ContainerBitrateExceedsLimit', 'VideoBitrateNotSupported'].forEach((reason) => {
			expect(formatDirectPlayReason({reason, sourceBitrate: 25000000, maxStreamingBitrate: 10000000})).toEqual({
				description: 'File bitrate (25.0 Mbps) exceeds the configured streaming limit (10.0 Mbps).',
				hint: 'Tip: Increase \'Max Streaming Bitrate\' in Video Playback Preferences to allow direct streaming.'
			});
		});
	});

	test("explains a range the display can't show", () => {
		expect(formatDirectPlayReason({reason: 'VideoRangeTypeNotSupported'}).description)
			.toBe('Video dynamic range (e.g. Dolby Vision / HDR) is not supported by this display.');
	});

	test('keeps a reason it has no words for as the server wrote it', () => {
		expect(formatDirectPlayReason({reason: 'SomethingNew'})).toEqual({description: 'SomethingNew'});
	});
});

describe('buildDirectPlayReasonItems', () => {
	test('turns what the server and the profile say into sentences', () => {
		const items = buildDirectPlayReasonItems({
			serverReasons: ['AudioCodecNotSupported'],
			mediaSource: {Container: 'mkv', Bitrate: 5000000, MediaStreams: streams({audioCodec: 'dts'})},
			deviceProfile: profile,
			settings: {audioPassthroughMode: 'disabled'},
			audioStreamIndex: 1
		});
		expect(items).toEqual([{
			description: 'Audio codec (DTS) is not supported directly.',
			hint: 'Tip: If your audio receiver or soundbar supports DTS, enable Audio Passthrough in Audio Preferences.'
		}]);
	});
});

describe('transcodeReasonLabel', () => {
	test('gives a short phrase for a known reason and the reason itself otherwise', () => {
		expect(transcodeReasonLabel('ContainerNotSupported')).toBe('Container format is not supported by the player.');
		expect(transcodeReasonLabel('VideoCodecTagNotSupported')).toBe('VideoCodecTagNotSupported');
	});
});
