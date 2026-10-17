import {onlySeries, pickStyleLibrary} from './styleLibrary';

const movies = {Id: 'm', CollectionType: 'movies'};
const shows = {Id: 's', CollectionType: 'tvshows'};
const music = {Id: 'x', CollectionType: 'music'};

describe('the library a screen without one is laid out by', () => {
	it('takes the movies library for movies and the shows library for shows', () => {
		expect(pickStyleLibrary([music, shows, movies], 'movies')).toBe(movies);
		expect(pickStyleLibrary([music, shows, movies], 'tvshows')).toBe(shows);
	});

	it('falls back to the other one when the wanted kind is not there', () => {
		expect(pickStyleLibrary([music, shows], 'movies')).toBe(shows);
		expect(pickStyleLibrary([movies], 'tvshows')).toBe(movies);
	});

	it('has none when there is neither, or the list is not in yet', () => {
		expect(pickStyleLibrary([music], 'movies')).toBeNull();
		expect(pickStyleLibrary(null, 'movies')).toBeNull();
	});

	it('reads the first library of a kind, whatever case the server gives it', () => {
		const first = {Id: 'a', CollectionType: 'Movies'};
		expect(pickStyleLibrary([first, {Id: 'b', CollectionType: 'movies'}], 'movies')).toBe(first);
	});
});

describe('onlySeries', () => {
	it('is true only for a list of series', () => {
		expect(onlySeries([{Type: 'Series'}, {Type: 'Series'}])).toBe(true);
		expect(onlySeries([{Type: 'Series'}, {Type: 'Movie'}])).toBe(false);
		expect(onlySeries([])).toBe(false);
	});
});
