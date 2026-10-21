// $L reaches for ilib, which a plain unit test has no way to load. Every key is its own
// English source string, so handing the string straight back is faithful enough here.
jest.mock('@enact/i18n/$L', () => ({__esModule: true, default: (str) => str}));

import {buildCollectionPluginSections, homeRowGroup, isHomeRowVisibleByGates, mergeServerPluginSections, pluginSectionsFromServer} from './homeSectionsModel';

const settings = (over = {}) => ({
	displayFavoritesRows: true,
	displayCollectionsRows: true,
	displayGenresRows: true,
	displayPlaylistsRows: true,
	imdbTop250MoviesEnabled: true,
	imdbTop250TvShowsEnabled: true,
	imdbMostPopularMoviesEnabled: true,
	imdbMostPopularTvShowsEnabled: true,
	imdbLowestRatedMoviesEnabled: true,
	imdbTopEnglishMoviesEnabled: true,
	useMoonfinPlugin: true,
	...over
});

describe('isHomeRowVisibleByGates', () => {
	test('applies the settings that gate a whole group of rows', () => {
		expect(isHomeRowVisibleByGates('collections', settings({displayCollectionsRows: false}))).toBe(false);
		expect(isHomeRowVisibleByGates('favoriteMovies', settings({displayFavoritesRows: false}))).toBe(false);
		expect(isHomeRowVisibleByGates('imdb-top250-movies', settings({imdbTop250MoviesEnabled: false}))).toBe(false);
	});

	test('hides the plugin rows when the plugin is off', () => {
		const off = settings({useMoonfinPlugin: false});

		expect(isHomeRowVisibleByGates('seerr_trending', off)).toBe(false);
		expect(isHomeRowVisibleByGates('tmdb_popular', off)).toBe(false);
		expect(isHomeRowVisibleByGates('radarr_calendar', off)).toBe(false);
		expect(isHomeRowVisibleByGates('sonarr_calendar', off)).toBe(false);
	});

	test('shows the plugin rows when it is on', () => {
		expect(isHomeRowVisibleByGates('seerr_trending', settings())).toBe(true);
		expect(isHomeRowVisibleByGates('radarr_calendar', settings())).toBe(true);
	});

	test('leaves anything with no gate of its own alone', () => {
		expect(isHomeRowVisibleByGates('resume', settings())).toBe(true);
		expect(isHomeRowVisibleByGates('nextup', settings({useMoonfinPlugin: false}))).toBe(true);
	});
});

const serverCollection = (over = {}) => ({
	kind: 'pluginDynamic',
	enabled: true,
	pluginSource: 'collections',
	pluginSection: 'Alien Collection',
	pluginAdditionalData: '04592f446660f58ca9498161c3b4600d',
	pluginDisplayText: 'Alien Collection',
	...over
});

describe('pluginSectionsFromServer', () => {
	test('a pushed collection becomes the same section the editor would have built', () => {
		const [imported] = pluginSectionsFromServer([serverCollection()], settings());
		const [local] = buildCollectionPluginSections([{Id: '04592f446660f58ca9498161c3b4600d', Name: 'Alien Collection'}], 'SortName', 'Ascending');

		expect(imported.id).toBe(local.id);
		expect(imported.specJson).toBe(local.specJson);
		expect(imported.enabled).toBe(true);
	});

	test('a pushed genre is read the same way', () => {
		const [imported] = pluginSectionsFromServer([serverCollection({
			pluginSource: 'genres', pluginAdditionalData: 'g1', pluginDisplayText: 'Horror'
		})], settings());

		expect(imported.id).toBe('genre:g1');
		expect(JSON.parse(imported.specJson)).toMatchObject({kind: 'genre', genreId: 'g1', genreName: 'Horror'});
	});

	test('a row switched off on the server arrives switched off', () => {
		const [imported] = pluginSectionsFromServer([serverCollection({enabled: false})], settings());
		expect(imported.enabled).toBe(false);
	});

	test('a row with nothing to load, a source this screen cant draw, or a builtin row is left out', () => {
		const imported = pluginSectionsFromServer([
			serverCollection({pluginAdditionalData: ''}),
			serverCollection({pluginSource: 'playlists'}),
			{kind: 'builtin', type: 'resume', enabled: true, order: 0}
		], settings());
		expect(imported).toEqual([]);
	});
});

describe('mergeServerPluginSections', () => {
	const existing = [
		{id: 'collection:local', name: 'Mine', enabled: false, order: 0, source: 'collections', specJson: '{}'}
	];

	test('a new section from the server is added after what is already here', () => {
		const [imported] = pluginSectionsFromServer([serverCollection()], settings());
		const merged = mergeServerPluginSections(existing, [imported]);

		expect(merged.map((section) => section.id)).toEqual(['collection:local', imported.id]);
		expect(merged[1]).toMatchObject({name: 'Alien Collection', enabled: true, order: 1, source: 'collections'});
	});

	test('a section already here keeps the order and switch the viewer gave it', () => {
		const [imported] = pluginSectionsFromServer([serverCollection()], settings());
		const arranged = [{...imported, name: 'Alien Collection', enabled: false, order: 0}];
		const merged = mergeServerPluginSections(arranged, [imported]);

		expect(merged).toBe(arranged);
	});

	test('nothing new means the same list back', () => {
		expect(mergeServerPluginSections(existing, [])).toBe(existing);
		expect(mergeServerPluginSections(existing, undefined)).toBe(existing);
	});
});

test('the Live TV rows are left out when the server has no Live TV', () => {
	expect(isHomeRowVisibleByGates('livetv', settings(), false)).toBe(false);
	expect(isHomeRowVisibleByGates('onnow', settings(), false)).toBe(false);
	expect(isHomeRowVisibleByGates('activerecordings', settings(), false)).toBe(false);
	expect(isHomeRowVisibleByGates('resume', settings(), false)).toBe(true);
	expect(isHomeRowVisibleByGates('livetv', settings())).toBe(true);
});

describe('homeRowGroup', () => {
	test('puts each row under the kind the editor groups it by', () => {
		expect(homeRowGroup({id: 'resume'})).toBe('general');
		expect(homeRowGroup({id: 'collections'})).toBe('collections');
		expect(homeRowGroup({id: 'collection:abc', source: 'collections'})).toBe('collections');
		expect(homeRowGroup({id: 'favoriteMovies'})).toBe('favorites');
		expect(homeRowGroup({id: 'studios'})).toBe('genres');
		expect(homeRowGroup({id: 'genre:abc', source: 'genres'})).toBe('genres');
		expect(homeRowGroup({id: 'playlists'})).toBe('playlists');
		expect(homeRowGroup({id: 'seerr_trending'})).toBe('seerr');
		expect(homeRowGroup({id: 'seerr_shortcuts'})).toBe('seerr');
		expect(homeRowGroup({id: 'radarr_calendar'})).toBe('seerr');
		expect(homeRowGroup({id: 'tmdb_popular_tv'})).toBe('external');
		expect(homeRowGroup({id: 'imdb-top250-movies'})).toBe('external');
	});
});
