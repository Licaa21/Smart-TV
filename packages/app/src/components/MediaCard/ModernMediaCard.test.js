import {act, fireEvent, render, screen} from '@testing-library/react';

import ModernMediaCard from './ModernMediaCard';
import MediaPreviewContext from './MediaPreviewContext';
import {setTmdbThumbsAvailable} from '../../utils/tmdbThumb';

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
jest.mock('../../context/SettingsContext', () => ({useSettings: () => ({settings: {}})}));
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
const THUMB = 'http://server/Moonfin/Tmdb/Thumb?type=tv&tmdbId=1396&ApiKey=token';

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

const draw = (item, isFocused) => {
	const {unmount} = render(<ModernMediaCard item={item} serverUrl="http://server" isFocused={isFocused} />);
	const src = screen.getByRole('img').getAttribute('src');
	unmount();
	return src;
};

beforeEach(() => setTmdbThumbsAvailable(true));
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
		render(<ModernMediaCard item={seerrShow()} serverUrl="http://server" isFocused />);
		fireEvent.error(screen.getByRole('img'));
		expect(screen.getByRole('img').getAttribute('src')).toBe(BACKDROP);
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
		drawWithPreview(seerrShow(), controller);

		fireEvent.focus(card());
		fireEvent.click(card());

		expect(controller.subscribe).not.toHaveBeenCalled();
		expect(controller.calls).toEqual([]);
	});

	it('is inert without a provider', () => {
		render(<ModernMediaCard item={libraryMovie()} serverUrl="http://server" spotlightId="media-row-film" />);

		fireEvent.focus(card());
		fireEvent.mouseLeave(card());
		fireEvent.click(card());

		expect(frame()).toBeNull();
	});
});
