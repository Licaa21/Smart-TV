import {getItemSecondarySubtitlePref, getItemSubtitlePref, saveSecondarySubtitlePref, saveSubtitlePref} from './subtitlePrefs';

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
});
