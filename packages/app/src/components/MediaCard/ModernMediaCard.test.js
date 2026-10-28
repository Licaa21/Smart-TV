import {act, fireEvent, render, screen} from '@testing-library/react';

import ModernMediaCard from './ModernMediaCard';
import MediaPreviewContext from './MediaPreviewContext';
import {setTmdbThumbsAvailable} from '../../utils/tmdbThumb';
import {warmBackdrop} from '../../utils/backdropWarm';

// The CLI ships a second copy of React, so the components' JSX goes through the copy under test.
jest.mock('react/jsx-dev-runtime', () => {
	const React = require('react');
	return {
		Fragment: React.Fragment,
		jsxDEV: (type, {children, ...props}, key, isStaticChildren) => {
			const config = key === undefined ? props : {...props, key};
			if (children === undefined) return React.createElement(type, config);
			return isStaticChildren ? React.createElement(type, config, ...children) : React.createElement(type, config, children);
		}
	};
});
jest.mock('@enact/i18n/$L', () => (text) => text);
// Spotlight's own props would be unknown attributes on the plain element this mock renders.
jest.mock('@enact/spotlight/Spottable', () => (type) => {
	const React = require('react');
	return (props) => {
		const rest = {...props, 'data-spotlight-id': props.spotlightId};
		delete rest.spotlightId;
		delete rest.onSpotlightLeft;
		delete rest.onSpotlightRight;
		return React.createElement(type, rest);
	};
});
const mockSettings = {};
jest.mock('../../context/SettingsContext', () => ({useSettings: () => ({settings: mockSettings})}));
jest.mock('../../utils/backdropWarm', () => ({warmBackdrop: jest.fn()}));
jest.mock('../../services/jellyfinApi', () => ({
	getServerUrl: () => 'http://server',
	getApiKey: () => 'token',
	getTokenParam: () => 'ApiKey'
}));
jest.mock('../../services/mdblistApi', () => ({isMdblistEnabled: () => false}));
jest.mock('../../platform', () => ({getPlatform: () => 'webos', isWebOS: () => false, isLegacyTizen: () => false}));
jest.mock('../../utils/perfTier', () => ({getPerfTier: () => 'high'}));
jest.mock('../RatingsRow', () => () => null);
jest.mock('../icons/SeerrIcon', () => () => null);
jest.mock('../AnimeMarkerPills', () => ({AnimeCardPill: () => null}));
jest.mock('../../hooks/useItemMenuHold', () => () => ({}));

const POSTER = 'https://image.tmdb.org/t/p/w342/poster.jpg';
const BACKDROP = 'https://image.tmdb.org/t/p/w1280/backdrop.jpg';
const THUMB = 'http://server/Moonfin/Tmdb/Thumb?type=tv&tmdbId=1396&size=w780&ApiKey=token';

// A Seerr row show the way normalizeMediaItem leaves it.
const seerrShow = (overrides = {}) => ({
	Id: 'seerr-tv-1396',
	Name: 'Breaking Bad',
	Type: 'Series',
	_externalPosterUrl: POSTER,
	_externalBackdropUrl: BACKDROP,
	mediaInfo: {},
	_seerr: true,
	_seerrType: 'item',
	_seerrMediaType: 'tv',
	_seerrRaw: {mediaId: 1396, mediaType: 'tv'},
	...overrides
});

// A card that grew wears the wide art over its poster, and the art it ends up in is the one on top.
const wearing = () => (document.querySelector('[class~="imageWide"]') || screen.getByRole('img')).getAttribute('src');

const draw = (item, isFocused) => {
	const {unmount} = render(<ModernMediaCard item={item} serverUrl="http://server" isFocused={isFocused} />);
	const src = wearing();
	unmount();
	return src;
};

beforeEach(() => {
	jest.useFakeTimers();
	setTmdbThumbsAvailable(true);
});
afterEach(() => jest.useRealTimers());
afterAll(() => setTmdbThumbsAvailable(false));

describe('ModernMediaCard with a Seerr title', () => {
	it('wears the poster at rest and grows into the titled thumb', () => {
		expect(draw(seerrShow(), false)).toBe(POSTER);
		expect(draw(seerrShow(), true)).toBe(THUMB);
	});

	it('grows into the plain backdrop when the plugin can\'t make thumbs', () => {
		setTmdbThumbsAvailable(false);
		expect(draw(seerrShow(), true)).toBe(BACKDROP);
	});

	it('hands over to the backdrop when the thumb fails to load', () => {
		// a title of its own, since a thumb that failed is remembered for every card of that title
		render(<ModernMediaCard item={seerrShow({Id: 'seerr-tv-4141', _seerrRaw: {mediaId: 4141, mediaType: 'tv'}})} serverUrl="http://server" isFocused />);
		fireEvent.error(document.querySelector('[class~="imageWide"]'));
		expect(wearing()).toBe(BACKDROP);
	});

	it('finds the thumb for a title with no poster', () => {
		expect(draw(seerrShow({_externalPosterUrl: null}), true)).toBe(THUMB);
	});

	it('keeps an owned outside list title on the art it already had', () => {
		const owned = seerrShow({Id: 'lib1', _external: true, _resolvedFromExternal: true, ImageTags: {Primary: 'p'}});
		expect(draw(owned, true)).toBe(BACKDROP);
	});

	it('grows an owned outside list title into its library thumb', () => {
		const owned = seerrShow({Id: 'lib1', _external: true, _resolvedFromExternal: true, ImageTags: {Primary: 'p', Thumb: 't'}});
		expect(draw(owned, true)).toContain('/Items/lib1/Images/Thumb');
	});
});

describe('ModernMediaCard with an upcoming calendar title', () => {
	const upcoming = () => seerrShow({_calendarDate: '2027-01-01T00:00:00.000Z', Subtitle: 'Digital: Jan 1', ProductionYear: 2027});
	const lines = (isFocused) => {
		const {unmount} = render(<ModernMediaCard item={upcoming()} serverUrl="http://server" isFocused={isFocused} />);
		const text = [...document.querySelectorAll('[class~="secondaryTitle"]')].map((el) => el.textContent);
		unmount();
		return text;
	};

	it('keeps the release date when the card is focused', () => {
		expect(lines(false)).toEqual(['Digital: Jan 1']);
		expect(lines(true)).toEqual(['Digital: Jan 1', '2027']);
	});
});

describe('ModernMediaCard growing on focus', () => {
	// Each test gets its own title, since art that has loaded stays remembered.
	const thumbed = (id) => ({Id: id, Name: 'Film', Type: 'Movie', ProductionYear: 2020, ImageTags: {Primary: 'p', Thumb: 't'}});
	const RealImage = window.Image;
	let loads;

	beforeEach(() => {
		loads = [];
		window.Image = function FakeImage () {
			const art = {};
			loads.push(art);
			return art;
		};
	});
	afterEach(() => {
		window.Image = RealImage;
	});

	const shown = () => document.querySelector('img:not([class~="imageWide"])').getAttribute('src');
	const wide = () => document.querySelector('[class~="imageWide"]');
	const opened = () => document.querySelector('[class~="extendedSection"]') !== null;
	const faded = () => wide().className.includes('imageWideIn');

	it('grows at once on its poster, and the wide art fades in over it once it has loaded', () => {
		render(<ModernMediaCard item={thumbed('loads')} serverUrl="http://server" isFocused />);
		expect(opened()).toBe(true);
		expect(shown()).toContain('/Images/Primary');
		expect(wide().getAttribute('src')).toContain('/Images/Thumb');
		expect(faded()).toBe(false);
		// the focused card asks for its own art first
		expect(loads).toHaveLength(1);

		fireEvent.load(wide());
		expect(faded()).toBe(true);
		expect(shown()).toContain('/Images/Primary');
	});

	it('shows art that has arrived before as soon as it has loaded, without a wait for the network', () => {
		const {unmount} = render(<ModernMediaCard item={thumbed('again')} serverUrl="http://server" isFocused />);
		fireEvent.load(wide());
		unmount();
		render(<ModernMediaCard item={thumbed('again')} serverUrl="http://server" isFocused />);
		// the art is there, and shows as soon as the picture has loaded
		expect(faded()).toBe(false);
		fireEvent.load(wide());
		expect(faded()).toBe(true);
	});

	it('keeps the poster when the wide art never comes', () => {
		render(<ModernMediaCard item={thumbed('slow')} serverUrl="http://server" isFocused />);
		act(() => {
			jest.advanceTimersByTime(5000);
		});
		expect(opened()).toBe(true);
		expect(faded()).toBe(false);
	});

	it('fetches the wide art ahead for a card the row asks to, which then shows it at once', () => {
		const {rerender} = render(<ModernMediaCard item={thumbed('beside')} serverUrl="http://server" warmRank={1} />);
		expect(shown()).toContain('/Images/Primary');
		expect(loads.map((art) => art.src)).toEqual([expect.stringContaining('/Images/Thumb')]);

		act(() => loads[0].onload());
		rerender(<ModernMediaCard item={thumbed('beside')} serverUrl="http://server" isFocused />);
		expect(opened()).toBe(true);
		fireEvent.load(wide());
		expect(faded()).toBe(true);
		expect(loads).toHaveLength(1);
	});

	it('holds the wide art of a near card in the card, hidden, and shows that same picture the moment focus lands', () => {
		const {rerender} = render(<ModernMediaCard item={thumbed('held')} serverUrl="http://server" warmRank={1} />);
		expect(wide()).toBeNull();
		act(() => loads[0].onload());
		const ahead = wide();
		expect(ahead).not.toBeNull();
		expect(faded()).toBe(false);
		fireEvent.load(ahead);

		rerender(<ModernMediaCard item={thumbed('held')} serverUrl="http://server" warmRank={0} isFocused />);
		// not made again at focus, and shown with no fade
		expect(wide()).toBe(ahead);
		expect(faded()).toBe(true);
		expect(wide().className).toContain('imageWideNow');
		// as wide as the card will be, so growing never draws it at another size
		expect(wide().style.width).not.toBe('');

		rerender(<ModernMediaCard item={thumbed('held')} serverUrl="http://server" warmRank={1} />);
		expect(faded()).toBe(false);
	});

	it('shows the held art with no fade on a refocus, even when the first focus came before it had loaded', () => {
		const {rerender} = render(<ModernMediaCard item={thumbed('refocus')} serverUrl="http://server" isFocused />);
		fireEvent.load(wide());
		expect(wide().className).not.toContain('imageWideNow');
		rerender(<ModernMediaCard item={thumbed('refocus')} serverUrl="http://server" warmRank={1} />);
		expect(wide()).not.toBeNull();
		rerender(<ModernMediaCard item={thumbed('refocus')} serverUrl="http://server" warmRank={0} isFocused />);
		expect(faded()).toBe(true);
		expect(wide().className).toContain('imageWideNow');
	});

	it('does not take a new hidden picture for loaded because an earlier one was', () => {
		const {rerender} = render(<ModernMediaCard item={thumbed('again2')} serverUrl="http://server" warmRank={1} />);
		act(() => loads[0].onload());
		fireEvent.load(wide());
		rerender(<ModernMediaCard item={thumbed('again2')} serverUrl="http://server" warmRank={7} />);
		expect(wide()).toBeNull();
		rerender(<ModernMediaCard item={thumbed('again2')} serverUrl="http://server" warmRank={1} />);
		expect(wide()).not.toBeNull();
		rerender(<ModernMediaCard item={thumbed('again2')} serverUrl="http://server" warmRank={0} isFocused />);
		// the new picture has not loaded yet, so it is not shown
		expect(faded()).toBe(false);
		fireEvent.load(wide());
		expect(faded()).toBe(true);
	});

	it('holds no wide art in a card that is far from focus', () => {
		const {rerender} = render(<ModernMediaCard item={thumbed('farther')} serverUrl="http://server" warmRank={1} />);
		act(() => loads[0].onload());
		expect(wide()).not.toBeNull();
		rerender(<ModernMediaCard item={thumbed('farther')} serverUrl="http://server" warmRank={4} />);
		expect(wide()).not.toBeNull();
		rerender(<ModernMediaCard item={thumbed('farther')} serverUrl="http://server" warmRank={5} />);
		expect(wide()).toBeNull();
		// the card a neighbouring row is entered on (ranked 9) holds its picture, the rest of that row does not
		rerender(<ModernMediaCard item={thumbed('farther')} serverUrl="http://server" warmRank={9} />);
		expect(wide()).not.toBeNull();
		rerender(<ModernMediaCard item={thumbed('farther')} serverUrl="http://server" warmRank={10} />);
		expect(wide()).toBeNull();
	});

	it('drops the fetch of a card that is no longer asked to', () => {
		const {rerender} = render(<ModernMediaCard item={thumbed('passed')} serverUrl="http://server" warmRank={1} />);
		expect(loads[0].src).toContain('/Images/Thumb');
		rerender(<ModernMediaCard item={thumbed('passed')} serverUrl="http://server" />);
		expect(loads[0].src).toBe('');
	});

	it('fetches the titled thumb ahead for a Seerr or outside list title', () => {
		render(<ModernMediaCard item={seerrShow()} serverUrl="http://server" warmRank={1} />);
		expect(loads.map((art) => art.src)).toEqual([THUMB]);
	});

	it('moves on to the plain backdrop when the thumb fetched ahead comes back with nothing, for every card of the title', () => {
		const missing = () => seerrShow({Id: 'seerr-tv-4242', _seerrRaw: {mediaId: 4242, mediaType: 'tv'}});
		const MISSING_THUMB = 'http://server/Moonfin/Tmdb/Thumb?type=tv&tmdbId=4242&size=w780&ApiKey=token';
		render(<ModernMediaCard item={missing()} serverUrl="http://server" warmRank={1} />);
		expect(loads[0].src).toBe(MISSING_THUMB);
		act(() => loads[0].onerror());
		expect(loads[1].src).toBe(BACKDROP);

		// another card of the same title goes straight to the backdrop, which is already on its way
		render(<ModernMediaCard item={missing()} serverUrl="http://server" warmRank={1} />);
		expect(loads).toHaveLength(2);
		expect(loads.filter((art) => art.src === MISSING_THUMB)).toHaveLength(1);
	});

	it('fetches nothing ahead while the row holds its images back', () => {
		render(<ModernMediaCard item={thumbed('held')} serverUrl="http://server" warmRank={1} deferImage />);
		expect(loads).toHaveLength(0);
	});

	it('leaves the shadow to the poster under the wide art', () => {
		render(<ModernMediaCard item={thumbed('shadow')} serverUrl="http://server" isFocused />);
		expect(wide().style.boxShadow).toBe('none');
	});

	it('keeps the fetch going when focus lands on the card it was fetched for', () => {
		const {rerender} = render(<ModernMediaCard item={thumbed('landed')} serverUrl="http://server" warmRank={1} />);
		rerender(<ModernMediaCard item={thumbed('landed')} serverUrl="http://server" warmRank={0} isFocused />);
		expect(loads[0].src).toContain('/Images/Thumb');
	});
});

// A controller that records what the card asks of it and lets a test move the phase.
const fakeController = () => {
	const listeners = {};
	const calls = [];
	return {
		listeners,
		calls,
		subscribe: jest.fn((key, listener) => {
			listeners[key] = listener;
			return () => delete listeners[key];
		}),
		schedule: jest.fn((key, item) => calls.push(['schedule', key, item.Id])),
		cancel: jest.fn((key) => calls.push(['cancel', key])),
		stop: jest.fn((reason) => calls.push(['stop', reason])),
		attachFrame: jest.fn((key, el) => calls.push(['attachFrame', key, el ? el.tagName : null]))
	};
};

const libraryMovie = () => ({Id: 'film', Name: 'Film', Type: 'Movie', ImageTags: {Primary: 'p'}});

const drawWithPreview = (item, controller, props = {}) => render(
	<MediaPreviewContext.Provider value={controller}>
		<ModernMediaCard item={item} serverUrl="http://server" spotlightId="media-row-film" {...props} />
	</MediaPreviewContext.Provider>
);

const card = () => document.querySelector('[data-spotlight-id="media-row-film"]');
const frame = () => document.querySelector('[class~="previewFrame"]');
const ring = () => document.querySelector('[class~="previewRing"]');

describe('ModernMediaCard with the media preview', () => {
	it('schedules on focus and hover, cancels on blur and pointer leave', () => {
		const controller = fakeController();
		drawWithPreview(libraryMovie(), controller);

		fireEvent.focus(card());
		fireEvent.blur(card());
		fireEvent.mouseEnter(card());
		fireEvent.mouseLeave(card());

		expect(controller.calls).toEqual([
			['schedule', 'media-row-film', 'film'],
			['cancel', 'media-row-film'],
			['schedule', 'media-row-film', 'film'],
			['cancel', 'media-row-film']
		]);
	});

	it('draws the frame and ring once attached and reveals the frame when playing', () => {
		const controller = fakeController();
		drawWithPreview(libraryMovie(), controller);
		expect(frame()).toBeNull();
		expect(ring()).toBeNull();

		act(() => controller.listeners['media-row-film']('attached'));
		expect(frame()).not.toBeNull();
		expect(ring()).not.toBeNull();
		expect(frame().className).not.toContain('previewVisible');
		expect(controller.attachFrame).toHaveBeenCalledWith('media-row-film', frame());
		// The poster stays up under the frame until there is a picture.
		expect(screen.getByRole('img')).not.toBeNull();

		act(() => controller.listeners['media-row-film']('playing'));
		expect(frame().className).toContain('previewVisible');

		act(() => controller.listeners['media-row-film']('idle'));
		expect(frame()).toBeNull();
		expect(ring()).toBeNull();
	});

	it('stops the preview before the card is selected', () => {
		const controller = fakeController();
		const onSelect = jest.fn(() => controller.calls.push(['select']));
		drawWithPreview(libraryMovie(), controller, {onSelect});

		fireEvent.click(card());

		expect(controller.calls).toEqual([['stop', 'select'], ['select']]);
	});

	it('asks nothing for a card that can\'t be previewed', () => {
		const controller = fakeController();
		drawWithPreview(seerrShow({Id: 'cal-radarr-603', _external: true, _calendarDate: '2026-11-01T00:00:00Z'}), controller);

		fireEvent.focus(card());
		fireEvent.click(card());

		expect(controller.subscribe).not.toHaveBeenCalled();
		expect(controller.calls).toEqual([]);
	});

	it('lets a Seerr title take part, since it plays its trailer', () => {
		const controller = fakeController();
		drawWithPreview(seerrShow(), controller);

		expect(controller.subscribe).toHaveBeenCalledWith('media-row-film', expect.any(Function));
	});

	it('is inert without a provider', () => {
		render(<ModernMediaCard item={libraryMovie()} serverUrl="http://server" spotlightId="media-row-film" />);

		fireEvent.focus(card());
		fireEvent.mouseLeave(card());
		fireEvent.click(card());

		expect(frame()).toBeNull();
	});
});

it('holds the artwork back while its row is far from focus', () => {
	const {rerender} = render(<ModernMediaCard item={seerrShow()} serverUrl="http://server" deferImage />);
	expect(document.querySelector('img').hasAttribute('src')).toBe(false);
	rerender(<ModernMediaCard item={seerrShow()} serverUrl="http://server" />);
	expect(document.querySelector('img').getAttribute('src')).toBe(POSTER);
});

describe('ModernMediaCard loading its backdrop ahead', () => {
	const movie = {Id: 'm1', Name: 'Film', Type: 'Movie', ImageTags: {Primary: 'p'}, BackdropImageTags: ['t']};
	const drawn = (props) => render(<ModernMediaCard item={movie} serverUrl="http://server" {...props} />);

	beforeEach(() => {
		warmBackdrop.mockClear();
		mockSettings.backdropBlurHome = 20;
	});
	afterEach(() => {
		delete mockSettings.backdropBlurHome;
		delete mockSettings.showHomeBackdrop;
	});

	const rest = () => act(() => {
		jest.advanceTimersByTime(120);
	});

	it('does it for a card near focus, with the blur the backdrop will use, once it has stayed near for a moment', () => {
		drawn({warmRank: 2});
		expect(warmBackdrop).not.toHaveBeenCalled();
		rest();
		expect(warmBackdrop).toHaveBeenCalledWith(expect.stringContaining('/Items/m1/Images/Backdrop'), 20);
	});

	it('does it for the focused card too', () => {
		drawn({isFocused: true});
		rest();
		expect(warmBackdrop).toHaveBeenCalled();
	});

	it('asks for nothing from a card that focus has passed by before the moment is over, and lets a loaded one go with the card', () => {
		const stop = jest.fn();
		warmBackdrop.mockReturnValue(stop);
		const {unmount: passBy} = drawn({warmRank: 2});
		passBy();
		rest();
		expect(warmBackdrop).not.toHaveBeenCalled();
		const {unmount: letGo} = drawn({warmRank: 2});
		rest();
		expect(warmBackdrop).toHaveBeenCalledTimes(1);
		letGo();
		expect(stop).toHaveBeenCalledTimes(1);
		warmBackdrop.mockReset();
	});

	it('leaves a card far from focus, or in no window, alone', () => {
		drawn({warmRank: 6});
		drawn({warmRank: -1});
		rest();
		expect(warmBackdrop).not.toHaveBeenCalled();
	});

	it('loads nothing while the row holds its images back, or when the backdrop is off', () => {
		drawn({warmRank: 2, deferImage: true});
		mockSettings.showHomeBackdrop = false;
		drawn({warmRank: 2});
		rest();
		expect(warmBackdrop).not.toHaveBeenCalled();
	});
});
