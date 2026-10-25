import seerrApi from '../services/seerrApi';
import {tmdbAvailable, tmdbGet} from '../services/tmdbProxy';
import {fetchSeerrTitle} from './seerrTitle';

jest.mock('../services/seerrApi', () => ({
	__esModule: true,
	default: {getMovie: jest.fn(), getTv: jest.fn()}
}));
jest.mock('../services/tmdbProxy', () => ({tmdbGet: jest.fn(), tmdbAvailable: jest.fn()}));

describe('fetchSeerrTitle', () => {
	beforeEach(() => {
		seerrApi.getMovie.mockReset();
		seerrApi.getTv.mockReset();
		tmdbGet.mockReset();
		tmdbAvailable.mockReset();
		tmdbAvailable.mockReturnValue(true);
	});

	it('is Seerr\'s answer as it is when there is no language', async () => {
		seerrApi.getTv.mockResolvedValue({id: 1, overview: 'A teacher.'});
		await expect(fetchSeerrTitle('tv', 1, '')).resolves.toEqual({id: 1, overview: 'A teacher.'});
		expect(tmdbGet).not.toHaveBeenCalled();
	});

	it('asks Seerr alone for a refresh that only wants the status', async () => {
		seerrApi.getTv.mockResolvedValue({id: 6, mediaInfo: {status: 4}});
		await expect(fetchSeerrTitle('tv', 6, 'ro', {statusOnly: true})).resolves.toEqual({id: 6, mediaInfo: {status: 4}});
		expect(tmdbGet).not.toHaveBeenCalled();
		expect(seerrApi.getTv).toHaveBeenCalledTimes(1);
	});

	it('asks Seerr alone, in English, for English', async () => {
		seerrApi.getTv.mockResolvedValue({id: 9, overview: 'A teacher.'});
		await expect(fetchSeerrTitle('tv', 9, 'en-US')).resolves.toEqual({id: 9, overview: 'A teacher.'});
		expect(tmdbGet).not.toHaveBeenCalled();
		expect(seerrApi.getTv).toHaveBeenCalledTimes(1);
		expect(seerrApi.getTv).toHaveBeenCalledWith(9, 'en-US');
	});

	it('takes the words from TMDB through the plugin, and leaves the rest of Seerr\'s answer', async () => {
		seerrApi.getMovie.mockResolvedValue({id: 2, title: 'Film', overview: 'English.', mediaInfo: {status: 5}});
		tmdbGet.mockResolvedValue({title: 'Filmul', overview: 'Romanesc.', tagline: ''});
		const title = await fetchSeerrTitle('movie', 2, 'ro');
		expect(tmdbGet).toHaveBeenCalledWith('/movie/2', 'ro');
		expect(seerrApi.getMovie).toHaveBeenCalledTimes(1);
		expect(title).toMatchObject({title: 'Filmul', overview: 'Romanesc.', mediaInfo: {status: 5}});
	});

	it('keeps Seerr\'s text where TMDB has none in that language', async () => {
		seerrApi.getTv.mockResolvedValue({id: 3, overview: 'English.', tagline: 'Line.'});
		tmdbGet.mockResolvedValue({overview: '', tagline: ''});
		await expect(fetchSeerrTitle('tv', 3, 'ro')).resolves.toMatchObject({overview: 'English.', tagline: 'Line.'});
	});

	it('is Seerr\'s answer in the language when the plugin cannot give the words', async () => {
		seerrApi.getTv.mockResolvedValueOnce({id: 4, overview: 'English.'}).mockResolvedValueOnce({id: 4, overview: 'Romanesc.'});
		tmdbGet.mockRejectedValue(new Error('The plugin answered 404'));
		await expect(fetchSeerrTitle('tv', 4, 'ro')).resolves.toEqual({id: 4, overview: 'Romanesc.'});
		expect(seerrApi.getTv).toHaveBeenLastCalledWith(4, 'ro');
	});

	it('asks Seerr once, in the language, when the plugin is known not to answer', async () => {
		tmdbAvailable.mockReturnValue(false);
		seerrApi.getTv.mockResolvedValue({id: 7, overview: 'Romanesc.'});
		await expect(fetchSeerrTitle('tv', 7, 'ro')).resolves.toEqual({id: 7, overview: 'Romanesc.'});
		expect(tmdbGet).not.toHaveBeenCalled();
		expect(seerrApi.getTv).toHaveBeenCalledTimes(1);
		expect(seerrApi.getTv).toHaveBeenCalledWith(7, 'ro');
	});

	it('keeps the English answer when the second request in the language fails', async () => {
		seerrApi.getTv.mockResolvedValueOnce({id: 8, overview: 'English.'}).mockRejectedValueOnce(new Error('Seerr is slow'));
		tmdbGet.mockRejectedValue(new Error('The plugin answered 503'));
		await expect(fetchSeerrTitle('tv', 8, 'ro')).resolves.toEqual({id: 8, overview: 'English.'});
	});

	it('is the English answer when the plugin cannot help and Seerr has no description in the language', async () => {
		seerrApi.getTv.mockResolvedValueOnce({id: 5, overview: 'English.'}).mockResolvedValueOnce({id: 5, overview: ''});
		tmdbGet.mockRejectedValue(new Error('The plugin answered 503'));
		await expect(fetchSeerrTitle('tv', 5, 'ro')).resolves.toEqual({id: 5, overview: 'English.'});
	});
});
