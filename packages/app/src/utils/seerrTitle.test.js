import seerrApi from '../services/seerrApi';
import {fetchSeerrTitle} from './seerrTitle';

jest.mock('../services/seerrApi', () => ({
	__esModule: true,
	default: {getMovie: jest.fn(), getTv: jest.fn()}
}));

describe('fetchSeerrTitle', () => {
	beforeEach(() => {
		seerrApi.getMovie.mockReset();
		seerrApi.getTv.mockReset();
	});

	it('asks for the right kind of title in the language', async () => {
		seerrApi.getTv.mockResolvedValue({id: 1, overview: 'Descriere.'});
		await fetchSeerrTitle('tv', 1, 'ro-RO');
		expect(seerrApi.getTv).toHaveBeenCalledWith(1, 'ro-RO');
		expect(seerrApi.getMovie).not.toHaveBeenCalled();
	});

	it('fills a missing description and tagline from English, once', async () => {
		seerrApi.getMovie
			.mockResolvedValueOnce({id: 2, overview: '', tagline: ''})
			.mockResolvedValueOnce({id: 2, overview: 'In English.', tagline: 'A line.'});
		const title = await fetchSeerrTitle('movie', 2, 'ro-RO');
		expect(seerrApi.getMovie).toHaveBeenCalledTimes(2);
		expect(seerrApi.getMovie).toHaveBeenLastCalledWith(2, 'en-US');
		expect(title).toMatchObject({overview: 'In English.', tagline: 'A line.'});
	});

	it('does not ask English when the description is there, or when English was asked for, or with no language', async () => {
		seerrApi.getMovie.mockResolvedValue({id: 3, overview: ''});
		await fetchSeerrTitle('movie', 3, 'en-US');
		await fetchSeerrTitle('movie', 3, null);
		expect(seerrApi.getMovie).toHaveBeenCalledTimes(2);
	});

	it('keeps what it has when English cannot be reached', async () => {
		seerrApi.getMovie.mockResolvedValueOnce({id: 4, overview: ''}).mockRejectedValueOnce(new Error('down'));
		await expect(fetchSeerrTitle('movie', 4, 'ro-RO')).resolves.toMatchObject({id: 4});
	});
});
