import {externalArtwork} from './externalArtwork';

const tmdbItem = {_external: true, _externalPosterUrl: 'http://img/p.jpg', _externalBackdropUrl: 'http://img/b.jpg'};

describe('externalArtwork', () => {
	test('a wide type takes the backdrop of a title that is not in the library', () => {
		expect(externalArtwork(tmdbItem, 'backdrop', 'http://server')).toBe('http://img/b.jpg');
		expect(externalArtwork(tmdbItem, 'thumb', 'http://server')).toBe('http://img/b.jpg');
		expect(externalArtwork(tmdbItem, 'banner', 'http://server')).toBe('http://img/b.jpg');
	});

	test('poster and logo are left to the card', () => {
		expect(externalArtwork(tmdbItem, 'poster', 'http://server')).toBeNull();
		expect(externalArtwork(tmdbItem, 'logo', 'http://server')).toBeNull();
	});

	test('a library item, or an external one with no backdrop, has none', () => {
		expect(externalArtwork({Id: 'a', ImageTags: {}}, 'backdrop', 'http://server')).toBeNull();
		expect(externalArtwork({_external: true, _externalPosterUrl: 'http://img/p.jpg'}, 'backdrop', 'http://server')).toBeNull();
		expect(externalArtwork(null, 'backdrop', 'http://server')).toBeNull();
	});
});
