import {buildSeerrDiscoverParams, filterTitlesByName, getSeerrSortOptions, getSeerrTvStatusOptions, hasSeerrDiscoverFilters} from './seerrBrowseFilters';

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
