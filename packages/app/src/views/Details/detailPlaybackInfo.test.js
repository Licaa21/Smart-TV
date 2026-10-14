import * as playback from '../../services/playback';
import {getFromStorage} from '../../services/storage';
import {fetchDetailPlaybackInfo} from './detailPlaybackInfo';

jest.mock('../../platform', () => ({isTizen: () => true}));
jest.mock('../../services/storage', () => ({getFromStorage: jest.fn()}));
jest.mock('../../services/playback', () => ({
	PlayMethod: {DirectPlay: 'DirectPlay', DirectStream: 'DirectStream', Transcode: 'Transcode'},
	getPlaybackInfo: jest.fn()
}));

const api = {getPlaybackInfo: () => {}};

describe('fetchDetailPlaybackInfo', () => {
	beforeEach(() => {
		playback.getPlaybackInfo.mockReset();
		getFromStorage.mockResolvedValue({maxBitrate: 80000000, forceDirectPlay: false});
	});

	it('runs the start itself as a preview, with what Play on a Samsung would pass', async () => {
		playback.getPlaybackInfo.mockResolvedValue({
			dryRun: true, playMethod: 'DirectPlay', mediaSource: {Id: 's1', MediaStreams: []}, audioStreamIndex: 4, audioRebuilt: false,
			deviceProfile: {tuned: true}, maxBitrate: 80000000
		});
		const result = await fetchDetailPlaybackInfo(api, {item: {Id: 'x'}, itemId: 'x', serverType: 'jellyfin', mediaSourceId: 's1', audioStreamIndex: 2, subtitleStreamIndex: -1});
		expect(playback.getPlaybackInfo).toHaveBeenCalledWith('x', expect.objectContaining({
			dryRun: true, item: {Id: 'x'}, mediaSourceId: 's1', audioStreamIndex: 2, subtitleStreamIndex: -1, maxBitrate: 80000000,
			directPlayOpensFirstAudio: true, switchInPlayer: true, enableDirectPlay: true, forceDirectPlay: false
		}));
		expect(result).toMatchObject({supportsDirectPlay: true, supportsDirectStream: false, audioStreamIndex: 4, audioBuilt: false, maxStreamingBitrate: 80000000, deviceProfile: {tuned: true}});
	});

	it('reads the play method the start decided, and the reasons off the transcoding url', async () => {
		playback.getPlaybackInfo.mockResolvedValue({
			dryRun: true, playMethod: 'Transcode', audioRebuilt: true, openingAudioCodec: 'eac3',
			mediaSource: {Id: 's1', TranscodingUrl: '/videos/x/master.m3u8?TranscodeReasons=AudioCodecNotSupported,StreamCountExceedsLimit'}
		});
		const result = await fetchDetailPlaybackInfo(api, {itemId: 'x', audioStreamIndex: 2});
		expect(result).toMatchObject({supportsDirectPlay: false, supportsDirectStream: false, audioBuilt: true, openingAudioCodec: 'eac3'});
		expect(result.transcodeReasons).toEqual(['AudioCodecNotSupported', 'StreamCountExceedsLimit']);
	});

	it('has nothing to report on without a title, or when the start found no source', async () => {
		await expect(fetchDetailPlaybackInfo(api, {})).resolves.toBeNull();
		playback.getPlaybackInfo.mockResolvedValue({dryRun: true});
		await expect(fetchDetailPlaybackInfo(api, {itemId: 'x'})).resolves.toBeNull();
	});
});
