import * as playback from './playback';
import * as jellyfinApi from './jellyfinApi';
import {getDeviceCapabilities} from './deviceProfile';
import {linkBitrate} from './linkBitrate';

jest.mock('./jellyfinApi', () => {
	const server = {getPlaybackInfo: jest.fn(), closeLiveStream: jest.fn(), reportPlaybackStopped: jest.fn()};
	return {
		api: server,
		createApiForServer: () => server,
		getServerType: () => 'jellyfin',
		getServerUrl: () => 'http://server',
		getAuthHeader: () => 'MediaBrowser Token="key"',
		getAuthHeaderFor: (type, token) => `${type} ${token}`,
		getApiKey: () => 'key',
		getDeviceId: () => 'device',
		getTokenParam: () => 'ApiKey'
	};
});
jest.mock('./deviceProfile', () => ({
	getDeviceProfile: async () => ({}),
	getDeviceCapabilities: jest.fn()
}));
jest.mock('./linkBitrate', () => ({linkBitrate: jest.fn()}));
jest.mock('./video', () => ({
	getPlayMethod: () => 'DirectPlay',
	getMimeType: () => 'video/mp4',
	isAudioStreamPlayable: () => true,
	canRenderEmbeddedPgsInBand: () => false
}));
jest.mock('./storage', () => ({getFromStorage: async () => ({})}));
jest.mock('./serverLogger', () => ({serverLogger: {playback: jest.fn()}}));
jest.mock('./systemVolume', () => ({getVolumeState: jest.fn(), lastVolumeState: () => null}));
jest.mock('../platform', () => ({isVega: () => false, isXbox: () => false}));

const {api} = jellyfinApi;
const movie = {Id: 'movie-1', Type: 'Movie'};

beforeEach(async () => {
	await playback.reportStop(0);
	jest.clearAllMocks();
	jest.spyOn(console, 'log').mockImplementation(() => {});
	api.reportPlaybackStopped.mockResolvedValue(null);
	api.getPlaybackInfo.mockResolvedValue({
		PlaySessionId: 'session',
		MediaSources: [{Id: 'source', SupportsDirectPlay: true, Container: 'mkv', MediaStreams: []}]
	});
});

describe('the automatic bitrate', () => {
	const askedFor = () => api.getPlaybackInfo.mock.calls[api.getPlaybackInfo.mock.calls.length - 1][1].MaxStreamingBitrate;

	test('is the device ceiling where the platform doesnt ask for the link to be measured', async () => {
		getDeviceCapabilities.mockResolvedValue({});

		await playback.getPlaybackInfo(movie.Id, {item: movie});

		expect(linkBitrate).not.toHaveBeenCalled();
		expect(askedFor()).toBe(40000000);
	});

	test('stays under what the link carries where the platform asks for that', async () => {
		getDeviceCapabilities.mockResolvedValue({fitsBitrateToLink: true});
		linkBitrate.mockResolvedValue(5000000);

		await playback.getPlaybackInfo(movie.Id, {item: movie});

		expect(linkBitrate).toHaveBeenCalledWith({serverUrl: 'http://server', serverType: 'jellyfin', authHeader: 'MediaBrowser Token="key"'}, true);
		expect(askedFor()).toBe(5000000);
	});

	test('is never raised over the device ceiling by a fast link, nor lost to a failed measurement', async () => {
		getDeviceCapabilities.mockResolvedValue({fitsBitrateToLink: true});
		linkBitrate.mockResolvedValueOnce(300000000).mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('offline'));

		for (let i = 0; i < 3; i++) {
			await playback.getPlaybackInfo(movie.Id, {item: movie});
			expect(askedFor()).toBe(40000000);
			await playback.reportStop(0);
		}
	});

	test('gives way to a limit the user set', async () => {
		getDeviceCapabilities.mockResolvedValue({fitsBitrateToLink: true});

		await playback.getPlaybackInfo(movie.Id, {item: movie, maxBitrate: 8000000});

		expect(linkBitrate).not.toHaveBeenCalled();
		expect(askedFor()).toBe(8000000);
	});

	test('is measured on the server an item from another server lives on', async () => {
		getDeviceCapabilities.mockResolvedValue({fitsBitrateToLink: true});
		linkBitrate.mockResolvedValue(5000000);
		const other = {...movie, _serverUrl: 'http://other', _serverAccessToken: 'token', _serverUserId: 'user', _serverType: 'emby'};

		await playback.getPlaybackInfo(other.Id, {item: other});

		expect(linkBitrate).toHaveBeenCalledWith({serverUrl: 'http://other', serverType: 'emby', authHeader: 'emby token'}, true);
	});
});

describe('frames that never reach the screen', () => {
	let now;
	let monitor;

	// A second of a 24 frame a second file, with so many of its frames dropped
	const second = (video, dropped) => {
		now += 1000;
		video.total += 24;
		video.dropped += dropped;
		monitor.recordProgress();
		monitor.recordFrames(video.element);
	};
	const playing = () => {
		const video = {total: 0, dropped: 0};
		video.element = {getVideoPlaybackQuality: () => ({totalVideoFrames: video.total, droppedVideoFrames: video.dropped})};
		return video;
	};
	const start = async (capabilities) => {
		getDeviceCapabilities.mockResolvedValue(capabilities);
		await playback.getPlaybackInfo(movie.Id, {item: movie});
		monitor = playback.getHealthMonitor();
		monitor.reset();
	};

	beforeEach(() => {
		now = 1000000;
		jest.spyOn(Date, 'now').mockImplementation(() => now);
	});

	test('send a file to a transcode once a quarter of them have gone missing for a while', async () => {
		await start({watchesDroppedFrames: true});
		const video = playing();

		for (let i = 0; i < 14; i++) second(video, 6);
		expect(monitor.checkHealth()).toBe(true);

		for (let i = 0; i < 3; i++) second(video, 6);
		expect(monitor.checkHealth()).toBe(false);
		expect(monitor.shouldFallbackToTranscode()).toBe(true);
	});

	test('are let be when only the odd one goes missing, or a burst of them passes', async () => {
		await start({watchesDroppedFrames: true});
		const video = playing();

		for (let i = 0; i < 30; i++) second(video, i % 10 === 0 ? 1 : 0);
		for (let i = 0; i < 3; i++) second(video, 20);
		for (let i = 0; i < 30; i++) second(video, 0);

		expect(monitor.checkHealth()).toBe(true);
	});

	test('arent counted where the platform doesnt ask for it', async () => {
		await start({});
		const video = playing();

		for (let i = 0; i < 30; i++) second(video, 12);

		expect(monitor.checkHealth()).toBe(true);
	});
});
