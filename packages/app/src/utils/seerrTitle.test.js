import seerrApi from '../services/seerrApi';
import {fetchSeerrTitle} from './seerrTitle';
import {tmdbGet} from './tmdbText';

jest.mock('../services/seerrApi', () => ({
	__esModule: true,
	default: {getMovie: jest.fn(), getTv: jest.fn()}
}));
jest.mock('./tmdbText', () => ({...jest.requireActual('./tmdbText'), tmdbGet: jest.fn()}));

describe('fetchSeerrTitle', () => {
	beforeEach(() => {
		seerrApi.getMovie.mockReset();
		seerrApi.getTv.mockReset();
		tmdbGet.mockReset();
	});

	it('is Seerr\'s answer in the language when there is no TMDB key', async () => {
		seerrApi.getTv.mockResolvedValue({id: 1, overview: 'Un profesor.'});
		await expect(fetchSeerrTitle('tv', 1, 'ro')).resolves.toEqual({id: 1, overview: 'Un profesor.'});
		expect(seerrApi.getTv).toHaveBeenCalledWith(1, 'ro');
		expect(tmdbGet).not.toHaveBeenCalled();
	});

	it('asks Seerr again with no language when the language has no description and there is no key', async () => {
		seerrApi.getTv.mockResolvedValueOnce({id: 1, overview: ''}).mockResolvedValueOnce({id: 1, overview: 'A teacher.'});
		await expect(fetchSeerrTitle('tv', 1, 'ro')).resolves.toEqual({id: 1, overview: 'A teacher.'});
		expect(seerrApi.getTv).toHaveBeenLastCalledWith(1, undefined);
	});

	it('takes the words from TMDB in the language, and leaves the rest of Seerr\'s answer', async () => {
		seerrApi.getMovie.mockResolvedValue({id: 2, title: 'Film', overview: 'English.', mediaInfo: {status: 5}});
		tmdbGet.mockResolvedValue({title: 'Filmul', overview: 'Romanesc.', tagline: ''});
		const title = await fetchSeerrTitle('movie', 2, 'ro', {tmdbApiKey: 'key'});
		expect(tmdbGet).toHaveBeenCalledWith('/movie/2', 'ro', 'key');
		expect(title).toMatchObject({title: 'Filmul', overview: 'Romanesc.', mediaInfo: {status: 5}});
	});

	it('keeps Seerr\'s text where TMDB has none in that language', async () => {
		seerrApi.getTv.mockResolvedValue({id: 3, overview: 'English.', tagline: 'Line.'});
		tmdbGet.mockResolvedValue({overview: '', tagline: ''});
		await expect(fetchSeerrTitle('tv', 3, 'ro', {tmdbApiKey: 'key'})).resolves.toMatchObject({overview: 'English.', tagline: 'Line.'});
	});

	it('is Seerr\'s answer when TMDB cannot be reached', async () => {
		seerrApi.getTv.mockResolvedValue({id: 4, overview: 'English.'});
		tmdbGet.mockRejectedValue(new Error('down'));
		await expect(fetchSeerrTitle('tv', 4, 'ro', {tmdbApiKey: 'key'})).resolves.toEqual({id: 4, overview: 'English.'});
	});
});
