import * as playback from '../../services/playback';
import {reopenLiveChannel} from './useLiveRecovery';

jest.mock('../../services/playback', () => ({
	reportStop: jest.fn(),
	getPlaybackInfo: jest.fn()
}));
jest.mock('../../services/serverLogger', () => ({__esModule: true, default: {playback: jest.fn()}}));

const item = {Id: 'channel-1', Type: 'TvChannel'};
const channel = (over = {}) => ({
	item,
	mediaSourceId: 'source',
	maxBitrate: 20000000,
	stereoUpmixEnabled: false,
	directAllowed: true,
	wasDirectPlay: true,
	positionTicks: 0,
	...over
});
const firstAttempt = {disableDirectPlay: false, forceTranscode: false};
const request = () => playback.getPlaybackInfo.mock.calls[0][1];

beforeEach(() => {
	jest.clearAllMocks();
	playback.reportStop.mockResolvedValue(undefined);
	playback.getPlaybackInfo.mockResolvedValue({url: 'stream'});
});

describe('reopening a live channel', () => {
	test('the early attempts ask for the channel the way it was tuned', async () => {
		await reopenLiveChannel(channel(), firstAttempt);
		expect(playback.getPlaybackInfo).toHaveBeenCalledWith('channel-1', expect.objectContaining({
			startPositionTicks: 0,
			enableDirectPlay: true,
			enableDirectStream: true,
			enableTranscoding: true,
			isLiveTV: true
		}));
	});

	test('the last attempt on a direct played channel lets the server serve it', async () => {
		await reopenLiveChannel(channel(), {disableDirectPlay: true, forceTranscode: false});
		expect(request()).toMatchObject({enableDirectPlay: false, enableDirectStream: true});
	});

	test('the last attempt on a channel the server serves forces a transcode', async () => {
		await reopenLiveChannel(channel({wasDirectPlay: false}), {disableDirectPlay: true, forceTranscode: true});
		expect(request()).toMatchObject({enableDirectPlay: false, enableDirectStream: false});
	});

	test('Force Transcode and Prefer Transcoding hold on every attempt', async () => {
		await reopenLiveChannel(channel({directAllowed: false}), firstAttempt);
		expect(request()).toMatchObject({enableDirectPlay: false, enableDirectStream: false});
	});
});

describe('the stop report before asking again', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		playback.reportStop.mockReturnValue(new Promise(() => {}));
	});
	afterEach(() => jest.useRealTimers());

	test('a direct played channel asks again without waiting on it', async () => {
		reopenLiveChannel(channel(), firstAttempt);
		await jest.advanceTimersByTimeAsync(0);
		expect(playback.reportStop).toHaveBeenCalledTimes(1);
		expect(playback.getPlaybackInfo).toHaveBeenCalledTimes(1);
	});

	test('a channel the server serves waits for it, but no longer than 3s', async () => {
		reopenLiveChannel(channel({wasDirectPlay: false}), firstAttempt);
		await jest.advanceTimersByTimeAsync(2999);
		expect(playback.getPlaybackInfo).not.toHaveBeenCalled();
		await jest.advanceTimersByTimeAsync(1);
		expect(playback.getPlaybackInfo).toHaveBeenCalledTimes(1);
	});
});
