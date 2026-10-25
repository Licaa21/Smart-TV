jest.mock('@enact/i18n/$L', () => ({__esModule: true, default: (str) => str}));
// The blocked ratings store reads storage, which pulls in platform code a unit test can't parse.
jest.mock('./storage', () => ({
	getFromStorage: () => Promise.resolve(null),
	saveToStorage: () => Promise.resolve()
}));
jest.mock('./jellyfinApi', () => ({
	HOME_ROW_ITEM_FIELDS: 'Id,Name,Type'
}));
// The online recommendations come through the plugin, and from Seerr when it cannot give them.
jest.mock('./tmdbProxy', () => ({tmdbGet: jest.fn()}));
jest.mock('./seerrApi', () => ({__esModule: true, default: {getTvRecommendations: jest.fn(), getMovieRecommendations: jest.fn()}}));

import seerrApi from './seerrApi';
import {tmdbGet} from './tmdbProxy';
import {canScoreSeedLocally, getOnlineRecommendations, loadRewatchItems, loadSinceYouWatchedRows, mergeRecommendations, RECOMMENDATION_FETCH_LIMIT, scoreCandidate} from './homeRecommendations';
import {
	getSinceYouWatchedSourceOptions,
	getRecommendationSystemSourceOptions
} from '../views/Settings/settingsOptions';

describe('recommendation settings options', () => {
	test('both settings offer the same four engines', () => {
		const values = getRecommendationSystemSourceOptions().map((opt) => opt.value);
		expect(values).toEqual(['local', 'server', 'online', 'hybrid']);
		expect(getSinceYouWatchedSourceOptions()).toEqual(getRecommendationSystemSourceOptions());
	});
});

describe('mergeRecommendations', () => {
	const item = (id) => ({Id: id});

	test('leads with the first list and tops up from the second', () => {
		const merged = mergeRecommendations([item('a')], [item('b'), item('c')], 5);
		expect(merged.map((entry) => entry.Id)).toEqual(['a', 'b', 'c']);
	});

	test('shows an item once however many lists picked it', () => {
		const merged = mergeRecommendations([item('a'), item('b')], [item('b'), item('c')], 5);
		expect(merged.map((entry) => entry.Id)).toEqual(['a', 'b', 'c']);
	});

	test('stops at the limit and copes with a list that never arrived', () => {
		expect(mergeRecommendations([item('a'), item('b')], [item('c')], 2)).toHaveLength(2);
		expect(mergeRecommendations(null, undefined, 5)).toEqual([]);
	});
});

describe('loadSinceYouWatchedRows', () => {
	const mockSeed = {
		Id: 'seed-movie-1',
		Name: 'Inception',
		Type: 'Movie',
		Genres: ['Action', 'Sci-Fi'],
		Tags: ['Dream'],
		People: []
	};

	const makeApi = (overrides = {}) => ({
		getItems: jest.fn().mockResolvedValue({
			Items: [mockSeed]
		}),
		getSimilar: jest.fn().mockResolvedValue({
			Items: [
				{Id: 'sim-1', Name: 'Interstellar', Type: 'Movie', UserData: {Played: false}},
				{Id: 'sim-2', Name: 'Tenet', Type: 'Movie', UserData: {Played: true}}
			]
		}),
		getMoonfinSimilar: jest.fn().mockResolvedValue({
			Items: [
				{Id: 'mf-1', Name: 'Memento', Type: 'Movie', UserData: {Played: false}},
				{Id: 'mf-2', Name: 'The Prestige', Type: 'Movie', UserData: {Played: true}}
			]
		}),
		...overrides
	});

	test('uses Moonbase getMoonfinSimilar when source is local and the server can score', async () => {
		const api = makeApi();
		const settings = {
			sinceYouWatchedSource: 'local',
			sinceYouWatchedIncludeWatched: false,
			recommendationsSupported: true
		};

		const rows = await loadSinceYouWatchedRows(api, settings, [1], false);

		expect(api.getMoonfinSimilar).toHaveBeenCalledWith('seed-movie-1', RECOMMENDATION_FETCH_LIMIT);
		expect(rows).toHaveLength(1);
		expect(rows[0].items).toHaveLength(1);
		expect(rows[0].items[0].Id).toBe('mf-1');
	});

	test('never asks a server that cannot score, and goes straight to client scoring', async () => {
		const api = makeApi({
			getItems: jest.fn().mockImplementation((params) => Promise.resolve({
				Items: params?.SortBy === 'DatePlayed'
					? [mockSeed]
					: [{Id: 'cand-1', Name: 'Dark Knight', Type: 'Movie', Genres: ['Action'], UserData: {Played: false}}]
			}))
		});
		const settings = {sinceYouWatchedSource: 'local', sinceYouWatchedIncludeWatched: false};

		const rows = await loadSinceYouWatchedRows(api, settings, [1], false);

		expect(api.getMoonfinSimilar).not.toHaveBeenCalled();
		expect(rows[0].items[0].Id).toBe('cand-1');
	});

	test('includes watched items in local Moonbase results when includeWatched is true', async () => {
		const api = makeApi();
		const settings = {
			sinceYouWatchedSource: 'local',
			sinceYouWatchedIncludeWatched: true,
			recommendationsSupported: true
		};

		const rows = await loadSinceYouWatchedRows(api, settings, [1], false);

		expect(api.getMoonfinSimilar).toHaveBeenCalledWith('seed-movie-1', RECOMMENDATION_FETCH_LIMIT);
		expect(rows).toHaveLength(1);
		expect(rows[0].items).toHaveLength(2);
	});

	test('falls back to client candidate scoring when Moonbase getMoonfinSimilar fails', async () => {
		const api = makeApi({
			getMoonfinSimilar: jest.fn().mockRejectedValue(new Error('404 Not Found')),
			getItems: jest.fn().mockImplementation((params) => {
				if (params?.SortBy === 'DatePlayed') {
					return Promise.resolve({Items: [mockSeed]});
				}
				// Candidate queries for genres / tags
				return Promise.resolve({
					Items: [
						{Id: 'cand-1', Name: 'Dark Knight', Type: 'Movie', Genres: ['Action'], UserData: {Played: false}}
					]
				});
			})
		});
		const settings = {
			sinceYouWatchedSource: 'local',
			sinceYouWatchedIncludeWatched: false,
			recommendationsSupported: true
		};

		const rows = await loadSinceYouWatchedRows(api, settings, [1], false);

		expect(api.getMoonfinSimilar).toHaveBeenCalled();
		expect(rows).toHaveLength(1);
		expect(rows[0].items[0].Id).toBe('cand-1');
	});

	test('uses api.getSimilar with bypass=moonfin when source is server', async () => {
		const api = makeApi();
		const settings = {
			sinceYouWatchedSource: 'server',
			sinceYouWatchedIncludeWatched: false
		};

		const rows = await loadSinceYouWatchedRows(api, settings, [1], false);

		expect(api.getSimilar).toHaveBeenCalledWith('seed-movie-1', RECOMMENDATION_FETCH_LIMIT, 'moonfin');
		expect(rows).toHaveLength(1);
		expect(rows[0].items).toHaveLength(1);
		expect(rows[0].items[0].Id).toBe('sim-1');
	});

	test('hybrid leads with the server and tops up from the library', async () => {
		const api = makeApi();
		const settings = {
			sinceYouWatchedSource: 'hybrid',
			sinceYouWatchedIncludeWatched: false,
			recommendationsSupported: true
		};

		const rows = await loadSinceYouWatchedRows(api, settings, [1], false);

		expect(api.getSimilar).toHaveBeenCalledWith('seed-movie-1', RECOMMENDATION_FETCH_LIMIT, 'moonfin');
		expect(api.getMoonfinSimilar).toHaveBeenCalledWith('seed-movie-1', RECOMMENDATION_FETCH_LIMIT);
		expect(rows[0].items.map((entry) => entry.Id)).toEqual(['sim-1', 'mf-1']);
	});

	test('hybrid on a server that cannot score tops up from client scoring instead', async () => {
		const api = makeApi({
			getItems: jest.fn().mockImplementation((params) => Promise.resolve({
				Items: params?.SortBy === 'DatePlayed'
					? [mockSeed]
					: [{Id: 'cand-1', Name: 'Dark Knight', Type: 'Movie', Genres: ['Action'], UserData: {Played: false}}]
			}))
		});
		const settings = {sinceYouWatchedSource: 'hybrid', sinceYouWatchedIncludeWatched: false};

		const rows = await loadSinceYouWatchedRows(api, settings, [1], false);

		expect(api.getMoonfinSimilar).not.toHaveBeenCalled();
		expect(rows[0].items.map((entry) => entry.Id)).toEqual(['sim-1', 'cand-1']);
	});

	test('a server answering nothing stays on Jellyfin rather than quietly scoring it', async () => {
		const api = makeApi({
			getSimilar: jest.fn().mockResolvedValue({Items: []}),
			getItems: jest.fn().mockImplementation((params) => Promise.resolve({
				Items: params?.SortBy === 'DatePlayed'
					? [mockSeed]
					: [{Id: 'cand-1', Name: 'Dark Knight', Type: 'Movie', Genres: ['Action'], UserData: {Played: false}}]
			}))
		});
		const settings = {
			sinceYouWatchedSource: 'server',
			sinceYouWatchedIncludeWatched: false,
			recommendationsSupported: true
		};

		const rows = await loadSinceYouWatchedRows(api, settings, [1], false);

		expect(api.getMoonfinSimilar).not.toHaveBeenCalled();
		expect(rows[0].items[0].Id).toBe('cand-1');
	});
});

describe('canScoreSeedLocally', () => {
	test('takes films and shows', () => {
		expect(canScoreSeedLocally({Type: 'Movie'})).toBe(true);
		expect(canScoreSeedLocally({Type: 'Series'})).toBe(true);
	});

	test('leaves everything else to the server', () => {
		for (const Type of ['Episode', 'Season', 'Book', 'AudioBook', 'MusicVideo', 'Video']) {
			expect(canScoreSeedLocally({Type})).toBe(false);
		}
	});
});

describe('scoreCandidate (200.0 pt model)', () => {
	const baseCtx = {
		genres: ['Sci-Fi', 'Action', 'Adventure', 'Thriller', 'Mystery'],
		tags: ['Space', 'Alien', 'Future', 'Cyberpunk', 'Dystopia'],
		baseStudios: ['Warner Bros.', 'Legendary'],
		baseYear: 2020,
		baseRating: 8.5,
		baseName: 'Alien',
		actorNames: ['Sigourney Weaver', 'Tom Skerritt', 'John Hurt'],
		directorNames: ['Ridley Scott', 'James Cameron', 'David Fincher'],
		writerNames: ['Dan O\'Bannon', 'Ronald Shusett', 'Walter Hill']
	};

	test('achieves exactly 200.0 points when all criteria match at maximum', () => {
		const perfectCandidate = {
			Name: 'Aliens',
			Genres: ['Sci-Fi', 'Action', 'Adventure', 'Thriller', 'Mystery'],
			Tags: ['Space', 'Alien', 'Future', 'Cyberpunk', 'Dystopia'],
			Studios: [{Name: 'Warner Bros.'}, {Name: 'Legendary'}],
			ProductionYear: 2020,
			CommunityRating: 8.5,
			People: [
				{Name: 'Ridley Scott', Type: 'Director'},
				{Name: 'James Cameron', Type: 'Director'},
				{Name: 'David Fincher', Type: 'Director'},
				{Name: 'Dan O\'Bannon', Type: 'Writer'},
				{Name: 'Ronald Shusett', Type: 'Writer'},
				{Name: 'Walter Hill', Type: 'Writer'},
				{Name: 'Sigourney Weaver', Type: 'Actor'},
				{Name: 'Tom Skerritt', Type: 'Actor'},
				{Name: 'John Hurt', Type: 'Actor'}
			]
		};

		const score = scoreCandidate(perfectCandidate, baseCtx);
		expect(score).toBe(200.0);
	});

	test('directors use diminishing returns (15, 10, 5 up to 30)', () => {
		const ctx = {
			genres: [],
			tags: [],
			baseStudios: [],
			baseName: 'Unrelated',
			actorNames: [],
			directorNames: ['Dir1', 'Dir2', 'Dir3', 'Dir4'],
			writerNames: []
		};

		const candWithDirs = (names) => ({
			Name: 'Different',
			People: names.map((n) => ({Name: n, Type: 'Director'}))
		});

		expect(scoreCandidate(candWithDirs(['Dir1']), ctx)).toBe(15.0);
		expect(scoreCandidate(candWithDirs(['Dir1', 'Dir2']), ctx)).toBe(25.0);
		expect(scoreCandidate(candWithDirs(['Dir1', 'Dir2', 'Dir3']), ctx)).toBe(30.0);
		expect(scoreCandidate(candWithDirs(['Dir1', 'Dir2', 'Dir3', 'Dir4']), ctx)).toBe(30.0);
	});

	test('writers use diminishing returns (15, 10, 5 up to 30)', () => {
		const ctx = {
			genres: [],
			tags: [],
			baseStudios: [],
			baseName: 'Unrelated',
			actorNames: [],
			directorNames: [],
			writerNames: ['Wri1', 'Wri2', 'Wri3', 'Wri4']
		};

		const candWithWriters = (names) => ({
			Name: 'Different',
			People: names.map((n) => ({Name: n, Type: 'Writer'}))
		});

		expect(scoreCandidate(candWithWriters(['Wri1']), ctx)).toBe(15.0);
		expect(scoreCandidate(candWithWriters(['Wri1', 'Wri2']), ctx)).toBe(25.0);
		expect(scoreCandidate(candWithWriters(['Wri1', 'Wri2', 'Wri3']), ctx)).toBe(30.0);
		expect(scoreCandidate(candWithWriters(['Wri1', 'Wri2', 'Wri3', 'Wri4']), ctx)).toBe(30.0);
	});

	test('actors use diminishing returns (10, 6, 4 up to 20)', () => {
		const ctx = {
			genres: [],
			tags: [],
			baseStudios: [],
			baseName: 'Unrelated',
			actorNames: ['Act1', 'Act2', 'Act3', 'Act4'],
			directorNames: [],
			writerNames: []
		};

		const candWithActors = (names) => ({
			Name: 'Different',
			People: names.map((n) => ({Name: n, Type: 'Actor'}))
		});

		expect(scoreCandidate(candWithActors(['Act1']), ctx)).toBe(10.0);
		expect(scoreCandidate(candWithActors(['Act1', 'Act2']), ctx)).toBe(16.0);
		expect(scoreCandidate(candWithActors(['Act1', 'Act2', 'Act3']), ctx)).toBe(20.0);
		expect(scoreCandidate(candWithActors(['Act1', 'Act2', 'Act3', 'Act4']), ctx)).toBe(20.0);
	});

	test('studios use diminishing returns (12, 8 up to 20)', () => {
		const ctx = {
			genres: [],
			tags: [],
			baseStudios: ['Studio1', 'Studio2', 'Studio3'],
			baseName: 'Unrelated',
			actorNames: [],
			directorNames: [],
			writerNames: []
		};

		const candWithStudios = (names) => ({
			Name: 'Different',
			Studios: names.map((n) => ({Name: n}))
		});

		expect(scoreCandidate(candWithStudios(['Studio1']), ctx)).toBe(12.0);
		expect(scoreCandidate(candWithStudios(['Studio1', 'Studio2']), ctx)).toBe(20.0);
		expect(scoreCandidate(candWithStudios(['Studio1', 'Studio2', 'Studio3']), ctx)).toBe(20.0);
	});

	test('genres are 7 pts each and capped at 35', () => {
		const ctx = {
			genres: ['G1', 'G2', 'G3', 'G4', 'G5', 'G6'],
			tags: [],
			baseStudios: [],
			baseName: 'Unrelated',
			actorNames: [],
			directorNames: [],
			writerNames: []
		};

		expect(scoreCandidate({Name: 'Diff', Genres: ['G1']}, ctx)).toBe(7.0);
		expect(scoreCandidate({Name: 'Diff', Genres: ['G1', 'G2', 'G3']}, ctx)).toBe(21.0);
		expect(scoreCandidate({Name: 'Diff', Genres: ['G1', 'G2', 'G3', 'G4', 'G5']}, ctx)).toBe(35.0);
		expect(scoreCandidate({Name: 'Diff', Genres: ['G1', 'G2', 'G3', 'G4', 'G5', 'G6']}, ctx)).toBe(35.0);
	});

	test('tags are 4 pts each and capped at 20', () => {
		const ctx = {
			genres: [],
			tags: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'],
			baseStudios: [],
			baseName: 'Unrelated',
			actorNames: [],
			directorNames: [],
			writerNames: []
		};

		expect(scoreCandidate({Name: 'Diff', Tags: ['T1']}, ctx)).toBe(4.0);
		expect(scoreCandidate({Name: 'Diff', Tags: ['T1', 'T2']}, ctx)).toBe(8.0);
		expect(scoreCandidate({Name: 'Diff', Tags: ['T1', 'T2', 'T3', 'T4', 'T5']}, ctx)).toBe(20.0);
		expect(scoreCandidate({Name: 'Diff', Tags: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6']}, ctx)).toBe(20.0);
	});

	test('production year decays over 15 years', () => {
		const ctx = {
			genres: [],
			tags: [],
			baseStudios: [],
			baseName: 'Unrelated',
			baseYear: 2020,
			actorNames: [],
			directorNames: [],
			writerNames: []
		};

		expect(scoreCandidate({Name: 'Diff', ProductionYear: 2020}, ctx)).toBe(10.0);
		expect(scoreCandidate({Name: 'Diff', ProductionYear: 2017}, ctx)).toBeCloseTo(8.0, 2);
		expect(scoreCandidate({Name: 'Diff', ProductionYear: 2005}, ctx)).toBe(0.0);
		expect(scoreCandidate({Name: 'Diff', ProductionYear: 2000}, ctx)).toBe(0.0);
	});

	test('community rating proximity yields up to 10 points', () => {
		const ctx = {
			genres: [],
			tags: [],
			baseStudios: [],
			baseName: 'Unrelated',
			baseRating: 8.0,
			actorNames: [],
			directorNames: [],
			writerNames: []
		};

		expect(scoreCandidate({Name: 'Diff', CommunityRating: 8.0}, ctx)).toBe(10.0);
		expect(scoreCandidate({Name: 'Diff', CommunityRating: 6.0}, ctx)).toBeCloseTo(8.0, 2);
		expect(scoreCandidate({Name: 'Diff', CommunityRating: 0.0}, ctx)).toBeCloseTo(2.0, 2);
	});

	test('sequels and pluralized suffixes earn the 25 point bonus', () => {
		const ctx = {
			genres: [],
			tags: [],
			baseStudios: [],
			baseName: 'Alien',
			actorNames: [],
			directorNames: [],
			writerNames: []
		};

		expect(scoreCandidate({Name: 'Aliens'}, ctx)).toBe(25.0);
		expect(scoreCandidate({Name: 'Alien 3'}, ctx)).toBe(25.0);
		expect(scoreCandidate({Name: 'The Alienist'}, ctx)).toBe(0.0);
	});
});

describe('loadRewatchItems collections', () => {
	// Only the collection branch, so every request the mock sees belongs to it.
	const settings = {
		rewatchIncludeMovies: false,
		rewatchIncludeShows: false,
		rewatchIncludeCollections: true
	};

	// A bare api leaves the library scope off, so each query is a single getItems call.
	const apiFor = (handler) => ({getItems: jest.fn().mockImplementation(handler)});

	const boxSets = (...items) => ({Items: items, TotalRecordCount: items.length});

	test('never opens a collection the server already reports as part watched', async () => {
		const api = apiFor((params) => {
			if (params.IncludeItemTypes === 'BoxSet') {
				return Promise.resolve(boxSets(
					{Id: 'c1', Name: 'Half Seen', Type: 'BoxSet', UserData: {UnplayedItemCount: 3}},
					{Id: 'c2', Name: 'One Left', Type: 'BoxSet', UnplayedItemCount: 1}
				));
			}
			throw new Error(`unexpected request for ${params.ParentId}`);
		});

		expect(await loadRewatchItems(api, settings)).toBeNull();
		// Only the box set list goes out.
		expect(api.getItems).toHaveBeenCalledTimes(1);
	});

	test('confirms a watched collection with counts rather than pulling every child', async () => {
		const api = apiFor((params) => {
			if (params.IncludeItemTypes === 'BoxSet') {
				return Promise.resolve(boxSets({Id: 'c1', Name: 'Trilogy', Type: 'BoxSet', UserData: {UnplayedItemCount: 0}}));
			}
			if (params.Filters === 'IsUnplayed') return Promise.resolve({Items: [], TotalRecordCount: 0});
			if (params.Filters === 'IsPlayed') {
				return Promise.resolve({
					Items: [{Id: 'm3', Type: 'Movie', UserData: {LastPlayedDate: '2026-02-01T00:00:00Z'}}],
					TotalRecordCount: 3
				});
			}
			throw new Error('unexpected request');
		});

		const items = await loadRewatchItems(api, settings);

		expect(items.map((item) => item.Id)).toEqual(['c1']);
		// Both probes ask for a single row, and neither asks for the whole box set.
		const children = api.getItems.mock.calls.map(([params]) => params).filter((params) => params.ParentId === 'c1');
		expect(children).toHaveLength(2);
		children.forEach((params) => expect(params.Limit).toBe(1));
	});

	test('an empty collection has no unplayed children either, and isn\'t offered', async () => {
		const api = apiFor((params) => {
			if (params.IncludeItemTypes === 'BoxSet') {
				return Promise.resolve(boxSets({Id: 'c1', Name: 'Empty', Type: 'BoxSet'}));
			}
			return Promise.resolve({Items: [], TotalRecordCount: 0});
		});

		expect(await loadRewatchItems(api, settings)).toBeNull();
	});

	test('a server that omits the count is still asked, and a part watched set is dropped', async () => {
		const api = apiFor((params) => {
			if (params.IncludeItemTypes === 'BoxSet') {
				return Promise.resolve(boxSets({Id: 'c1', Name: 'No Counts', Type: 'BoxSet'}));
			}
			if (params.Filters === 'IsUnplayed') return Promise.resolve({Items: [{Id: 'm2'}], TotalRecordCount: 1});
			throw new Error('should not ask for played children once one is unplayed');
		});

		expect(await loadRewatchItems(api, settings)).toBeNull();
		expect(api.getItems).toHaveBeenCalledTimes(2);
	});

	test('sorts collections by the date their newest child was played', async () => {
		const played = {
			c1: '2026-01-05T00:00:00Z',
			c2: '2026-03-09T00:00:00Z'
		};
		const api = apiFor((params) => {
			if (params.IncludeItemTypes === 'BoxSet') {
				return Promise.resolve(boxSets(
					{Id: 'c1', Name: 'Older', Type: 'BoxSet', UserData: {UnplayedItemCount: 0}},
					{Id: 'c2', Name: 'Newer', Type: 'BoxSet', UserData: {UnplayedItemCount: 0}}
				));
			}
			if (params.Filters === 'IsUnplayed') return Promise.resolve({Items: [], TotalRecordCount: 0});
			return Promise.resolve({
				Items: [{Id: `${params.ParentId}-last`, Type: 'Movie', UserData: {LastPlayedDate: played[params.ParentId]}}],
				TotalRecordCount: 2
			});
		});

		const items = await loadRewatchItems(api, {...settings, rewatchSortBy: 'recentlyWatched'});

		expect(items.map((item) => item.Id)).toEqual(['c2', 'c1']);
	});
});

describe('getOnlineRecommendations', () => {
	const series = {Type: 'Series', ProviderIds: {Tmdb: '1396'}};
	beforeEach(() => {
		tmdbGet.mockReset();
		seerrApi.getTvRecommendations.mockReset();
		seerrApi.getMovieRecommendations.mockReset();
	});

	test('asks the plugin for the recommendations of the title, in the language', async () => {
		tmdbGet.mockResolvedValue({results: [{id: 60059, name: 'Better Call Saul', media_type: 'tv'}]});
		const cards = await getOnlineRecommendations(series, 'ro');
		expect(tmdbGet).toHaveBeenCalledWith('/tv/1396/recommendations', 'ro');
		expect(cards).toHaveLength(1);
		expect(seerrApi.getTvRecommendations).not.toHaveBeenCalled();
	});

	test('uses the recommendations of Seerr when the plugin cannot give them', async () => {
		tmdbGet.mockRejectedValue(new Error('The plugin answered 503'));
		seerrApi.getTvRecommendations.mockResolvedValue({results: [{id: 2, name: 'Dexter', media_type: 'tv'}]});
		const cards = await getOnlineRecommendations(series, 'ro');
		expect(seerrApi.getTvRecommendations).toHaveBeenCalledWith('1396', 1, 'ro');
		expect(cards).toHaveLength(1);
	});

	test('has nothing for a title with no TMDB id', async () => {
		await expect(getOnlineRecommendations({Type: 'Movie', ProviderIds: {}}, 'ro')).resolves.toEqual([]);
		expect(tmdbGet).not.toHaveBeenCalled();
	});
});
