import {
	permittedFromPolicy, keepPermitted, scopeLibraries, wantedCollectionTypes, viewHoldsTypes,
	mergeComparator, byLastPlayedDesc, mergeResponses
} from './libraryScopeRules';

const view = (Id, CollectionType) => ({Id, CollectionType});

describe('permittedFromPolicy', () => {
	test('is null when the policy allows every folder', () => {
		expect(permittedFromPolicy({EnableAllFolders: true, EnabledFolders: ['a']})).toBeNull();
	});

	test('is null when there is no policy to read', () => {
		expect(permittedFromPolicy(null)).toBeNull();
		expect(permittedFromPolicy(undefined)).toBeNull();
	});

	test('is the allowed set when the policy restricts folders', () => {
		expect(permittedFromPolicy({EnableAllFolders: false, EnabledFolders: ['a', 'b']}))
			.toEqual(['a', 'b']);
	});

	test('drops folders the policy blocks outright', () => {
		expect(permittedFromPolicy({
			EnableAllFolders: false,
			EnabledFolders: ['a', 'b', 'c'],
			BlockedMediaFolders: ['b']
		})).toEqual(['a', 'c']);
	});

	// Almost always a parse problem rather than intent, so defer to the server.
	test('is null rather than empty when the allow list is empty', () => {
		expect(permittedFromPolicy({EnableAllFolders: false, EnabledFolders: []})).toBeNull();
		expect(permittedFromPolicy({EnableAllFolders: false, EnabledFolders: ['', null]})).toBeNull();
		expect(permittedFromPolicy({
			EnableAllFolders: false, EnabledFolders: ['a'], BlockedMediaFolders: ['a']
		})).toBeNull();
	});
});

describe('keepPermitted', () => {
	test('keeps everything when the policy places no restriction', () => {
		expect(keepPermitted(['a', 'b'], null)).toEqual(['a', 'b']);
	});

	test('drops ids a stale preference still names', () => {
		expect(keepPermitted(['a', 'b', 'c'], ['a', 'c'])).toEqual(['a', 'c']);
		expect(keepPermitted([], ['a'])).toEqual([]);
	});

	test('matches a synced pick written with dashes to the policy id without them', () => {
		const picked = 'f137a2dd-21bb-c1b9-9aa5-c0f6bf02a805';
		expect(keepPermitted([picked], ['f137a2dd21bbc1b99aa5c0f6bf02a805'])).toEqual([picked]);
	});
});

describe('scopeLibraries', () => {
	const views = [
		view('movies1', 'movies'),
		view('shows1', 'tvshows'),
		view('mixed1', ''),
		view('boxes1', 'boxsets'),
		view('music1', 'music')
	];

	test('is null when the user has hidden nothing', () => {
		expect(scopeLibraries({views, excludes: [], includeItemTypes: 'Movie'})).toBeNull();
		expect(scopeLibraries({views, excludes: null, includeItemTypes: 'Movie'})).toBeNull();
	});

	test('narrows to the libraries that can hold the type', () => {
		expect(scopeLibraries({views, excludes: ['music1'], includeItemTypes: 'Movie'}))
			.toEqual(['movies1', 'mixed1']);
		expect(scopeLibraries({views, excludes: ['music1'], includeItemTypes: 'Series,Episode'}))
			.toEqual(['shows1', 'mixed1']);
	});

	test('routes collections to a boxsets library', () => {
		expect(scopeLibraries({views, excludes: ['music1'], includeItemTypes: 'BoxSet'}))
			.toEqual(['mixed1', 'boxes1']);
	});

	test('treats a library that claims no type as holding anything', () => {
		expect(viewHoldsTypes('', ['movies'])).toBe(true);
		expect(viewHoldsTypes('movies', [])).toBe(true);
		expect(viewHoldsTypes('music', ['movies'])).toBe(false);
	});

	test('drops what the user hid', () => {
		expect(scopeLibraries({views, excludes: ['movies1'], includeItemTypes: 'Movie'}))
			.toEqual(['mixed1']);
	});

	test('leaves out a library the policy does not permit', () => {
		expect(scopeLibraries({
			views, excludes: ['music1'], permitted: ['movies1'], includeItemTypes: 'Movie'
		})).toEqual(['movies1']);
	});

	test('falls back to a sweep when nothing is left to search', () => {
		expect(scopeLibraries({
			views: [view('music1', 'music')], excludes: ['other'], includeItemTypes: 'Movie'
		})).toBeNull();
	});

	// People are not descendants of a library, so asking each one would find none of them.
	test('falls back to a sweep for a type that does not live in a library', () => {
		expect(scopeLibraries({views, excludes: ['music1'], includeItemTypes: 'Person'})).toBeNull();
	});

	test('an unmapped type visits every visible library rather than none', () => {
		expect(wantedCollectionTypes('MusicAlbum')).toEqual([]);
		expect(scopeLibraries({views, excludes: ['music1'], includeItemTypes: 'MusicAlbum'}))
			.toEqual(['movies1', 'shows1', 'mixed1', 'boxes1']);
	});
});

describe('mergeComparator', () => {
	const items = [
		{Name: 'Bravo', ProductionYear: 2001, DateCreated: '2024-01-02', RunTimeTicks: 30},
		{Name: 'alpha', ProductionYear: 1999, DateCreated: '2024-01-03', RunTimeTicks: 10},
		{Name: 'Charlie', ProductionYear: 2010, DateCreated: '2024-01-01', RunTimeTicks: 20}
	];

	const sortedBy = (sortBy, sortOrder) => [...items].sort(mergeComparator(sortBy, sortOrder)).map((i) => i.Name);

	test('orders by name, ignoring case', () => {
		expect(sortedBy('SortName', 'Ascending')).toEqual(['alpha', 'Bravo', 'Charlie']);
		expect(sortedBy('SortName', 'Descending')).toEqual(['Charlie', 'Bravo', 'alpha']);
	});

	test('orders by the date fields as written', () => {
		expect(sortedBy('DateCreated', 'Descending')).toEqual(['alpha', 'Bravo', 'Charlie']);
	});

	test('orders by the number fields', () => {
		expect(sortedBy('ProductionYear', 'Ascending')).toEqual(['alpha', 'Bravo', 'Charlie']);
		expect(sortedBy('Runtime', 'Ascending')).toEqual(['alpha', 'Charlie', 'Bravo']);
	});

	test('reads only the first field of a list', () => {
		expect(sortedBy('ProductionYear,SortName', 'Ascending')).toEqual(['alpha', 'Bravo', 'Charlie']);
	});

	// No rule to reproduce means the merged list keeps the order the libraries answered in.
	test('has nothing to say about a sort it cannot reproduce', () => {
		expect(mergeComparator('Random', 'Ascending')).toBeNull();
		expect(mergeComparator('DatePlayed', 'Descending')).toBeNull();
		expect(mergeComparator('', '')).toBeNull();
	});

	test('byLastPlayedDesc puts the most recently watched first', () => {
		const played = [
			{Name: 'old', UserData: {LastPlayedDate: '2024-01-01'}},
			{Name: 'new', UserData: {LastPlayedDate: '2024-06-01'}},
			{Name: 'never'}
		];
		expect([...played].sort(byLastPlayedDesc).map((i) => i.Name)).toEqual(['new', 'old', 'never']);
	});
});

describe('mergeResponses', () => {
	const one = {Items: [{Name: 'b', ProductionYear: 2}], TotalRecordCount: 5};
	const two = {Items: [{Name: 'a', ProductionYear: 1}], TotalRecordCount: 7};

	test('a single answer is left as it came', () => {
		expect(mergeResponses([one], {sortBy: 'SortName'})).toEqual({
			Items: one.Items, TotalRecordCount: 5
		});
	});

	test('several answers are merged, re-sorted and counted together', () => {
		const merged = mergeResponses([one, two], {sortBy: 'SortName', sortOrder: 'Ascending'});
		expect(merged.Items.map((i) => i.Name)).toEqual(['a', 'b']);
		expect(merged.TotalRecordCount).toBe(12);
	});

	test('the merged list is cut back to one row worth', () => {
		expect(mergeResponses([one, two], {sortBy: 'SortName', limit: 1}).Items).toHaveLength(1);
	});

	test('an explicit comparator wins over the one the sort implies', () => {
		const merged = mergeResponses([one, two], {sortBy: 'SortName', merge: (a, b) => a.ProductionYear - b.ProductionYear});
		expect(merged.Items.map((i) => i.Name)).toEqual(['a', 'b']);
	});

	test('a server that counted nothing falls back to what came back', () => {
		expect(mergeResponses([{Items: [{Name: 'a'}]}]).TotalRecordCount).toBe(1);
		expect(mergeResponses([]).Items).toEqual([]);
	});
});
