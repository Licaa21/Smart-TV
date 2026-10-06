import {resolveSeriesAudio} from './initialAudio';
import {getSeriesAudioPref} from '../../services/subtitlePrefs';

jest.mock('../../services/subtitlePrefs', () => ({getSeriesAudioPref: jest.fn()}));

const streams = [
	{index: 4, language: 'jpn', codec: 'flac', channels: 2},
	{index: 6, language: 'eng', codec: 'ac3', channels: 6}
];
const episode = {Id: 'e1', SeriesId: 'show'};

beforeEach(() => {
	getSeriesAudioPref.mockReset();
	getSeriesAudioPref.mockResolvedValue({language: 'eng', codec: 'ac3', channels: 6});
});

describe('resolveSeriesAudio', () => {
	test('gives back the track remembered for the series', async () => {
		expect((await resolveSeriesAudio(episode, streams))?.index).toBe(6);
	});

	test('leaves the choice to the language settings once remembering is turned off', async () => {
		expect(await resolveSeriesAudio(episode, streams, false)).toBeNull();
		expect(getSeriesAudioPref).not.toHaveBeenCalled();
	});

	test('has nothing for an item without a series or tracks', async () => {
		expect(await resolveSeriesAudio({Id: 'm1'}, streams)).toBeNull();
		expect(await resolveSeriesAudio(episode, [])).toBeNull();
	});
});
