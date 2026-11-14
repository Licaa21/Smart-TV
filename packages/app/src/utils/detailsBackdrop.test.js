import {detailsBackdropUrl, heldBackdrop, warmDetailsBackdrop} from './detailsBackdrop';
import {artSource, decodeArt, hasArt, pinArt, prefetchArt} from '../components/MediaCard/artPrefetch';

jest.mock('../components/MediaCard/artPrefetch', () => ({
	artSource: jest.fn(() => null),
	pinArt: jest.fn(),
	decodeArt: jest.fn(),
	hasArt: jest.fn(() => false),
	prefetchArt: jest.fn()
}));

const movie = {Id: 'm1', Type: 'Movie', BackdropImageTags: ['t']};
const SERVER = 'http://server';

beforeEach(() => {
	jest.clearAllMocks();
	hasArt.mockReturnValue(false);
	window.innerWidth = 1920;
});

describe('detailsBackdropUrl', () => {
	it('asks the server for the title\'s own backdrop, or the parent\'s for an episode', () => {
		expect(detailsBackdropUrl(movie, SERVER)).toContain('/Items/m1/Images/Backdrop');
		const episode = {Id: 'e1', Type: 'Episode', ParentBackdropItemId: 's1', ParentBackdropImageTags: ['t']};
		expect(detailsBackdropUrl(episode, SERVER)).toContain('/Items/s1/Images/Backdrop');
	});

	it('takes the address Seerr arrives with, and is null for a title with no backdrop', () => {
		expect(detailsBackdropUrl({_externalBackdropUrl: 'https://image.tmdb.org/b.jpg'}, SERVER)).toBe('https://image.tmdb.org/b.jpg');
		expect(detailsBackdropUrl({Id: 'x', Type: 'Movie'}, SERVER)).toBeNull();
		expect(detailsBackdropUrl(null, SERVER)).toBeNull();
	});
});

describe('heldBackdrop', () => {
	it('is the copy read ahead when there is one, and pins it so it is not let go', () => {
		artSource.mockReturnValueOnce('blob:held');
		expect(heldBackdrop('http://server/a')).toBe('blob:held');
		expect(pinArt).toHaveBeenCalledWith('http://server/a');
	});

	it('is the address itself when nothing was read ahead, and nothing for no address', () => {
		expect(heldBackdrop('http://server/a')).toBe('http://server/a');
		expect(heldBackdrop(null)).toBeNull();
	});
});

describe('warmDetailsBackdrop', () => {
	it('reads the picture ahead and decodes it once it is held', () => {
		expect(warmDetailsBackdrop(movie, SERVER, {backdropBlurDetail: 0})).toBe(true);
		expect(prefetchArt).toHaveBeenCalledTimes(1);
		const [url, , , onDone] = prefetchArt.mock.calls[0];
		expect(url).toContain('/Items/m1/Images/Backdrop');
		onDone();
		expect(decodeArt).toHaveBeenCalledWith(url, 12);
	});

	it('reads the blurred copy too when there is a blur, since some styles draw it, and pins both', () => {
		warmDetailsBackdrop(movie, SERVER, {backdropBlurDetail: 20});
		const urls = prefetchArt.mock.calls.map((call) => call[0]);
		expect(urls).toHaveLength(2);
		expect(urls[0]).toContain('maxWidth=1920');
		expect(urls[1]).toContain('blur=4');
		expect(pinArt).toHaveBeenCalledTimes(2);
	});

	it('only decodes a picture that is already held', () => {
		hasArt.mockReturnValue(true);
		warmDetailsBackdrop(movie, SERVER, {});
		expect(prefetchArt).not.toHaveBeenCalled();
		expect(decodeArt).toHaveBeenCalledTimes(1);
	});

	it('does nothing for a person, a title with no backdrop, or a screen that draws none', () => {
		expect(warmDetailsBackdrop({Id: 'p', Type: 'Person', BackdropImageTags: ['t']}, SERVER, {})).toBe(false);
		expect(warmDetailsBackdrop({Id: 'x', Type: 'Movie'}, SERVER, {})).toBe(false);
		expect(warmDetailsBackdrop(movie, SERVER, {detailsBackdropEnabled: false})).toBe(false);
		expect(prefetchArt).not.toHaveBeenCalled();
	});
});
