import * as playback from './playback';
import * as jellyfinApi from './jellyfinApi';
import {serverLogger} from './serverLogger';

jest.mock('./jellyfinApi', () => {
	const server = {getPlaybackInfo: jest.fn(), closeLiveStream: jest.fn(), reportPlaybackStopped: jest.fn()};
	return {
		api: server,
		createApiForServer: () => server,
		getServerType: () => 'jellyfin',
		getServerUrl: () => 'http://server',
		getApiKey: () => 'key',
		getDeviceId: () => 'device',
		getTokenParam: () => 'ApiKey'
	};
});
jest.mock('./deviceProfile', () => ({
	getDeviceProfile: async () => ({}),
	getDeviceCapabilities: async () => ({})
}));
const mockPlayMethod = jest.fn(() => 'DirectPlay');
jest.mock('./video', () => ({
	getPlayMethod: (...args) => mockPlayMethod(...args),
	getMimeType: () => 'video/x-matroska',
	isAudioStreamPlayable: () => true,
	canRenderEmbeddedPgsInBand: () => false
}));
jest.mock('./storage', () => ({getFromStorage: async () => ({})}));
jest.mock('./serverLogger', () => ({serverLogger: {playback: jest.fn(), playbackError: jest.fn()}}));
jest.mock('./systemVolume', () => ({getVolumeState: jest.fn(), lastVolumeState: () => null}));
jest.mock('../platform', () => ({isVega: () => false, isXbox: () => false}));

const {api} = jellyfinApi;
const episode = {Id: 'ep-1', Type: 'Episode'};

// A file with the layout from the report: Japanese FLAC first, then TrueHD and AC3 in English.
const streams = [
	{Type: 'Video', Index: 0, Codec: 'h264'},
	{Type: 'Audio', Index: 4, Codec: 'flac', Language: 'jpn'},
	{Type: 'Audio', Index: 5, Codec: 'truehd', Language: 'eng'},
	{Type: 'Audio', Index: 6, Codec: 'ac3', Language: 'eng'}
];
const direct = (defaultAudio) => ({
	PlaySessionId: 'direct',
	MediaSources: [{Id: 'source', SupportsDirectPlay: true, SupportsDirectStream: true, Container: 'mkv', DefaultAudioStreamIndex: defaultAudio, MediaStreams: streams}]
});
const remux = (audio, video = 'h264') => ({
	PlaySessionId: 'remux',
	MediaSources: [{
		Id: 'source', SupportsDirectPlay: false, SupportsDirectStream: true, Container: 'mkv', DefaultAudioStreamIndex: audio,
		TranscodingUrl: `/videos/ep-1/master.m3u8?AudioStreamIndex=${audio}&VideoCodec=${video}`, MediaStreams: streams
	}]
});

beforeEach(async () => {
	await playback.reportStop(0);
	jest.clearAllMocks();
	mockPlayMethod.mockImplementation(() => 'DirectPlay');
	api.closeLiveStream.mockResolvedValue(null);
	api.reportPlaybackStopped.mockResolvedValue(null);
});

describe('direct play and the audio track', () => {
	test('a track that is not the first is asked for again with direct play off', async () => {
		api.getPlaybackInfo.mockResolvedValueOnce(direct(6)).mockResolvedValueOnce(remux(6));
		const result = await playback.getPlaybackInfo(episode.Id, {item: episode, audioStreamIndex: 6, directPlayOpensFirstAudio: true});
		expect(api.getPlaybackInfo).toHaveBeenCalledTimes(2);
		expect(api.getPlaybackInfo.mock.calls[1][1]).toMatchObject({EnableDirectPlay: false, AudioStreamIndex: 6});
		expect(result.playMethod).not.toBe('DirectPlay');
	});

	test('the first track stays a direct play', async () => {
		api.getPlaybackInfo.mockResolvedValue(direct(4));
		const result = await playback.getPlaybackInfo(episode.Id, {item: episode, audioStreamIndex: 4, directPlayOpensFirstAudio: true});
		expect(api.getPlaybackInfo).toHaveBeenCalledTimes(1);
		expect(result.playMethod).toBe('DirectPlay');
	});

	test('no track named, or a player that switches tracks itself, stays a direct play', async () => {
		api.getPlaybackInfo.mockResolvedValue(direct(6));
		expect((await playback.getPlaybackInfo(episode.Id, {item: episode, directPlayOpensFirstAudio: true})).playMethod).toBe('DirectPlay');
		await playback.reportStop(0);
		expect((await playback.getPlaybackInfo(episode.Id, {item: episode, audioStreamIndex: 6})).playMethod).toBe('DirectPlay');
		expect(api.getPlaybackInfo).toHaveBeenCalledTimes(2);
	});

	test('Force Direct Play is left alone', async () => {
		api.getPlaybackInfo.mockResolvedValue(direct(6));
		const result = await playback.getPlaybackInfo(episode.Id, {item: episode, audioStreamIndex: 6, directPlayOpensFirstAudio: true, forceDirectPlay: true});
		expect(api.getPlaybackInfo).toHaveBeenCalledTimes(1);
		expect(result.playMethod).toBe('DirectPlay');
	});

	test('Force Direct Play stays on through a reload that does not repeat it', async () => {
		api.getPlaybackInfo.mockResolvedValue(direct(6));
		await playback.getPlaybackInfo(episode.Id, {item: episode, directPlayOpensFirstAudio: true, forceDirectPlay: true});
		const reloaded = await playback.getPlaybackInfo(episode.Id, {item: episode, audioStreamIndex: 6});
		expect(api.getPlaybackInfo).toHaveBeenCalledTimes(2);
		expect(reloaded.playMethod).toBe('DirectPlay');
	});

	test('an empty answer to the rebuild leaves the first answer and says so', async () => {
		api.getPlaybackInfo.mockResolvedValueOnce(direct(6)).mockResolvedValueOnce({PlaySessionId: 'none', MediaSources: []});
		const result = await playback.getPlaybackInfo(episode.Id, {item: episode, audioStreamIndex: 6, directPlayOpensFirstAudio: true});
		expect(result.playMethod).toBe('DirectPlay');
		expect(serverLogger.playback).toHaveBeenCalledWith(expect.stringContaining('asked the server'), expect.objectContaining({answer: null, videoCopied: false, kept: 'direct play'}));
	});

	test('an answer that re-encodes the picture is refused and the direct play stays', async () => {
		mockPlayMethod.mockImplementation((source) => (source.SupportsDirectPlay ? 'DirectPlay' : 'Transcode'));
		api.getPlaybackInfo.mockResolvedValueOnce(direct(6)).mockResolvedValueOnce(remux(6, 'hevc'));
		const result = await playback.getPlaybackInfo(episode.Id, {item: episode, audioStreamIndex: 6, directPlayOpensFirstAudio: true});
		expect(result.playMethod).toBe('DirectPlay');
		expect(serverLogger.playback).toHaveBeenCalledWith(expect.stringContaining('asked the server'), expect.objectContaining({videoCopied: false, kept: 'direct play'}));
	});

	test('an answer that is direct play again has built nothing, and the direct play stays', async () => {
		api.getPlaybackInfo.mockResolvedValueOnce(direct(6)).mockResolvedValueOnce(direct(6));
		const result = await playback.getPlaybackInfo(episode.Id, {item: episode, audioStreamIndex: 6, directPlayOpensFirstAudio: true});
		expect(result.playMethod).toBe('DirectPlay');
		expect(serverLogger.playback).toHaveBeenCalledWith(expect.stringContaining('asked the server'), expect.objectContaining({kept: 'direct play'}));
	});

	test('a remux that names a video reason is a re-encode', async () => {
		mockPlayMethod.mockImplementation((source) => (source.SupportsDirectPlay ? 'DirectPlay' : 'Transcode'));
		const reencode = remux(6);
		reencode.MediaSources[0].TranscodingUrl += '&TranscodeReasons=VideoBitrateNotSupported';
		api.getPlaybackInfo.mockResolvedValueOnce(direct(6)).mockResolvedValueOnce(reencode);
		const result = await playback.getPlaybackInfo(episode.Id, {item: episode, audioStreamIndex: 6, directPlayOpensFirstAudio: true});
		expect(result.playMethod).toBe('DirectPlay');
	});

	test('the default subtitle being an image does not hand direct play back after a rebuild', async () => {
		mockPlayMethod.mockImplementation((source) => (source.SupportsDirectPlay ? 'DirectPlay' : 'Transcode'));
		const withPgs = (answer) => {
			answer.MediaSources[0].DefaultSubtitleStreamIndex = 10;
			answer.MediaSources[0].MediaStreams = [...streams, {Type: 'Subtitle', Index: 10, Codec: 'pgssub', IsTextSubtitleStream: false}];
			return answer;
		};
		api.getPlaybackInfo
			.mockResolvedValueOnce(withPgs(direct(6)))
			.mockResolvedValueOnce(withPgs(remux(6)))
			.mockResolvedValueOnce(withPgs(remux(6)));
		await playback.getPlaybackInfo(episode.Id, {item: episode, audioStreamIndex: 6, directPlayOpensFirstAudio: true});
		expect(api.getPlaybackInfo).toHaveBeenCalledTimes(3);
		api.getPlaybackInfo.mock.calls.slice(1).forEach(([, body]) => expect(body.EnableDirectPlay).toBe(false));
	});

	test('going back to the first track is a direct play again, any other track is not', async () => {
		api.getPlaybackInfo.mockResolvedValueOnce(direct(4)).mockResolvedValueOnce(direct(4)).mockResolvedValueOnce(direct(4)).mockResolvedValueOnce(remux(6));
		await playback.getPlaybackInfo(episode.Id, {item: episode, directPlayOpensFirstAudio: true});
		await playback.changeAudioStream(4, 0);
		expect(api.getPlaybackInfo.mock.calls[1][1].EnableDirectPlay).toBe(true);
		await playback.changeAudioStream(6, 0);
		expect(api.getPlaybackInfo.mock.calls[api.getPlaybackInfo.mock.calls.length - 1][1].EnableDirectPlay).toBe(false);
	});

	test('a repair is refused when the server would re-encode the picture, and the session stays', async () => {
		mockPlayMethod.mockImplementation((source) => (source.SupportsDirectPlay ? 'DirectPlay' : 'Transcode'));
		api.getPlaybackInfo.mockResolvedValueOnce(direct(4)).mockResolvedValueOnce(remux(6, 'hevc'));
		await playback.getPlaybackInfo(episode.Id, {item: episode, directPlayOpensFirstAudio: true});
		await expect(playback.changeAudioStream(6, 0, {refuseVideoReencode: true})).rejects.toMatchObject({code: 'REENCODE_REFUSED'});
		// a manual pick takes whatever the server builds
		api.getPlaybackInfo.mockResolvedValueOnce(remux(6, 'hevc'));
		await expect(playback.changeAudioStream(6, 0)).resolves.toMatchObject({playMethod: 'Transcode'});
	});

	test('a later reload of the same item keeps the rule through the session', async () => {
		api.getPlaybackInfo.mockResolvedValueOnce(direct(4)).mockResolvedValueOnce(direct(6)).mockResolvedValueOnce(remux(6));
		await playback.getPlaybackInfo(episode.Id, {item: episode, directPlayOpensFirstAudio: true});
		const reloaded = await playback.getPlaybackInfo(episode.Id, {item: episode, audioStreamIndex: 6});
		expect(api.getPlaybackInfo).toHaveBeenCalledTimes(3);
		expect(reloaded.playMethod).not.toBe('DirectPlay');
	});
});
