jest.mock('../../utils/externalHomeRows', () => ({
	...jest.requireActual('../../utils/externalHomeRows'),
	fetchExternalPresetRow: jest.fn(),
	fetchCustomHomeRow: jest.fn()
}));
jest.mock('../../services/externalRowsApi', () => ({fetchTmdbDetails: jest.fn()}));
jest.mock('../../services/seerrApi', () => ({
	...jest.requireActual('../../services/seerrApi'),
	moonfinPing: jest.fn()
}));
jest.mock('../../services/parentalControls', () => ({getActiveParentalFilter: jest.fn()}));
// In order, so which titles make the bar can be read straight off the inputs.
jest.mock('../Details/detailsMedia', () => ({shuffleArray: (items) => [...items]}));

import {fetchCustomHomeRow, fetchExternalPresetRow} from '../../utils/externalHomeRows';
import {fetchTmdbDetails} from '../../services/externalRowsApi';
import {moonfinPing} from '../../services/seerrApi';
import {getActiveParentalFilter} from '../../services/parentalControls';
import {NO_PARENTAL_FILTER, parentalFilterFromRatings} from '../../utils/parentalFilter';
import {mediaBarExternalListOptions, toExternalSlide, withExternalSlides} from './featuredExternal';

const listItem = (name, tmdb, extra = {}) => ({
	Id: `ext-list-${tmdb}`,
	Name: name,
	Type: 'Movie',
	ProviderIds: {Tmdb: tmdb, Imdb: null},
	OfficialRating: 'PG',
	CommunityRating: 7,
	Genres: [],
	_externalBackdropUrl: `https://image.tmdb.org/t/p/w780/${tmdb}.jpg`,
	_external: true,
	_seerr: true,
	_seerrMediaType: 'movie',
	...extra
});

const settings = (extra = {}) => ({featuredItemCount: 3, featuredContentType: 'both', uiLanguage: 'en', customHomeRows: [], ...extra});
const creds = {serverUrl: 'http://server', accessToken: 'token'};

beforeEach(() => {
	jest.clearAllMocks();
	fetchExternalPresetRow.mockResolvedValue([]);
	fetchCustomHomeRow.mockResolvedValue([]);
	fetchTmdbDetails.mockResolvedValue(null);
	moonfinPing.mockResolvedValue({tmdbDetailsSupported: true});
	getActiveParentalFilter.mockReturnValue(NO_PARENTAL_FILTER);
});

describe('mediaBarExternalListOptions', () => {
	test('lists the IMDb charts by chart name, then the TMDB charts, then custom rows', () => {
		const ids = mediaBarExternalListOptions([{id: 'custom_1', name: 'Mine'}], true).map((option) => option.Id);
		expect(ids.slice(0, 6)).toEqual([
			'imdb_top_250_movies', 'imdb_top_250_tv_shows', 'imdb_most_popular_movies',
			'imdb_most_popular_tv_shows', 'imdb_lowest_rated_movies', 'imdb_top_english_movies'
		]);
		expect(ids).toContain('tmdb_popular_movies');
		expect(ids).toContain('tmdb_trending_all_weekly');
		expect(ids[ids.length - 1]).toBe('custom_1');
	});

	test('leaves the TMDB charts out without a TMDB key', () => {
		const ids = mediaBarExternalListOptions([], false).map((option) => option.Id);
		expect(ids).toHaveLength(6);
		expect(ids.some((id) => id.startsWith('tmdb_'))).toBe(false);
	});
});

describe('withExternalSlides', () => {
	test('fetches each picked list whole, under the id its home row has', async () => {
		const custom = {id: 'custom_1', name: 'Mine', source: 'mdblist', type: 'list_url', params: {}};
		await withExternalSlides([], ['imdb_top_250_movies', 'tmdb_popular_movies', 'custom_1', 'custom_gone'], settings({customHomeRows: [custom]}), creds);

		const options = {language: 'en', limit: Infinity};
		expect(fetchExternalPresetRow).toHaveBeenCalledWith('imdb-top250-movies', options);
		expect(fetchExternalPresetRow).toHaveBeenCalledWith('tmdb_popular_movies', options);
		expect(fetchCustomHomeRow).toHaveBeenCalledWith(custom, options);
		// An id this TV has no list for asks for a preset that doesn't exist, which comes back empty.
		expect(fetchExternalPresetRow).toHaveBeenCalledWith('custom_gone', options);
		expect(moonfinPing).toHaveBeenCalledWith('http://server', 'token');
	});

	test('keeps each title once and only the type the bar shows', async () => {
		fetchExternalPresetRow
			.mockResolvedValueOnce([listItem('A', '1'), listItem('Show', '2', {Type: 'Series', _seerrMediaType: 'tv'})])
			.mockResolvedValueOnce([listItem('A again', '1'), listItem('B', '3')]);

		const slides = await withExternalSlides([], ['imdb_top_250_movies', 'tmdb_popular_movies'], settings({featuredContentType: 'movies'}), creds);
		expect(slides.map((slide) => slide.Name)).toEqual(['A', 'B']);
	});

	test('takes up to a bar of list titles alongside the library picks, a bar in all', async () => {
		fetchExternalPresetRow.mockResolvedValue([listItem('A', '1'), listItem('B', '2'), listItem('C', '3')]);
		const library = [{Id: 'lib1', Name: 'Owned', Type: 'Movie'}, {Id: 'lib2', Name: 'Owned too', Type: 'Movie'}];

		const slides = await withExternalSlides(library, ['tmdb_popular_movies'], settings(), creds);
		expect(slides.map((slide) => slide.Name)).toEqual(['Owned', 'Owned too', 'A']);
		// Only the list title that made it on is looked up.
		expect(fetchTmdbDetails).toHaveBeenCalledTimes(1);
		expect(fetchTmdbDetails).toHaveBeenCalledWith({type: 'movie', tmdbId: '1', imdbId: null});
	});

	test('looks nothing up when the plugin has no details, and drops titles with no backdrop then', async () => {
		moonfinPing.mockResolvedValue({tmdbDetailsSupported: false});
		fetchExternalPresetRow.mockResolvedValue([listItem('A', '1', {_externalBackdropUrl: null}), listItem('B', '2')]);

		const slides = await withExternalSlides([], ['tmdb_popular_movies'], settings(), creds);
		expect(slides.map((slide) => slide.Name)).toEqual(['B']);
		expect(fetchTmdbDetails).not.toHaveBeenCalled();
	});

	test('a title with no backdrop of its own gets the one TMDB has', async () => {
		fetchExternalPresetRow.mockResolvedValue([listItem('A', '1', {_externalBackdropUrl: null}), listItem('B', '2', {_externalBackdropUrl: null})]);
		fetchTmdbDetails.mockImplementation(async ({tmdbId}) => (tmdbId === '1' ? {backdropPath: '/a.jpg'} : null));

		const slides = await withExternalSlides([], ['tmdb_popular_movies'], settings(), creds);
		expect(slides.map((slide) => slide.Name)).toEqual(['A']);
		expect(slides[0]._externalBackdropUrl).toMatch(/image\.tmdb\.org\/t\/p\/w1280\/a\.jpg$/);
	});

	test('holds unrated list titles back once a rating is blocked, as Home does', async () => {
		getActiveParentalFilter.mockReturnValue(parentalFilterFromRatings(['R']));
		fetchExternalPresetRow.mockResolvedValue([
			listItem('Rated R', '1', {OfficialRating: 'R'}),
			listItem('Unrated', '2', {OfficialRating: null}),
			listItem('Family', '3', {OfficialRating: 'PG'})
		]);

		const slides = await withExternalSlides([], ['tmdb_popular_movies'], settings(), creds);
		expect(slides.map((slide) => slide.Name)).toEqual(['Family']);
	});
});

describe('toExternalSlide', () => {
	test('fills the slide in from TMDB', () => {
		const slide = toExternalSlide(listItem('Shawshank', '278'), {
			overview: 'Hope',
			rating: 8.7,
			genres: ['Drama'],
			runTimeTicks: 85200000000,
			backdropPath: '/b.jpg',
			logoPath: '/l.png',
			trailerUrl: 'https://www.youtube.com/watch?v=PLl99DlL6b4'
		});
		expect(slide).toMatchObject({
			Name: 'Shawshank',
			OfficialRating: 'PG',
			Overview: 'Hope',
			CommunityRating: 8.7,
			Genres: ['Drama'],
			RunTimeTicks: 85200000000,
			RemoteTrailers: [{Url: 'https://www.youtube.com/watch?v=PLl99DlL6b4'}],
			_strictRating: true
		});
		expect(slide._externalBackdropUrl).toMatch(/\/t\/p\/w1280\/b\.jpg$/);
		expect(slide.LogoUrl).toMatch(/\/t\/p\/w500\/l\.png$/);
	});

	test('keeps what the list had when TMDB has nothing', () => {
		const slide = toExternalSlide(listItem('A', '1'), null);
		expect(slide._externalBackdropUrl).toBe('https://image.tmdb.org/t/p/w780/1.jpg');
		expect(slide.CommunityRating).toBe(7);
		expect(slide.LogoUrl).toBeNull();
		expect(slide.RemoteTrailers).toEqual([]);
	});

	test('has nothing to show without any backdrop', () => {
		expect(toExternalSlide(listItem('A', '1', {_externalBackdropUrl: null}), {})).toBeNull();
	});
});
