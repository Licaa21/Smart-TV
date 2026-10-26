import {resolveSeriesAudio} from './initialAudio';
import {getItemAudioPref, getSeriesAudioPref} from '../../services/subtitlePrefs';

jest.mock('../../services/subtitlePrefs', () => ({
	getItemAudioPref: jest.fn(),
	getSeriesAudioPref: jest.fn()
}));

const eng = {index: 1, language: 'eng'};
const jpn = {index: 2, language: 'jpn'};
const streams = [eng, jpn];
const episode = {Id: 'ep1', SeriesId: 'show'};

beforeEach(() => {
	getItemAudioPref.mockResolvedValue(undefined);
	getSeriesAudioPref.mockResolvedValue(undefined);
});

describe('resolveSeriesAudio', () => {
	test('the track picked on this title wins over the one kept for its series', async () => {
		getItemAudioPref.mockResolvedValue(1);
		getSeriesAudioPref.mockResolvedValue({language: 'jpn', title: '', relativeIndex: 0});
		expect(await resolveSeriesAudio(episode, streams)).toBe(eng);
	});

	test('a movie gets back the track picked on it', async () => {
		getItemAudioPref.mockResolvedValue(2);
		expect(await resolveSeriesAudio({Id: 'movie'}, streams)).toBe(jpn);
	});

	test('the series pick answers when the title has none, or one it no longer carries', async () => {
		getSeriesAudioPref.mockResolvedValue({language: 'jpn', title: '', relativeIndex: 0});
		expect(await resolveSeriesAudio(episode, streams)).toBe(jpn);
		getItemAudioPref.mockResolvedValue(7);
		expect(await resolveSeriesAudio(episode, streams)).toBe(jpn);
	});

	test('a movie with nothing remembered is left to the language preferences', async () => {
		expect(await resolveSeriesAudio({Id: 'movie'}, streams)).toBeNull();
		expect(getSeriesAudioPref).not.toHaveBeenCalled();
	});
});
