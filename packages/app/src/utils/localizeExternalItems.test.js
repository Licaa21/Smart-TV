import seerrApi from '../services/seerrApi';
import {localizeExternalItems, localizeSeerrCards, pluginTranslatesRow} from './localizeExternalItems';

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

describe('localizeSeerrCards', () => {
	beforeEach(() => {
		seerrApi.getMovie.mockReset();
		seerrApi.getTv.mockReset();
	});

	const card = (id, extra) => ({Id: `ext-${id}`, Name: `English ${id}`, Type: 'Movie', ProviderIds: {Tmdb: String(id)}, _external: true, _seerr: true, _externalPosterUrl: 'old', ...extra});

	it('puts the cards the library does not hold into the language, and leaves a library item alone', async () => {
		seerrApi.getMovie.mockResolvedValue({title: 'Titlu', overview: 'Descriere.', posterPath: '/ro.jpg'});
		const owned = {Id: 'abc', Name: 'Owned', Type: 'Movie', ProviderIds: {Tmdb: '5'}};
		const [outside, library] = await localizeSeerrCards([card(1000), owned], 'ro');
		expect(outside).toMatchObject({Name: 'Titlu', Overview: 'Descriere.', _externalPosterUrl: 'tmdb/w342/ro.jpg', _seerr: true});
		expect(library).toBe(owned);
		expect(seerrApi.getMovie).toHaveBeenCalledTimes(1);
	});

	it('leaves alone a card the library turned out to hold, which still carries the marks of its list', async () => {
		const held = card(3000, {_resolvedFromExternal: true, Id: 'abc'});
		const [library] = await localizeSeerrCards([held], 'ro');
		expect(library).toBe(held);
		expect(seerrApi.getMovie).not.toHaveBeenCalled();
	});

	it('asks for a series as a series', async () => {
		seerrApi.getTv.mockResolvedValue({name: 'Serial', posterPath: '/s.jpg'});
		const [show] = await localizeSeerrCards([card(2000, {Type: 'Series'})], 'ro');
		expect(seerrApi.getTv).toHaveBeenCalledWith('2000', 'ro');
		expect(show.Name).toBe('Serial');
	});
});

describe('pluginTranslatesRow', () => {
	it('leaves the TMDB charts to the plugin and keeps the IMDb lists and the viewer own lists for the pass', () => {
		expect(pluginTranslatesRow('tmdb_popular_movies')).toBe(true);
		expect(pluginTranslatesRow('tmdb_top_rated_tv')).toBe(true);
		expect(pluginTranslatesRow('imdb-top250-movies')).toBe(false);
		expect(pluginTranslatesRow('external-abc')).toBe(false);
		expect(pluginTranslatesRow(undefined)).toBe(false);
	});
});
