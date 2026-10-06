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
jest.mock('./video', () => ({
	getPlayMethod: () => 'DirectPlay',
	getMimeType: () => 'video/x-matroska',
	isAudioStreamPlayable: () => true,
	canRenderEmbeddedPgsInBand: () => false
}));
jest.mock('./storage', () => ({getFromStorage: async () => ({})}));
jest.mock('./serverLogger', () => ({serverLogger: {playback: jest.fn(), playbackError: jest.fn()}}));
jest.mock('./systemVolume', () => ({getVolumeState: jest.fn(), lastVolumeState: () => null}));
jest.mock('../platform', () => ({isVega: () => false}));

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
const remux = (audio) => ({
	PlaySessionId: 'remux',
	MediaSources: [{
		Id: 'source', SupportsDirectPlay: false, SupportsDirectStream: true, Container: 'mkv', DefaultAudioStreamIndex: audio,
		TranscodingUrl: `/videos/ep-1/master.m3u8?AudioStreamIndex=${audio}`, MediaStreams: streams
	}]
});

beforeEach(async () => {
	await playback.reportStop(0);
	jest.clearAllMocks();
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
		expect(serverLogger.playbackError).toHaveBeenCalledWith(expect.stringContaining('built nothing'), expect.any(Object));
	});

	test('a later reload of the same item keeps the rule through the session', async () => {
		api.getPlaybackInfo.mockResolvedValueOnce(direct(4)).mockResolvedValueOnce(direct(6)).mockResolvedValueOnce(remux(6));
		await playback.getPlaybackInfo(episode.Id, {item: episode, directPlayOpensFirstAudio: true});
		const reloaded = await playback.getPlaybackInfo(episode.Id, {item: episode, audioStreamIndex: 6});
		expect(api.getPlaybackInfo).toHaveBeenCalledTimes(3);
		expect(reloaded.playMethod).not.toBe('DirectPlay');
	});
});
