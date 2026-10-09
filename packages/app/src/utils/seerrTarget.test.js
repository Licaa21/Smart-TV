import {seerrTargetFor, seerrDetailStub, isSeerrOnlyItem, bestSearchMatch, personRouteFor, seerrCardTarget} from './seerrTarget';

const movie = (providerIds) => ({Type: 'Movie', ProviderIds: providerIds});

describe('seerrTargetFor', () => {
	it('hands back a number, since Seerr rejects a request whose mediaId is a string', () => {
		expect(seerrTargetFor(movie({Tmdb: '603'}))).toEqual({mediaId: 603, mediaType: 'movie'});
	});

	it('calls a series tv, which is what Seerr calls it', () => {
		expect(seerrTargetFor({Type: 'Series', ProviderIds: {Tmdb: '1399'}}))
			.toEqual({mediaId: 1399, mediaType: 'tv'});
	});

	it('stays idle for anything with no Seerr counterpart', () => {
		const idle = {mediaId: null, mediaType: null};
		expect(seerrTargetFor({Type: 'Episode', ProviderIds: {Tmdb: '603'}})).toEqual(idle);
		expect(seerrTargetFor({Type: 'Season', ProviderIds: {Tmdb: '603'}})).toEqual(idle);
		expect(seerrTargetFor(null)).toEqual(idle);
	});

	it('stays idle when the title carries no usable TMDB id', () => {
		const idle = {mediaId: null, mediaType: null};
		expect(seerrTargetFor(movie({Imdb: 'tt0133093'}))).toEqual(idle);
		expect(seerrTargetFor(movie({Tmdb: ''}))).toEqual(idle);
		expect(seerrTargetFor(movie({Tmdb: 'not-a-number'}))).toEqual(idle);
		expect(seerrTargetFor(movie(undefined))).toEqual(idle);
	});
});

describe('seerrDetailStub', () => {
	it('carries the Seerr identity that seerrTargetFor reads back out', () => {
		const stub = seerrDetailStub({mediaId: 603, mediaType: 'movie'});
		expect(isSeerrOnlyItem(stub)).toBe(true);
		expect(seerrTargetFor(stub)).toEqual({mediaId: 603, mediaType: 'movie', imdbId: null, title: null});
	});

	it('carries an IMDb id and title when there is no TMDB id yet', () => {
		const stub = seerrDetailStub({mediaType: 'movie', imdbId: 'tt0111161', title: 'The Shawshank Redemption'});
		expect(isSeerrOnlyItem(stub)).toBe(true);
		expect(seerrTargetFor(stub)).toEqual({
			mediaId: null,
			mediaType: 'movie',
			imdbId: 'tt0111161',
			title: 'The Shawshank Redemption'
		});
	});

	it('calls a series a Series, so the screen lays it out as one', () => {
		expect(seerrDetailStub({mediaId: 1399, mediaType: 'tv'}).Type).toBe('Series');
		expect(seerrDetailStub({mediaId: 603, mediaType: 'movie'}).Type).toBe('Movie');
	});

	it('leaves a library item alone', () => {
		expect(isSeerrOnlyItem({Type: 'Movie', ProviderIds: {Tmdb: '603'}})).toBe(false);
	});
});

describe('bestSearchMatch', () => {
	it('picks the first hit of the kind that was asked for', () => {
		const results = [
			{id: 1, mediaType: 'tv'},
			{id: 2, mediaType: 'movie'},
			{id: 3, mediaType: 'movie'}
		];
		expect(bestSearchMatch(results, 'movie').id).toBe(2);
		expect(bestSearchMatch(results, 'tv').id).toBe(1);
	});

	it('falls back to the top hit when no kind matches', () => {
		const results = [{id: 7, mediaType: 'person'}];
		expect(bestSearchMatch(results, 'movie').id).toBe(7);
	});

	it('hands back nothing for an empty search', () => {
		expect(bestSearchMatch([], 'movie')).toBe(null);
		expect(bestSearchMatch(null, 'movie')).toBe(null);
	});
});

describe('personRouteFor', () => {
	it('opens a library cast member on the library side', () => {
		expect(personRouteFor({Id: 'abc123', Name: 'Toni Collette'}, false))
			.toEqual({seerr: false, id: 'abc123'});
	});

	it('opens a cast member from a Seerr only title on the Seerr side', () => {
		expect(personRouteFor({Id: '1234', Name: 'Toni Collette'}, true))
			.toEqual({seerr: true, id: 1234, name: 'Toni Collette'});
	});

	it('keeps a Seerr person whose id is not a number on the library side', () => {
		expect(personRouteFor({Id: 'abc123', Name: 'Toni Collette'}, true))
			.toEqual({seerr: false, id: 'abc123'});
	});

	it('has nowhere to send a person without an id', () => {
		expect(personRouteFor({Name: 'Toni Collette'}, true)).toBeNull();
		expect(personRouteFor(null, false)).toBeNull();
	});
});

describe('seerrCardTarget', () => {
	const card = (extra = {}) => ({Id: 'seerr-movie-634649', Name: 'A Film', Type: 'Movie', _seerr: true, _seerrRaw: {mediaId: 634649, mediaType: 'movie'}, ...extra});

	it('turns a Seerr card into the stub the detail screen treats as Seerr only', () => {
		const target = seerrCardTarget(card());
		expect(isSeerrOnlyItem(target)).toBe(true);
		expect(target).toMatchObject({Id: 'seerr-movie-634649', Type: 'Movie', _seerrMediaId: 634649, _seerrMediaType: 'movie', _seerrTitle: 'A Film'});
	});

	it('keeps a series a series', () => {
		const target = seerrCardTarget(card({Type: 'Series', _seerrRaw: {mediaId: 12, mediaType: 'tv'}}));
		expect(target).toMatchObject({Type: 'Series', _seerrMediaType: 'tv', _seerrMediaId: 12});
	});

	it('opens a title the library holds as that library item', () => {
		expect(seerrCardTarget(card({_seerrLibraryId: 'abc'}))).toEqual({Id: 'abc', Type: 'Movie'});
	});

	it('leaves library items and resolved cards alone', () => {
		const library = {Id: 'abc', Type: 'Movie'};
		expect(seerrCardTarget(library)).toBe(library);
		const resolved = card({_resolvedFromExternal: true});
		expect(seerrCardTarget(resolved)).toBe(resolved);
		expect(seerrCardTarget(null)).toBe(null);
	});
});
