import {decodeDetailsBackdrop, detailsBackdropUrl, feedBackdrops, heldBackdrop, stopFeedingBackdrops, warmDetailsBackdrop} from './detailsBackdrop';
import {artSource, decodeArt, hasArt, pinArt, prefetchArt, unpinArt} from '../components/MediaCard/artPrefetch';

jest.mock('./homeReady', () => ({afterHomeReady: () => Promise.resolve()}));
jest.mock('../components/MediaCard/artPrefetch', () => ({
	artSource: jest.fn(() => null),
	pinArt: jest.fn(),
	unpinArt: jest.fn(),
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
	it('is the copy read ahead when there is one, and pins what it draws as a screen that was kept', () => {
		artSource.mockReturnValueOnce('blob:held');
		expect(heldBackdrop('http://server/a')).toBe('blob:held');
		expect(pinArt).toHaveBeenCalledWith('http://server/a');
	});

	it('is the address itself when nothing was read ahead, and nothing for no address', () => {
		expect(heldBackdrop('http://server/a')).toBe('http://server/a');
		pinArt.mockClear();
		expect(heldBackdrop(null)).toBeNull();
		expect(pinArt).not.toHaveBeenCalled();
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
		expect(pinArt.mock.calls[0][1]).toBeUndefined();
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

describe('warmDetailsBackdrop settling and decoding', () => {
	it('tells when every picture is held or has failed, and not before', () => {
		const settled = jest.fn();
		warmDetailsBackdrop(movie, SERVER, {backdropBlurDetail: 20}, {onSettled: settled});
		expect(settled).not.toHaveBeenCalled();
		prefetchArt.mock.calls[0][3]();
		expect(settled).not.toHaveBeenCalled();
		prefetchArt.mock.calls[1][2](404);
		expect(settled).toHaveBeenCalledTimes(1);
		// a second word from either changes nothing
		prefetchArt.mock.calls[1][3]();
		expect(settled).toHaveBeenCalledTimes(1);
	});

	it('settles at once for what is held already or has no picture, and leaves the decoding out when asked', () => {
		hasArt.mockReturnValue(true);
		const settled = jest.fn();
		warmDetailsBackdrop(movie, SERVER, {}, {decode: false, onSettled: settled});
		expect(settled).toHaveBeenCalledTimes(1);
		expect(decodeArt).not.toHaveBeenCalled();
		warmDetailsBackdrop({Id: 'x', Type: 'Movie'}, SERVER, {}, {onSettled: settled});
		expect(settled).toHaveBeenCalledTimes(2);
	});

	it('does not decode what it reads when told not to', () => {
		warmDetailsBackdrop(movie, SERVER, {}, {decode: false});
		prefetchArt.mock.calls[0][3]();
		expect(decodeArt).not.toHaveBeenCalled();
	});
});

describe('decodeDetailsBackdrop', () => {
	beforeEach(() => jest.useFakeTimers());
	afterEach(() => jest.useRealTimers());

	it('decodes the pictures of the card in focus once focus has rested on it, nearer than the ones read ahead', () => {
		hasArt.mockReturnValue(true);
		decodeDetailsBackdrop(movie, SERVER, {backdropBlurDetail: 20});
		expect(decodeArt).not.toHaveBeenCalled();
		jest.advanceTimersByTime(400);
		expect(decodeArt).toHaveBeenCalledTimes(2);
		expect(decodeArt.mock.calls[0][1]).toBe(6);
	});

	it('reads a card of the row that the feed has not reached yet, nearer than the rest, and decodes it when it lands', async () => {
		stopFeedingBackdrops();
		hasArt.mockReturnValue(false);
		feedBackdrops([movie], SERVER, {});
		await Promise.resolve();
		await Promise.resolve();
		jest.advanceTimersByTime(0);
		prefetchArt.mockClear();
		const fedCard = {Id: 'm1', Type: 'Movie', BackdropImageTags: ['t']};
		feedBackdrops([fedCard, movie], SERVER, {});
		decodeDetailsBackdrop(fedCard, SERVER, {});
		jest.advanceTimersByTime(400);
		const focused = prefetchArt.mock.calls.filter((call) => call[1] === 6);
		expect(focused).toHaveLength(1);
		focused[0][3]();
		expect(decodeArt).toHaveBeenCalledWith(focused[0][0], 6);
		stopFeedingBackdrops();
	});

	it('does not read a card that is not one of the row, only decodes it if it is held', () => {
		hasArt.mockReturnValue(false);
		decodeDetailsBackdrop({Id: 'zz', Type: 'Movie', BackdropImageTags: ['t']}, SERVER, {});
		jest.advanceTimersByTime(400);
		expect(prefetchArt).not.toHaveBeenCalled();
		expect(decodeArt).not.toHaveBeenCalled();
	});

	it('queues nothing for cards focus moved past, and nothing for a person', () => {
		hasArt.mockReturnValue(true);
		decodeDetailsBackdrop(movie, SERVER, {});
		decodeDetailsBackdrop({Id: 'm2', Type: 'Movie', BackdropImageTags: ['t']}, SERVER, {});
		jest.advanceTimersByTime(400);
		expect(decodeArt).toHaveBeenCalledTimes(1);
		expect(decodeArt.mock.calls[0][0]).toContain('/Items/m2/');
		decodeArt.mockClear();
		decodeDetailsBackdrop({Id: 'p', Type: 'Person', BackdropImageTags: ['t']}, SERVER, {});
		jest.advanceTimersByTime(400);
		expect(decodeArt).not.toHaveBeenCalled();
	});
});

describe('feedBackdrops', () => {
	const cards = (n) => Array.from({length: n}, (_, i) => ({Id: `m${i}`, Type: 'Movie', BackdropImageTags: ['t']}));
	const flush = async () => {
		for (let i = 0; i < 5; i++) await Promise.resolve();
		jest.advanceTimersByTime(0);
	};

	beforeEach(() => {
		stopFeedingBackdrops();
		jest.useFakeTimers();
	});
	afterEach(() => {
		stopFeedingBackdrops();
		jest.useRealTimers();
	});

	it('reads the cards of the row two at a time, in order, and the next as one is held', async () => {
		feedBackdrops(cards(5), SERVER, {backdropBlurDetail: 0});
		await flush();
		expect(prefetchArt.mock.calls.map((call) => call[0].match(/Items\/(m\d)\//)[1])).toEqual(['m0', 'm1']);
		prefetchArt.mock.calls[0][3]();
		await flush();
		expect(prefetchArt.mock.calls).toHaveLength(3);
		prefetchArt.mock.calls[1][2]();
		await flush();
		expect(prefetchArt.mock.calls).toHaveLength(4);
		expect(prefetchArt.mock.calls[3][0]).toContain('/Items/m3/');
	});

	it('counts a title with its blurred copy for two pictures, so the cards keep half of the places', async () => {
		feedBackdrops(cards(4), SERVER, {backdropBlurDetail: 20});
		await flush();
		expect(prefetchArt).toHaveBeenCalledTimes(2);
		expect(prefetchArt.mock.calls[0][0]).toContain('/Items/m0/');
		expect(prefetchArt.mock.calls[1][0]).toContain('/Items/m0/');
		prefetchArt.mock.calls[0][3]();
		prefetchArt.mock.calls[1][3]();
		await flush();
		expect(prefetchArt).toHaveBeenCalledTimes(4);
		expect(prefetchArt.mock.calls[2][0]).toContain('/Items/m1/');
	});

	it('pins each at the place of its card for the row, so the first cards are the last to lose it, and decodes none ahead', async () => {
		feedBackdrops(cards(3), SERVER, {backdropBlurDetail: 0});
		await flush();
		expect(pinArt.mock.calls.map((call) => [call[1], call[2]])).toEqual([[0, 'row'], [1, 'row']]);
		prefetchArt.mock.calls[0][3]();
		expect(decodeArt).not.toHaveBeenCalled();
	});

	it('passes over what is held already without asking for it, and still reads the rest', async () => {
		hasArt.mockReturnValue(true);
		feedBackdrops(cards(7), SERVER, {backdropBlurDetail: 0});
		await flush();
		for (let i = 0; i < 10; i++) await flush();
		expect(prefetchArt).not.toHaveBeenCalled();
		expect(pinArt).toHaveBeenCalledTimes(7);
	});

	it('waits out playback, and goes on when it is over', async () => {
		const video = document.createElement('video');
		document.body.appendChild(video);
		feedBackdrops(cards(2), SERVER, {});
		await flush();
		expect(prefetchArt).not.toHaveBeenCalled();
		video.remove();
		jest.advanceTimersByTime(2000);
		expect(prefetchArt).toHaveBeenCalledTimes(2);
	});

	it('does nothing when asked again with the same cards, starts over with other ones, and lets go of the pins of cards that left', async () => {
		feedBackdrops(cards(2), SERVER, {});
		await flush();
		feedBackdrops(cards(2), SERVER, {});
		await flush();
		expect(prefetchArt).toHaveBeenCalledTimes(2);
		feedBackdrops(cards(1), SERVER, {});
		await flush();
		expect(unpinArt).toHaveBeenCalledTimes(1);
		expect(unpinArt.mock.calls[0][0]).toContain('/Items/m1/');
		expect(unpinArt.mock.calls[0][1]).toBe('row');
	});

	it('leaves what is pinned as it is when the rows are away for a moment', async () => {
		feedBackdrops(cards(2), SERVER, {});
		await flush();
		feedBackdrops([], SERVER, {});
		feedBackdrops(undefined, SERVER, {});
		await flush();
		expect(unpinArt).not.toHaveBeenCalled();
		// and the same cards coming back are not read again
		feedBackdrops(cards(2), SERVER, {});
		await flush();
		expect(prefetchArt).toHaveBeenCalledTimes(2);
	});

	it('stops reading when Home is gone, keeps the pins, and reads again when it comes back', async () => {
		feedBackdrops(cards(4), SERVER, {});
		await flush();
		stopFeedingBackdrops();
		expect(unpinArt).not.toHaveBeenCalled();
		prefetchArt.mock.calls[0][3]();
		await flush();
		expect(prefetchArt).toHaveBeenCalledTimes(2);
		feedBackdrops(cards(4), SERVER, {});
		await flush();
		expect(prefetchArt.mock.calls.length).toBeGreaterThan(2);
	});

	it('passes over a card with no backdrop and one that is there twice', async () => {
		feedBackdrops([...cards(1), ...cards(1), {Id: 'none', Type: 'Movie'}], SERVER, {});
		await flush();
		expect(prefetchArt).toHaveBeenCalledTimes(1);
	});
});
