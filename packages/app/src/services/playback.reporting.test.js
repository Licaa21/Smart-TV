import * as playback from './playback';
import * as jellyfinApi from './jellyfinApi';
import {serverLogger} from './serverLogger';

jest.mock('./jellyfinApi', () => {
	const server = {
		getPlaybackInfo: jest.fn(),
		reportPlaybackStart: jest.fn(),
		reportPlaybackProgress: jest.fn(),
		reportPlaybackStopped: jest.fn(),
		closeLiveStream: jest.fn()
	};
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
jest.mock('../platform', () => ({isVega: () => false, isXbox: () => false}));

const {api} = jellyfinApi;
const movie = {Id: 'movie-1', Type: 'Movie'};

const openSession = async () => {
	api.getPlaybackInfo.mockResolvedValue({
		PlaySessionId: 'session',
		MediaSources: [{Id: 'source', SupportsDirectPlay: true, Container: 'mkv', MediaStreams: []}]
	});
	await playback.getPlaybackInfo(movie.Id, {item: movie});
};

beforeEach(async () => {
	await playback.reportStop(0);
	jest.clearAllMocks();
	api.reportPlaybackStopped.mockResolvedValue(null);
	api.reportPlaybackProgress.mockResolvedValue(null);
});

afterEach(() => {
	playback.stopProgressReporting();
	delete navigator.sendBeacon;
});

describe('the reporting state', () => {
	test('counts from the start of the session until the server takes a report', async () => {
		await openSession();
		await playback.reportStart(0);
		expect(playback.getReportingState().sinceOkMs).toBeGreaterThanOrEqual(0);
		await playback.reportStart(0);
		expect(playback.getReportingState()).toMatchObject({failures: 0, lastError: null});
	});

	test('knows a background stop is waiting for its resume', async () => {
		await openSession();
		expect(playback.isBackgroundStopPending()).toBe(false);
		playback.reportBackgroundStop(1000);
		expect(playback.isBackgroundStopPending()).toBe(true);
		playback.consumeBackgroundStopFired();
		expect(playback.isBackgroundStopPending()).toBe(false);
	});

	test('says whether there is a session and whether progress reports are running', async () => {
		expect(playback.getReportingState()).toMatchObject({hasSession: false, progressActive: false});
		await openSession();
		expect(playback.getReportingState()).toMatchObject({hasSession: true, progressActive: false});
		playback.startProgressReporting(() => 1000, 60000);
		expect(playback.getReportingState().progressActive).toBe(true);
		playback.stopProgressReporting();
		expect(playback.getReportingState().progressActive).toBe(false);
	});

	test('notes when the server last took a report', async () => {
		await openSession();
		await playback.reportProgress(5000);
		const state = playback.getReportingState();
		expect(state.failures).toBe(0);
		expect(state.sinceOkMs).toBeGreaterThanOrEqual(0);
	});

	test('counts reports that fail, and writes the first and then every sixth to the report', async () => {
		await openSession();
		api.reportPlaybackProgress.mockRejectedValue(new Error('API Error: 401'));
		for (let i = 0; i < 7; i++) await playback.reportProgress(5000);
		const state = playback.getReportingState();
		expect(state.failures).toBe(7);
		expect(state.lastError).toBe('API Error: 401');
		// the first and the seventh, as plain entries: an error entry is sent to the server that is not answering
		const lines = serverLogger.playback.mock.calls.filter(([message]) => message === 'Playback: progress reports are failing');
		expect(lines).toHaveLength(2);
		expect(lines[0][1]).toEqual({failures: 1, error: 'API Error: 401'});
		expect(serverLogger.playbackError).not.toHaveBeenCalled();
		api.reportPlaybackProgress.mockResolvedValue(null);
		await playback.reportProgress(5000);
		expect(playback.getReportingState().failures).toBe(0);
	});
});

test('an answer that comes after the session was let go of is not counted for the next one', async () => {
	await openSession();
	let fail;
	api.reportPlaybackProgress.mockImplementationOnce(() => new Promise((_, reject) => { fail = reject; }));
	const pending = playback.reportProgress(5000);
	await playback.reportStop(5000);
	await openSession();
	await playback.reportStart(0);
	fail(new Error('late'));
	await pending;
	expect(playback.getReportingState()).toMatchObject({failures: 0, lastError: null});
});

describe('a stop the server did not take', () => {
	test('is sent again as a beacon, with the position, and the report says so', async () => {
		await openSession();
		navigator.sendBeacon = jest.fn(() => true);
		api.reportPlaybackStopped.mockRejectedValue(new Error('Network error'));
		await playback.reportStop(23456789);
		expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
		const [endpoint, blob] = navigator.sendBeacon.mock.calls[0];
		expect(endpoint).toContain('/Sessions/Playing/Stopped');
		const body = JSON.parse(await new Promise((resolve) => {
			const reader = new window.FileReader();
			reader.onload = () => resolve(reader.result);
			reader.readAsText(blob);
		}));
		expect(body).toMatchObject({ItemId: 'movie-1', PlaySessionId: 'session', PositionTicks: 23456789});
		expect(serverLogger.playbackError).toHaveBeenCalledWith('Playback: the stop report failed', expect.objectContaining({resentAsBeacon: true, positionTicks: 23456789}));
	});

	test('is not sent again for a failure a resend cannot help, like a 401', async () => {
		await openSession();
		navigator.sendBeacon = jest.fn(() => true);
		api.reportPlaybackStopped.mockRejectedValue(Object.assign(new Error('API Error: 401'), {status: 401}));
		await playback.reportStop(1000);
		expect(navigator.sendBeacon).not.toHaveBeenCalled();
		expect(serverLogger.playbackError).toHaveBeenCalledWith('Playback: the stop report failed', expect.objectContaining({resentAsBeacon: false, status: 401}));
	});

	test('does not use a blocking request when the set has no beacon', async () => {
		await openSession();
		const open = jest.fn();
		const realXhr = window.XMLHttpRequest;
		window.XMLHttpRequest = function Xhr() { this.open = open; this.setRequestHeader = jest.fn(); this.send = jest.fn(); };
		try {
			api.reportPlaybackStopped.mockRejectedValue(new Error('Network error'));
			await playback.reportStop(1000);
			expect(open).not.toHaveBeenCalled();
		} finally {
			window.XMLHttpRequest = realXhr;
		}
	});

	test('counts as the stop that went out, so a live stream is not closed again', async () => {
		api.getPlaybackInfo.mockResolvedValue({
			PlaySessionId: 'live-session',
			MediaSources: [{Id: 'source', LiveStreamId: 'live-1', SupportsDirectPlay: true, Container: 'ts', MediaStreams: []}]
		});
		await playback.getPlaybackInfo('channel-1', {item: {Id: 'channel-1', Type: 'TvChannel'}});
		navigator.sendBeacon = jest.fn(() => true);
		api.reportPlaybackStopped.mockRejectedValue(new Error('Network error'));
		await playback.reportStop(0);
		expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
		expect(api.closeLiveStream).not.toHaveBeenCalled();
	});

	test('is not sent twice when the server took it', async () => {
		await openSession();
		navigator.sendBeacon = jest.fn(() => true);
		await playback.reportStop(1000);
		expect(navigator.sendBeacon).not.toHaveBeenCalled();
		expect(api.reportPlaybackStopped).toHaveBeenCalledTimes(1);
	});
});
