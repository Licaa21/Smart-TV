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

describe('titles kept on the device', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		window.localStorage.clear();
	});
	afterEach(() => {
		jest.useRealTimers();
		window.localStorage.clear();
	});

	// A fresh copy of the module is a fresh start of the app: nothing is held in memory
	const start = (run) => {
		let out;
		jest.isolateModules(() => {
			const api = jest.requireMock('../services/seerrApi').default;
			api.getMovie.mockReset();
			api.getTv.mockReset();
			out = run(api, require('./localizeExternalItems'));
		});
		return out;
	};

	it('asks Seerr once, and a later start does not ask again for the same title', async () => {
		const first = await start(async (api, mod) => {
			api.getMovie.mockResolvedValue({title: 'Titlu', overview: 'O', posterPath: '/p.jpg'});
			const [item] = await mod.localizeExternalItems([suggestion(500)], 'ro');
			return {item, asked: api.getMovie.mock.calls.length};
		});
		expect(first.asked).toBe(1);
		jest.advanceTimersByTime(3000);

		const second = await start(async (api, mod) => {
			api.getMovie.mockRejectedValue(new Error('not asked'));
			const [item] = await mod.localizeExternalItems([suggestion(500)], 'ro');
			return {item, asked: api.getMovie.mock.calls.length};
		});
		expect(second.asked).toBe(0);
		expect(second.item).toMatchObject({name: 'Titlu', overview: 'O', posterUrl: 'tmdb/w342/p.jpg'});
	});

	it('does not keep a failure, so the title is asked for again at the next start', async () => {
		await start(async (api, mod) => {
			api.getMovie.mockRejectedValue(new Error('down'));
			await mod.localizeExternalItems([suggestion(501)], 'ro');
		});
		jest.advanceTimersByTime(3000);
		expect(window.localStorage.getItem('moonfin_title_language')).toBeNull();
	});

	it('does not use an answer older than a week, nor one for another language', async () => {
		const stale = Date.now() - 8 * 24 * 60 * 60 * 1000;
		window.localStorage.setItem('moonfin_title_language', JSON.stringify({
			'movie:502:ro': [{name: 'Vechi'}, stale],
			'movie:503:fr': [{name: 'Titre'}, Date.now()]
		}));
		const result = await start(async (api, mod) => {
			api.getMovie.mockResolvedValue({title: 'Nou'});
			const [old, other] = await mod.localizeExternalItems([suggestion(502), suggestion(503)], 'ro');
			return {old, other, asked: api.getMovie.mock.calls.length};
		});
		expect(result.asked).toBe(2);
		expect(result.old.name).toBe('Nou');
	});

	it('does not keep an answer with nothing in it, nor one stamped in the future', async () => {
		await start(async (api, mod) => {
			api.getMovie.mockResolvedValue('<html>login</html>');
			await mod.localizeExternalItems([suggestion(505)], 'ro');
		});
		jest.advanceTimersByTime(3000);
		expect(window.localStorage.getItem('moonfin_title_language')).toBeNull();

		window.localStorage.setItem('moonfin_title_language', JSON.stringify({'movie:506:ro': [{name: 'Din viitor'}, Date.now() + 60000]}));
		const result = await start(async (api, mod) => {
			api.getMovie.mockResolvedValue({title: 'Acum'});
			const [item] = await mod.localizeExternalItems([suggestion(506)], 'ro');
			return item;
		});
		expect(result.name).toBe('Acum');
	});

	it('works with storage that cannot be read', async () => {
		const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
		const result = await start(async (api, mod) => {
			api.getMovie.mockResolvedValue({title: 'Titlu'});
			const [item] = await mod.localizeExternalItems([suggestion(504)], 'ro');
			return item;
		});
		spy.mockRestore();
		expect(result.name).toBe('Titlu');
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
