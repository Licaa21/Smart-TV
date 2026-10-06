import {audioSettingsForItem, isAnimeItem} from './playback';

jest.mock('./deviceProfile', () => ({}));
jest.mock('./video', () => ({}));
jest.mock('./storage', () => ({}));
jest.mock('./serverLogger', () => ({serverLogger: {playback: jest.fn()}}));
jest.mock('../utils/deviceProfileTuning', () => ({}));
jest.mock('../utils/alternateAudio', () => ({}));
jest.mock('./systemVolume', () => ({getVolumeState: jest.fn(), lastVolumeState: jest.fn()}));

const mockGetItem = jest.fn();
jest.mock('./jellyfinApi', () => ({
	api: {getItem: (...a) => mockGetItem(...a)},
	createApiForServer: jest.fn()
}));

beforeEach(() => mockGetItem.mockReset());

describe('isAnimeItem', () => {
	test('takes the labels on the item without asking the server', async () => {
		expect(await isAnimeItem({Id: 'a', Genres: ['Anime']})).toBe(true);
		expect(mockGetItem).not.toHaveBeenCalled();
	});

	test('reads the series of an episode once and keeps the answer', async () => {
		mockGetItem.mockResolvedValue({Genres: ['Anime']});
		expect(await isAnimeItem({Id: 'e1', SeriesId: 'kept'})).toBe(true);
		expect(await isAnimeItem({Id: 'e2', SeriesId: 'kept'})).toBe(true);
		expect(mockGetItem).toHaveBeenCalledTimes(1);
	});

	test('answers false for a series with no anime label, and for an item that already lists its genres', async () => {
		mockGetItem.mockResolvedValue({Genres: ['Drama']});
		expect(await isAnimeItem({Id: 'e1', SeriesId: 'drama'})).toBe(false);
		mockGetItem.mockClear();
		expect(await isAnimeItem({Id: 'm1', Type: 'Movie', Genres: ['Drama']})).toBe(false);
		expect(mockGetItem).not.toHaveBeenCalled();
	});

	test('reads an item with no series that came without genres or tags', async () => {
		mockGetItem.mockResolvedValue({Genres: ['Anime']});
		expect(await isAnimeItem({Id: 'ova', Type: 'Movie'})).toBe(true);
		expect(mockGetItem).toHaveBeenCalledWith('ova');
	});

	test('does not hold the caller past the wait when the server is slow', async () => {
		jest.useFakeTimers();
		try {
			mockGetItem.mockReturnValue(new Promise(() => {}));
			const answer = isAnimeItem({Id: 'e1', SeriesId: 'slow'});
			jest.advanceTimersByTime(5000);
			expect(await answer).toBe(false);
		} finally {
			jest.useRealTimers();
		}
	});

	test('answers false when the series cannot be read, and asks again next time', async () => {
		mockGetItem.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({Genres: ['Anime']});
		expect(await isAnimeItem({Id: 'e1', SeriesId: 'flaky'})).toBe(false);
		await Promise.resolve();
		expect(await isAnimeItem({Id: 'e1', SeriesId: 'flaky'})).toBe(true);
	});
});

describe('audioSettingsForItem', () => {
	const settings = {audioLanguage: 'eng', animeAudioLanguage: 'jpn'};

	test('does not look anything up while no anime language is set', async () => {
		const plain = {audioLanguage: 'eng', animeAudioLanguage: ''};
		expect(await audioSettingsForItem(plain, {Id: 'e1', SeriesId: 'unset'})).toBe(plain);
		expect(mockGetItem).not.toHaveBeenCalled();
	});

	test('hands anime the anime language and everything else the default', async () => {
		expect((await audioSettingsForItem(settings, {Id: 'a', Genres: ['Anime']})).audioLanguage).toBe('jpn');
		expect(await audioSettingsForItem(settings, {Id: 'm', Genres: ['Drama']})).toBe(settings);
	});
});
