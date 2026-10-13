import {act, render, screen, waitFor} from '@testing-library/react';

import SeerrDiscover from './SeerrDiscover';

const mockSettings = {settings: {}};
const mockSeerr = {isAuthenticated: true, isEnabled: true, user: {seerrUserId: 7}};
const mockModernRows = [];

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
jest.mock('@enact/spotlight', () => ({focus: jest.fn(() => true), getPointerMode: () => false}));
// Spotlight's own props would be unknown attributes on the plain elements these mocks render.
const plain = (type) => {
	const React = require('react');
	return ({spotlightId, ...props}) => React.createElement(type, {...props, 'data-spotlight-id': spotlightId});
};
jest.mock('@enact/spotlight/Spottable', () => (type) => plain(type));
jest.mock('@enact/spotlight/SpotlightContainerDecorator', () => (config, type) => plain(type));
jest.mock('../../context/SeerrContext', () => ({useSeerr: () => mockSeerr}));
jest.mock('../../context/SettingsContext', () => ({useSettings: () => mockSettings}));
jest.mock('../../context/AuthContext', () => ({useAuth: () => ({serverUrl: 'http://server'})}));
jest.mock('../../components/LoadingSpinner', () => () => null);
jest.mock('../../utils/seerrHydration', () => ({
	__esModule: true,
	default: (requests) => Promise.resolve(requests),
	hydrateWatchlistItems: (items) => Promise.resolve(items)
}));
// Home's Modern row stands in as a marker, holding on to what Discover handed it.
jest.mock('../../components/MediaRow', () => {
	const React = require('react');
	return {
		ModernMediaRow: (props) => {
			mockModernRows.push(props);
			return React.createElement('div', {'data-modern-row': props.rowId, 'data-spotlight-id': props.spotlightId});
		}
	};
});
jest.mock('../../services/seerrApi', () => ({
	__esModule: true,
	default: {
		getUser: jest.fn(),
		canManageRequests: () => false,
		canManageIssues: () => false,
		getMyRequests: jest.fn(),
		trending: jest.fn(),
		trendingMovies: jest.fn(),
		trendingTv: jest.fn(),
		upcomingMovies: jest.fn(),
		upcomingTv: jest.fn(),
		getGenreSliderMovies: jest.fn(),
		getGenreSliderTv: jest.fn(),
		getImageUrl: (path, size) => (path ? `https://image.tmdb.org/t/p/${size}${path}` : null)
	}
}));

import seerrApi from '../../services/seerrApi';

const MODERN_ROWS = ['myRequests', 'trending', 'popularMovies', 'popularTv', 'upcomingMovies', 'upcomingTv'];

// The latest props each Modern row was drawn with.
const modernRow = (rowId) => mockModernRows.filter((props) => props.rowId === rowId).pop();

const find = (selector) => document.querySelector(selector);

const drawDiscover = async (props = {}) => {
	render(<SeerrDiscover onOpenRequests={() => {}} {...props} />);
	await waitFor(() => expect(find('[data-spotlight-id="discover-row-0"]')).not.toBeNull());
};

// Twenty titles a page, the way Seerr pages its discover lists.
const page = (prefix, mediaType) => (pageNumber = 1) => Promise.resolve({
	results: Array.from({length: 20}, (_, i) => ({
		id: pageNumber * 100 + i,
		mediaType,
		title: mediaType === 'movie' ? `${prefix} ${pageNumber}-${i}` : undefined,
		name: mediaType === 'tv' ? `${prefix} ${pageNumber}-${i}` : undefined,
		posterPath: '/poster.jpg',
		backdropPath: '/backdrop.jpg'
	}))
});

beforeEach(() => {
	mockModernRows.length = 0;
	mockSettings.settings = {};
	seerrApi.getUser.mockResolvedValue({id: 7, permissions: 0});
	seerrApi.getMyRequests.mockResolvedValue({results: [
		{id: 41, status: 3, type: 'movie', media: {tmdbId: 603, title: 'The Matrix', status: 1, posterPath: '/m.jpg'}},
		{id: 42, status: 2, type: 'movie', media: {tmdbId: 603, title: 'The Matrix', status: 3, jellyfinMediaId: 'lib603'}},
		{id: 43, status: 1, type: 'tv', media: {}}
	]});
	seerrApi.trending.mockImplementation(page('Trending', 'movie'));
	seerrApi.trendingMovies.mockImplementation(page('Movie', 'movie'));
	seerrApi.trendingTv.mockImplementation(page('Show', 'tv'));
	seerrApi.upcomingMovies.mockImplementation(page('Upcoming', 'movie'));
	seerrApi.upcomingTv.mockImplementation(page('Soon', 'tv'));
	seerrApi.getGenreSliderMovies.mockResolvedValue([{id: 28, name: 'Action', backdrops: []}]);
	seerrApi.getGenreSliderTv.mockResolvedValue([]);
});

describe('SeerrDiscover in the Modern style', () => {
	it('draws the media and request rows with Home\'s Modern row and keeps the tiles', async () => {
		await drawDiscover();
		const drawn = Array.from(document.querySelectorAll('[data-modern-row]')).map((el) => el.getAttribute('data-modern-row'));
		expect(drawn).toEqual(MODERN_ROWS);
		// The shortcuts row leads and stays a tile row, so its id still belongs to Discover's own row.
		expect(find('[data-spotlight-id="discover-row-0"]').getAttribute('data-modern-row')).toBeNull();
		expect(modernRow('myRequests').spotlightId).toBe('discover-row-1');
		expect(modernRow('trending').spotlightId).toBe('discover-row-2');
		expect(screen.getByText('Action')).toBeTruthy();
	});

	it('leaves the info header out', async () => {
		await drawDiscover();
		expect(find('h2[class~="detailTitle"]')).toBeNull();
		expect(find('[class~="modernRows"]')).not.toBeNull();
	});

	it('hands the rows normalized items, a card per request with its status', async () => {
		await drawDiscover();
		const trending = modernRow('trending').items;
		expect(trending).toHaveLength(9);
		expect(trending[0]).toMatchObject({Id: 'seerr-movie-100', Type: 'Movie', _seerrMediaType: 'movie', _seerrRaw: {mediaId: 100, mediaType: 'movie'}});
		const requests = modernRow('myRequests').items;
		expect(requests.map((item) => item.Id)).toEqual(['seerr-request-41', 'seerr-request-42']);
		expect(requests.map((item) => item.Subtitle)).toEqual(['Declined', 'Requested']);
	});

	it('opens the same Seerr detail the classic card opens', async () => {
		const onSelectItem = jest.fn();
		await drawDiscover({onSelectItem});
		const requests = modernRow('myRequests');
		act(() => requests.onSelectItem(requests.items[1]));
		expect(onSelectItem).toHaveBeenCalledWith({mediaId: 603, mediaType: 'movie', libraryId: 'lib603'});
		const show = modernRow('popularTv');
		act(() => show.onSelectItem(show.items[0]));
		expect(onSelectItem).toHaveBeenLastCalledWith({mediaId: 100, mediaType: 'tv', libraryId: null});
	});

	it('keeps paging a row through the load more callback', async () => {
		await drawDiscover();
		const first = modernRow('trending');
		await act(async () => {
			first.onLoadMore('trending');
		});
		expect(seerrApi.trending).toHaveBeenLastCalledWith(2);
		await waitFor(() => expect(modernRow('trending').items).toHaveLength(18));
		// The callback the row kept from its first draw still reaches the current page.
		await act(async () => {
			first.onLoadMore('trending');
		});
		expect(seerrApi.trending).toHaveBeenLastCalledWith(3);
	});
});

describe('SeerrDiscover in the Classic style', () => {
	it('keeps its own rows and the info header', async () => {
		mockSettings.settings = {homeRowsStyle: 'v1'};
		await drawDiscover();
		expect(find('[data-modern-row]')).toBeNull();
		expect(mockModernRows).toHaveLength(0);
		expect(find('h2[class~="detailTitle"]').textContent).toBe('Discover');
		expect(find('[class~="modernRows"]')).toBeNull();
		expect(document.querySelectorAll('[data-spotlight-id="discover-row-2"] [class~="mediaCard"]')).toHaveLength(9);
	});
});
