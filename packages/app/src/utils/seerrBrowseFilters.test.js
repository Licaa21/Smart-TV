import {buildSeerrDiscoverParams, filterSearchResults, filterTitlesByName, mergeTitles, getSeerrSortOptions, getSeerrTvStatusOptions, hasSeerrDiscoverFilters} from './seerrBrowseFilters';

describe('seerr browse filters', () => {
	it('offers the sort axes seerr itself has, per media type', () => {
		const movie = getSeerrSortOptions('movie').map((o) => o.key);
		expect(movie).toEqual(['popularity', 'release_date', 'vote_average', 'original_title']);
		const tv = getSeerrSortOptions('tv').map((o) => o.key);
		expect(tv).toEqual(['popularity', 'first_air_date', 'vote_average', 'original_title']);
	});

	it('carries the six tv status values seerr defines', () => {
		expect(getSeerrTvStatusOptions().map((o) => o.key)).toEqual([0, 1, 2, 3, 4, 5]);
	});

	it('merges the route genre with picked genres without repeating it', () => {
		const params = buildSeerrDiscoverParams({routeGenreId: 28, genreIds: [28, 12]});
		expect(params.genre).toBe('28,12');
	});

	it('pipe joins tv statuses and drops filters nobody picked', () => {
		const params = buildSeerrDiscoverParams({tvStatuses: [3, 4]});
		expect(params.status).toBe('3|4');
		expect(params.genre).toBeUndefined();
		expect(params.language).toBeUndefined();
		expect(params.voteAverageGte).toBeUndefined();
	});

	it('maps runtime and release presets to their bounds', () => {
		const params = buildSeerrDiscoverParams({runtime: '30to60', released: '1990s'});
		expect(params.withRuntimeGte).toBe(30);
		expect(params.withRuntimeLte).toBe(60);
		expect(params.releaseDateGte).toBe('1990-01-01');
		expect(params.releaseDateLte).toBe('1999-12-31');
	});

	it('leaves open ended presets unbounded on the open side', () => {
		const params = buildSeerrDiscoverParams({runtime: 'over120', released: '2020s'});
		expect(params.withRuntimeGte).toBe(120);
		expect(params.withRuntimeLte).toBeUndefined();
		expect(params.releaseDateGte).toBe('2020-01-01');
		expect(params.releaseDateLte).toBeUndefined();
	});

	it('knows when any filter is active', () => {
		expect(hasSeerrDiscoverFilters({})).toBe(false);
		expect(hasSeerrDiscoverFilters({minRating: '7'})).toBe(true);
		expect(hasSeerrDiscoverFilters({genreIds: [12]})).toBe(true);
		expect(hasSeerrDiscoverFilters({released: 'older'})).toBe(true);
	});
});

describe('filterTitlesByName', () => {
	const items = [{title: 'Amélie'}, {name: 'The Flash'}, {title: 'Flashdance'}, {}];

	it('keeps everything for an empty search', () => {
		expect(filterTitlesByName(items, '')).toBe(items);
		expect(filterTitlesByName(items, '   ')).toBe(items);
		expect(filterTitlesByName(items, null)).toBe(items);
	});

	it('reads a movie by its title and a show by its name', () => {
		expect(filterTitlesByName(items, 'flash').map((i) => i.title || i.name)).toEqual(['The Flash', 'Flashdance']);
	});

	it('does not count case or accents', () => {
		expect(filterTitlesByName(items, 'AMELIE')).toEqual([{title: 'Amélie'}]);
	});

	it('is empty when nothing matches', () => {
		expect(filterTitlesByName(items, 'zzz')).toEqual([]);
	});
});

describe('mergeTitles', () => {
	const t = (id, extra) => ({id, title: `T${id}`, ...extra});

	it('adds a page after what is there', () => {
		expect(mergeTitles([t(1), t(2)], [t(3)], 'movie').map((e) => e.id)).toEqual([1, 2, 3]);
	});

	it('leaves out a title that is already there, which Seerr\'s own pages sometimes repeat', () => {
		expect(mergeTitles([t(1), t(2)], [t(2), t(3)], 'movie').map((e) => e.id)).toEqual([1, 2, 3]);
	});

	it('leaves out a title repeated inside the page', () => {
		expect(mergeTitles([], [t(1), t(1), t(2)], 'movie').map((e) => e.id)).toEqual([1, 2]);
	});

	it('does not take a film and a show of the same id for one title', () => {
		const list = mergeTitles([t(7, {mediaType: 'movie'})], [t(7, {mediaType: 'tv'})], 'movie');
		expect(list).toHaveLength(2);
	});

	it('reads a title with no type of its own as the type of the screen', () => {
		expect(mergeTitles([t(7)], [t(7, {mediaType: 'movie'})], 'movie')).toHaveLength(1);
	});
});

describe('filterSearchResults', () => {
	const results = [
		{id: 2288, mediaType: 'tv', name: 'Prison Break', genreIds: [10759, 80, 18]},
		{id: 242693, mediaType: 'movie', title: 'Prison Break', genreIds: [80, 18, 53]},
		{id: 5, mediaType: 'person', name: 'Wentworth Miller'},
		{id: 303464, mediaType: 'tv', name: 'Prison Break: Black Creek', genreIds: [80, 10759]},
		{id: 9, mediaType: 'tv', name: 'No genres listed'}
	];

	it('keeps the titles of the screen\'s type that are in its genre', () => {
		expect(filterSearchResults(results, {mediaType: 'tv', genreId: 10759}).map((r) => r.id)).toEqual([2288, 303464]);
	});

	it('leaves out other types, and people', () => {
		expect(filterSearchResults(results, {mediaType: 'movie', genreId: 80}).map((r) => r.id)).toEqual([242693]);
	});

	it('keeps every title of the type when the screen has no genre', () => {
		expect(filterSearchResults(results, {mediaType: 'tv'}).map((r) => r.id)).toEqual([2288, 303464, 9]);
	});

	it('reads a genre id sent as text', () => {
		expect(filterSearchResults(results, {mediaType: 'tv', genreId: '10759'}).map((r) => r.id)).toEqual([2288, 303464]);
	});

	it('is empty for nothing', () => {
		expect(filterSearchResults(null, {mediaType: 'tv'})).toEqual([]);
	});
});
