import seerrApi from '../services/seerrApi';
import {localizeExternalItems} from './localizeExternalItems';

jest.mock('../services/seerrApi', () => ({
	__esModule: true,
	default: {getMovie: jest.fn(), getTv: jest.fn(), getImageUrl: (path, size) => `tmdb/${size}${path}`}
}));
jest.mock('../services/jellyfinApi', () => ({api: {}, getServerUrl: () => '', getUserId: () => ''}));

const suggestion = (id, extra) => ({name: `English ${id}`, type: 'Movie', providerIds: {tmdb: String(id)}, posterUrl: `old/${id}`, ...extra});

describe('localizeExternalItems', () => {
	beforeEach(() => {
		seerrApi.getMovie.mockReset();
		seerrApi.getTv.mockReset();
	});

	it('leaves English, and a list with nothing to ask about, as it is', async () => {
		const items = [suggestion(1)];
		expect(await localizeExternalItems(items, 'en-US')).toBe(items);
		expect(await localizeExternalItems([], 'ro')).toEqual([]);
		expect(seerrApi.getMovie).not.toHaveBeenCalled();
	});

	it('puts a title and its poster into the language, and keeps the rest', async () => {
		seerrApi.getMovie.mockResolvedValueOnce({title: 'Singur acasă', overview: 'Un copil.', posterPath: '/ro.jpg'});
		const [item] = await localizeExternalItems([suggestion(771)], 'ro');
		expect(seerrApi.getMovie).toHaveBeenCalledWith('771', 'ro');
		expect(item).toMatchObject({name: 'Singur acasă', overview: 'Un copil.', posterUrl: 'tmdb/w342/ro.jpg', providerIds: {tmdb: '771'}});
	});

	it('asks for a series as a series, and keeps the English of one that cannot be had', async () => {
		seerrApi.getTv.mockResolvedValueOnce({name: 'Cartelul Crimelor', posterPath: '/c.jpg'});
		seerrApi.getMovie.mockRejectedValueOnce(new Error('down'));
		const [show, film] = await localizeExternalItems([suggestion(2, {type: 'Series'}), suggestion(3)], 'ro-RO');
		expect(show.name).toBe('Cartelul Crimelor');
		expect(film.name).toBe('English 3');
	});

	it('does not ask again for a title it was told about', async () => {
		seerrApi.getMovie.mockResolvedValue({title: 'Titlu', posterPath: '/p.jpg'});
		await localizeExternalItems([suggestion(9)], 'fr');
		await localizeExternalItems([suggestion(9)], 'fr');
		expect(seerrApi.getMovie).toHaveBeenCalledTimes(1);
	});
});
