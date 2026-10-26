import {
	getItemAudioPref, getItemSecondarySubtitlePref, getItemSubtitlePref, getSeriesAudioPref, saveAudioPref,
	saveSecondarySubtitlePref, saveSubtitlePref
} from './subtitlePrefs';

let mockStored = {};

jest.mock('./storage', () => ({
	// Both sides wait a turn, the way the TV's storage answers, so two saves overlap.
	getFromStorage: async (key) => {
		await new Promise((resolve) => setTimeout(resolve, 0));
		return mockStored[key] ? JSON.parse(JSON.stringify(mockStored[key])) : null;
	},
	saveToStorage: async (key, value) => {
		await new Promise((resolve) => setTimeout(resolve, 0));
		mockStored[key] = JSON.parse(JSON.stringify(value));
	}
}));

beforeEach(() => {
	mockStored = {};
});

describe('subtitlePrefs', () => {
	it('keeps both a primary and a secondary save that land together', async () => {
		const item = {Id: 'movie'};

		await Promise.all([
			saveSubtitlePref(item, 3, []),
			saveSecondarySubtitlePref(item, {off: true})
		]);

		expect(await getItemSubtitlePref('movie')).toBe(3);
		expect(await getItemSecondarySubtitlePref('movie')).toEqual({off: true});
	});

	it('has nothing for an item never picked on', async () => {
		expect(await getItemSecondarySubtitlePref('other')).toBeUndefined();
	});

	describe('audio', () => {
		const streams = [{index: 1, language: 'eng'}, {index: 2, language: 'jpn'}];

		it('remembers the track picked on a movie, which has no series to keep it for', async () => {
			await saveAudioPref({Id: 'movie'}, 2, streams);

			expect(await getItemAudioPref('movie')).toBe(2);
			expect(mockStored.subtitlePrefs.seriesAudio).toEqual({});
		});

		it('remembers an episode pick for the episode and for its series', async () => {
			await saveAudioPref({Id: 'ep1', SeriesId: 'show'}, 2, streams);

			expect(await getItemAudioPref('ep1')).toBe(2);
			expect(await getSeriesAudioPref('show')).toMatchObject({language: 'jpn'});
		});

		it('has nothing for an item never picked on, or one picked without a track', async () => {
			await saveAudioPref({Id: 'movie'}, -1, streams);

			expect(await getItemAudioPref('movie')).toBeUndefined();
			expect(await getItemAudioPref('other')).toBeUndefined();
		});
	});
});
