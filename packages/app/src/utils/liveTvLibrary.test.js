import {isLiveTvChannel, isLiveTvLibrary, librariesForNav} from './liveTvLibrary';

const movies = {Id: 'm', CollectionType: 'movies'};
const liveTv = {Id: 'l', CollectionType: 'livetv'};

describe('isLiveTvLibrary', () => {
	test('matches however the server spells it', () => {
		for (const spelling of ['livetv', 'LiveTV', 'LIVETV', 'liveTv']) {
			expect(isLiveTvLibrary({CollectionType: spelling})).toBe(true);
		}
	});

	test('says no to anything else, and to nothing at all', () => {
		expect(isLiveTvLibrary(movies)).toBe(false);
		expect(isLiveTvLibrary({})).toBe(false);
		expect(isLiveTvLibrary(null)).toBe(false);
	});
});

describe('librariesForNav', () => {
	test('drops Live TV once it has a button of its own', () => {
		expect(librariesForNav([movies, liveTv], true)).toEqual([movies]);
	});

	test('keeps it in the list when there is no button', () => {
		expect(librariesForNav([movies, liveTv], false)).toEqual([movies, liveTv]);
	});

	test('copes with nothing to filter', () => {
		expect(librariesForNav(undefined, true)).toEqual([]);
		expect(librariesForNav([], true)).toEqual([]);
	});
});

describe('librariesForNav in Kids Mode', () => {
	const libs = [
		{Id: 'movies', CollectionType: 'movies'},
		{Id: 'guide', CollectionType: 'livetv'}
	];

	test('drops the library even with no button to replace it', () => {
		expect(librariesForNav(libs, false, {hideLiveTv: true}).map((l) => l.Id)).toEqual(['movies']);
	});

	test('drops it however the server spells the type', () => {
		const shouty = [{Id: 'guide', CollectionType: 'LiveTV'}];
		expect(librariesForNav(shouty, false, {hideLiveTv: true})).toEqual([]);
	});

	test('leaves a server with no Live TV library alone', () => {
		const onlyMovies = [{Id: 'movies', CollectionType: 'movies'}];
		expect(librariesForNav(onlyMovies, false, {hideLiveTv: true})).toEqual(onlyMovies);
	});

	test('keeps the library when neither the button nor the mode takes it', () => {
		expect(librariesForNav(libs, false)).toEqual(libs);
	});
});

describe('isLiveTvChannel', () => {
	test('takes either spelling of a channel and nothing else', () => {
		expect(isLiveTvChannel({Type: 'TvChannel'})).toBe(true);
		expect(isLiveTvChannel({Type: 'LiveTvChannel'})).toBe(true);
		expect(isLiveTvChannel({Type: 'Program'})).toBe(false);
		expect(isLiveTvChannel({Type: 'Movie'})).toBe(false);
		expect(isLiveTvChannel(null)).toBe(false);
	});
});
