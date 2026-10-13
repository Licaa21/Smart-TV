import {act, renderHook} from '@testing-library/react';

let mockServerType = 'jellyfin';
let mockToken = 'token';
let mockHttpTmdb = false;

jest.mock('../services/jellyfinApi', () => ({
	getServerUrl: () => 'http://server:8096/',
	getApiKey: () => mockToken,
	getTokenParam: () => (mockServerType === 'emby' ? 'api_key' : 'ApiKey')
}));

jest.mock('../platform', () => ({
	isWebOS: () => mockHttpTmdb,
	isLegacyTizen: () => false
}));

import {isUnownedSeerrTitle, seerrThumbUrl, seerrWideArtUrl, setTmdbThumbsAvailable, useTmdbThumbsAvailable} from './tmdbThumb';

const BACKDROP = 'https://image.tmdb.org/t/p/w1280/backdrop.jpg';

// A Seerr row title the way normalizeMediaItem leaves it.
const seerrMovie = (overrides = {}) => ({
	Id: 'seerr-movie-603',
	Type: 'Movie',
	_externalBackdropUrl: BACKDROP,
	_seerr: true,
	_seerrType: 'item',
	_seerrMediaType: 'movie',
	_seerrRaw: {mediaId: 603, mediaType: 'movie'},
	...overrides
});

// An outside list title known only by its IMDb id.
const imdbShow = {
	Id: 'ext-imdb-top250-tv-tt0903747',
	Type: 'Series',
	ProviderIds: {Imdb: 'tt0903747'},
	_external: true,
	_seerr: true,
	_seerrType: 'item',
	_seerrMediaType: 'tv',
	_seerrRaw: {imdbId: 'tt0903747', title: 'Breaking Bad', mediaType: 'tv'}
};

beforeEach(() => {
	mockServerType = 'jellyfin';
	mockToken = 'token';
	mockHttpTmdb = false;
	setTmdbThumbsAvailable(true);
});

afterAll(() => setTmdbThumbsAvailable(false));

describe('seerrThumbUrl', () => {
	it('asks for a Seerr title by its TMDB id with the Jellyfin token param', () => {
		expect(seerrThumbUrl(seerrMovie())).toBe('http://server:8096/Moonfin/Tmdb/Thumb?type=movie&tmdbId=603&ApiKey=token');
	});

	it('uses the Emby token param on Emby', () => {
		mockServerType = 'emby';
		expect(seerrThumbUrl(seerrMovie())).toBe('http://server:8096/Moonfin/Tmdb/Thumb?type=movie&tmdbId=603&api_key=token');
	});

	it('encodes the token', () => {
		mockToken = 'a b&c';
		expect(seerrThumbUrl(seerrMovie())).toBe('http://server:8096/Moonfin/Tmdb/Thumb?type=movie&tmdbId=603&ApiKey=a%20b%26c');
	});

	it('asks for the http TMDB address on sets that load TMDB over http', () => {
		mockHttpTmdb = true;
		expect(seerrThumbUrl(seerrMovie())).toBe('http://server:8096/Moonfin/Tmdb/Thumb?type=movie&tmdbId=603&scheme=http&ApiKey=token');
	});

	it('falls back to the IMDb id when there is no TMDB id', () => {
		expect(seerrThumbUrl(imdbShow)).toBe('http://server:8096/Moonfin/Tmdb/Thumb?type=tv&imdbId=tt0903747&ApiKey=token');
	});

	it('takes the TMDB provider id over an IMDb one', () => {
		const item = {...imdbShow, ProviderIds: {Tmdb: '1396', Imdb: 'tt0903747'}};
		expect(seerrThumbUrl(item)).toBe('http://server:8096/Moonfin/Tmdb/Thumb?type=tv&tmdbId=1396&ApiKey=token');
	});

	it('gives nothing while the plugin can\'t make thumbs', () => {
		setTmdbThumbsAvailable(false);
		expect(seerrThumbUrl(seerrMovie())).toBeNull();
	});

	it('gives nothing for anything but a movie or show', () => {
		expect(seerrThumbUrl(seerrMovie({_seerrMediaType: 'person'}))).toBeNull();
		expect(seerrThumbUrl(seerrMovie({_seerrMediaType: undefined}))).toBeNull();
	});

	it('leaves tiles, owned titles and library items alone', () => {
		const genre = {Id: 'seerr-genre-movie-28', Type: 'Genre', _seerr: true, _seerrType: 'genre', _seerrMediaType: 'movie', _seerrRaw: {genreId: 28, mediaType: 'movie'}, ProviderIds: {Tmdb: '28'}};
		expect(seerrThumbUrl(genre)).toBeNull();
		expect(seerrThumbUrl(seerrMovie({_resolvedFromExternal: true}))).toBeNull();
		expect(seerrThumbUrl({Id: 'abc', Type: 'Movie', ProviderIds: {Tmdb: '603'}})).toBeNull();
	});

	it('gives nothing without an id or a token', () => {
		expect(seerrThumbUrl(seerrMovie({_seerrRaw: null}))).toBeNull();
		mockToken = null;
		expect(seerrThumbUrl(seerrMovie())).toBeNull();
	});
});

describe('seerrWideArtUrl', () => {
	it('prefers the thumb and keeps the plain backdrop for when the plugin can\'t help', () => {
		expect(seerrWideArtUrl(seerrMovie())).toContain('/Moonfin/Tmdb/Thumb?');
		setTmdbThumbsAvailable(false);
		expect(seerrWideArtUrl(seerrMovie())).toBe(BACKDROP);
	});

	it('hands over to the backdrop once the thumb failed to load', () => {
		const failed = seerrThumbUrl(seerrMovie());
		expect(seerrWideArtUrl(seerrMovie(), failed)).toBe(BACKDROP);
		expect(seerrWideArtUrl(seerrMovie({_externalBackdropUrl: null}), failed)).toBeNull();
	});

	it('gives tiles and owned titles nothing', () => {
		expect(seerrWideArtUrl({...seerrMovie(), _seerrType: 'genre'})).toBeNull();
		expect(seerrWideArtUrl(seerrMovie({_resolvedFromExternal: true}))).toBeNull();
		expect(isUnownedSeerrTitle(null)).toBe(false);
	});
});

describe('useTmdbThumbsAvailable', () => {
	it('redraws a watching card when the plugin ping changes the answer', () => {
		setTmdbThumbsAvailable(false);
		let draws = 0;
		const {result} = renderHook(() => {
			draws += 1;
			return useTmdbThumbsAvailable(true);
		});
		expect(result.current).toBe(false);
		act(() => setTmdbThumbsAvailable(true));
		expect(result.current).toBe(true);
		const before = draws;
		act(() => setTmdbThumbsAvailable(true));
		expect(draws).toBe(before);
	});

	it('leaves a card that isn\'t watching alone', () => {
		setTmdbThumbsAvailable(false);
		let draws = 0;
		renderHook(() => {
			draws += 1;
			return useTmdbThumbsAvailable(false);
		});
		const before = draws;
		act(() => setTmdbThumbsAvailable(true));
		expect(draws).toBe(before);
	});
});
