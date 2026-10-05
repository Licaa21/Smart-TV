import * as playback from './playback';
import * as jellyfinApi from './jellyfinApi';

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
	getMimeType: () => 'video/mp2t',
	isAudioStreamPlayable: () => true,
	canRenderEmbeddedPgsInBand: () => false
}));
jest.mock('./storage', () => ({getFromStorage: async () => ({})}));
jest.mock('./serverLogger', () => ({serverLogger: {playback: jest.fn()}}));
jest.mock('./systemVolume', () => ({getVolumeState: jest.fn(), lastVolumeState: () => null}));
jest.mock('../platform', () => ({isVega: () => false}));

const {api} = jellyfinApi;
const channel = {Id: 'channel-1', Type: 'TvChannel'};
const movie = {Id: 'movie-1', Type: 'Movie'};

// Answers each PlaybackInfo with a live source carrying the next id from `ids`.
const answerLive = (...ids) => {
	ids.forEach((id) => api.getPlaybackInfo.mockResolvedValueOnce({
		PlaySessionId: `session-${id}`,
		MediaSources: [{Id: 'source', LiveStreamId: id, SupportsDirectPlay: true, Container: 'ts', MediaStreams: []}]
	}));
};

const answerMovie = () => api.getPlaybackInfo.mockResolvedValue({
	PlaySessionId: 'session',
	MediaSources: [{Id: 'source', SupportsDirectPlay: true, Container: 'mkv', MediaStreams: []}]
});

beforeEach(async () => {
	await playback.reportStop(0);
	jest.clearAllMocks();
	api.closeLiveStream.mockResolvedValue(null);
	api.reportPlaybackStopped.mockResolvedValue(null);
});

describe('live streams', () => {
	test('a replaced session closes its stream once the new PlaybackInfo is back', async () => {
		answerLive('live-a', 'live-b');
		await playback.getPlaybackInfo(channel.Id, {item: channel});
		expect(api.closeLiveStream).not.toHaveBeenCalled();
		await playback.getPlaybackInfo(channel.Id, {item: channel, audioStreamIndex: 2});
		expect(api.closeLiveStream).toHaveBeenCalledTimes(1);
		expect(api.closeLiveStream).toHaveBeenCalledWith('live-a');
	});

	test('the stream is closed even when the new PlaybackInfo carries the same id', async () => {
		answerLive('live-a', 'live-a');
		await playback.getPlaybackInfo(channel.Id, {item: channel});
		await playback.getPlaybackInfo(channel.Id, {item: channel});
		expect(api.closeLiveStream).toHaveBeenCalledTimes(1);
		await playback.reportStop(0);
		expect(api.closeLiveStream).toHaveBeenCalledTimes(2);
	});

	test('a stop closes the stream the session holds and only that one', async () => {
		answerLive('live-a', 'live-b');
		await playback.getPlaybackInfo(channel.Id, {item: channel});
		await playback.getPlaybackInfo(channel.Id, {item: channel});
		await playback.reportStop(0);
		expect(api.closeLiveStream.mock.calls).toEqual([['live-a'], ['live-b']]);
		await playback.reportStop(0);
		expect(api.closeLiveStream).toHaveBeenCalledTimes(2);
	});
});

describe('transcode preferences', () => {
	const lastRequest = () => api.getPlaybackInfo.mock.calls[api.getPlaybackInfo.mock.calls.length - 1][1];

	test('an audio switch keeps a load that turned direct play and direct stream off', async () => {
		answerMovie();
		await playback.getPlaybackInfo(movie.Id, {item: movie, enableDirectPlay: false, enableDirectStream: false});
		await playback.changeAudioStream(3, 0);
		expect(lastRequest()).toMatchObject({EnableDirectPlay: false, EnableDirectStream: false, AudioStreamIndex: 3});
	});

	test('a reload that names nothing keeps what the load allowed', async () => {
		answerMovie();
		await playback.getPlaybackInfo(movie.Id, {item: movie, enableDirectPlay: false, enableDirectStream: false});
		await playback.getPlaybackInfo(movie.Id, {item: movie, startPositionTicks: 100});
		expect(lastRequest()).toMatchObject({EnableDirectPlay: false, EnableDirectStream: false});
	});

	test('a stop lets the next load choose again', async () => {
		answerMovie();
		await playback.getPlaybackInfo(movie.Id, {item: movie, enableDirectPlay: false, enableDirectStream: false});
		await playback.reportStop(0);
		await playback.getPlaybackInfo(movie.Id, {item: movie});
		expect(lastRequest()).toMatchObject({EnableDirectPlay: true, EnableDirectStream: true});
	});

	test('an audio switch on a load that allowed everything still only drops direct play', async () => {
		answerMovie();
		await playback.getPlaybackInfo(movie.Id, {item: movie});
		await playback.changeAudioStream(3, 0);
		expect(lastRequest()).toMatchObject({EnableDirectPlay: false, EnableDirectStream: true});
	});
});
