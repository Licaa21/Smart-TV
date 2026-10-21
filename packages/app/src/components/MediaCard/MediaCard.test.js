import {act, fireEvent, render, screen} from '@testing-library/react';

import MediaCard from './MediaCard';
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
jest.mock('../seerr/SeerrStatusBadge', () => ({SeerrSeasonDot: () => null}));
jest.mock('../icons/SeerrIcon', () => () => null);
jest.mock('../AnimeMarkerPills', () => ({AnimeCardPill: () => null}));
jest.mock('../../hooks/useItemMenuHold', () => () => ({}));

const POSTER = 'https://image.tmdb.org/t/p/w342/poster.jpg';
const BACKDROP = 'https://image.tmdb.org/t/p/w1280/backdrop.jpg';
const THUMB = 'http://server/Moonfin/Tmdb/Thumb?type=movie&tmdbId=603&ApiKey=token';

// A Seerr row title the way normalizeMediaItem leaves it.
const seerrMovie = (overrides = {}) => ({
	Id: 'seerr-movie-603',
	Name: 'The Matrix',
	Type: 'Movie',
	_externalPosterUrl: POSTER,
	_externalBackdropUrl: BACKDROP,
	mediaInfo: {},
	_seerr: true,
	_seerrType: 'item',
	_seerrMediaType: 'movie',
	_seerrRaw: {mediaId: 603, mediaType: 'movie'},
	...overrides
});

const draw = (item, rowImageType) => {
	render(<MediaCard item={item} serverUrl="http://server" rowImageType={rowImageType} />);
	return {
		card: () => document.querySelector('[class~="card"]'),
		image: () => screen.getByRole('img')
	};
};

beforeEach(() => setTmdbThumbsAvailable(true));
afterAll(() => setTmdbThumbsAvailable(false));

describe('MediaCard in a Thumb row', () => {
	it('shows the titled thumb for a Seerr title and turns landscape', () => {
		const {card, image} = draw(seerrMovie(), 'thumb');
		expect(image().getAttribute('src')).toBe(THUMB);
		expect(card().className).toContain('landscape');
	});

	it('shows the plain backdrop when the plugin can\'t make thumbs', () => {
		setTmdbThumbsAvailable(false);
		const {card, image} = draw(seerrMovie(), 'thumb');
		expect(image().getAttribute('src')).toBe(BACKDROP);
		expect(card().className).toContain('landscape');
	});

	it('hands over to the backdrop when the thumb fails to load', () => {
		const {card, image} = draw(seerrMovie(), 'thumb');
		fireEvent.error(image());
		expect(image().getAttribute('src')).toBe(BACKDROP);
		expect(card().className).toContain('landscape');
	});

	it('stays a poster when there is no wide art at all', () => {
		setTmdbThumbsAvailable(false);
		const {card, image} = draw(seerrMovie({_externalBackdropUrl: null}), 'thumb');
		expect(image().getAttribute('src')).toBe(POSTER);
		expect(card().className).toContain('portrait');
	});

	it('picks the thumb up once the plugin ping comes back', () => {
		setTmdbThumbsAvailable(false);
		const {image} = draw(seerrMovie(), 'thumb');
		expect(image().getAttribute('src')).toBe(BACKDROP);
		act(() => setTmdbThumbsAvailable(true));
		expect(image().getAttribute('src')).toBe(THUMB);
	});

	it('keeps an owned outside list title on its library art', () => {
		const owned = seerrMovie({Id: 'lib1', _external: true, _resolvedFromExternal: true, ImageTags: {Primary: 'p', Thumb: 't'}});
		const {image} = draw(owned, 'thumb');
		expect(image().getAttribute('src')).not.toContain('/Moonfin/Tmdb/Thumb');
	});
});

describe('MediaCard in other rows', () => {
	it('shows an owned outside list title on its library poster', () => {
		const owned = seerrMovie({Id: 'lib1', _external: true, _resolvedFromExternal: true, ImageTags: {Primary: 'p'}});
		const {image} = draw(owned, 'poster');
		expect(image().getAttribute('src')).toContain('/Items/lib1/Images/Primary');
	});

	it('keeps the poster in a Poster row', () => {
		const {card, image} = draw(seerrMovie(), 'poster');
		expect(image().getAttribute('src')).toBe(POSTER);
		expect(card().className).toContain('portrait');
	});

	it('leaves a Banner row as it was', () => {
		const {card, image} = draw(seerrMovie(), 'banner');
		expect(image().getAttribute('src')).toBe(POSTER);
		expect(card().className).toContain('banner');
	});
});

it('holds the artwork back while its row is far from focus', () => {
	const {rerender} = render(<MediaCard item={seerrMovie()} serverUrl="http://server" rowImageType="poster" deferImage />);
	expect(document.querySelector('img').hasAttribute('src')).toBe(false);
	rerender(<MediaCard item={seerrMovie()} serverUrl="http://server" rowImageType="poster" />);
	expect(document.querySelector('img').getAttribute('src')).toBe(POSTER);
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
		<MediaCard item={item} serverUrl="http://server" spotlightId="media-row-film" {...props} />
	</MediaPreviewContext.Provider>
);

const previewCard = () => document.querySelector('[data-spotlight-id="media-row-film"]');
const frame = () => document.querySelector('[class~="previewFrame"]');
const ring = () => document.querySelector('[class~="previewRing"]');

describe('MediaCard with the media preview', () => {
	it('schedules on focus and hover, cancels on blur and pointer leave', () => {
		const controller = fakeController();
		drawWithPreview(libraryMovie(), controller);

		fireEvent.focus(previewCard());
		fireEvent.blur(previewCard());
		fireEvent.mouseEnter(previewCard());
		fireEvent.mouseLeave(previewCard());

		expect(controller.calls).toEqual([
			['schedule', 'media-row-film', 'film'],
			['cancel', 'media-row-film'],
			['schedule', 'media-row-film', 'film'],
			['cancel', 'media-row-film']
		]);
	});

	it('draws the frame and ring once attached, and holds the zoom off while playing', () => {
		const controller = fakeController();
		drawWithPreview(libraryMovie(), controller);
		expect(frame()).toBeNull();

		act(() => controller.listeners['media-row-film']('attached'));
		expect(frame()).not.toBeNull();
		expect(ring()).not.toBeNull();
		expect(frame().className).not.toContain('previewVisible');
		expect(previewCard().className).not.toContain('previewing');
		expect(controller.attachFrame).toHaveBeenCalledWith('media-row-film', frame());

		act(() => controller.listeners['media-row-film']('playing'));
		expect(frame().className).toContain('previewVisible');
		expect(previewCard().className).toContain('previewing');

		act(() => controller.listeners['media-row-film']('idle'));
		expect(frame()).toBeNull();
		expect(previewCard().className).not.toContain('previewing');
	});

	it('stops the preview before the card is selected', () => {
		const controller = fakeController();
		const onSelect = jest.fn(() => controller.calls.push(['select']));
		drawWithPreview(libraryMovie(), controller, {onSelect});

		fireEvent.click(previewCard());

		expect(controller.calls).toEqual([['stop', 'select'], ['select']]);
	});

	it('asks nothing for a card that can\'t be previewed', () => {
		const controller = fakeController();
		drawWithPreview(seerrMovie(), controller);

		fireEvent.focus(previewCard());

		expect(controller.subscribe).not.toHaveBeenCalled();
		expect(controller.calls).toEqual([]);
	});

	it('is inert without a provider', () => {
		render(<MediaCard item={libraryMovie()} serverUrl="http://server" spotlightId="media-row-film" />);

		fireEvent.focus(previewCard());
		fireEvent.click(previewCard());

		expect(frame()).toBeNull();
	});
});
