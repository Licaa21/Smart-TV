import {act, fireEvent, render, screen} from '@testing-library/react';

import {getFromStorage, saveToStorage} from '../../services/storage';
import Library from './Library';

const mockApi = {getItems: jest.fn(), getQueryFilters: jest.fn(), getLibraries: jest.fn()};
const mockAuth = {api: mockApi, serverUrl: 'http://server', serverType: 'jellyfin'};
const mockSettings = {settings: {libraryStyle: 'modern'}, updateSetting: jest.fn()};
const mockScreens = {book: null, music: null, musicCategory: null};

jest.mock('react/jsx-dev-runtime', () => {
	const React = require('react');
	return {Fragment: React.Fragment, jsxDEV: (type, props, key, staticChildren) => {
		const config = key === undefined ? props : {...props, key};
		return staticChildren && Array.isArray(props.children)
			? React.createElement(type, config, ...props.children)
			: React.createElement(type, config);
	}};
});
jest.mock('@enact/i18n/$L', () => (text) => text);
jest.mock('@enact/spotlight', () => ({focus: jest.fn(() => true), getPointerMode: () => false}));
const plain = (type) => {
	const React = require('react');
	return ({spotlightId, ...props}) => React.createElement(type, {...props, 'data-spotlight-id': spotlightId});
};
jest.mock('@enact/spotlight/Spottable', () => (type) => plain(type));
jest.mock('@enact/spotlight/SpotlightContainerDecorator', () => (config, type) => plain(type));
jest.mock('@enact/sandstone/VirtualList', () => ({VirtualGridList: () => null}));
jest.mock('../../context/AuthContext', () => ({useAuth: () => mockAuth}));
jest.mock('../../context/SettingsContext', () => ({useSettings: () => mockSettings}));
jest.mock('../../services/jellyfinApi', () => ({createApiForServer: () => null}));
jest.mock('../../services/mdblistApi', () => ({isMdblistEnabled: () => false}));
jest.mock('../../services/parentalControls', () => ({withoutBlockedItems: (items) => items}));
jest.mock('../../services/storage', () => ({getFromStorage: jest.fn(() => Promise.resolve(null)), saveToStorage: jest.fn()}));
jest.mock('../../hooks/useUserDataSync', () => ({useUserDataList: (items) => items}));
jest.mock('../../hooks/useItemMenuHold', () => ({__esModule: true, default: () => ({}), cardIndexOf: () => 0}));
jest.mock('../../hooks/useStyleLibraries', () => ({__esModule: true, default: () => null}));
jest.mock('../../utils/helpers', () => ({getImageUrl: () => null, getPrimaryImageId: () => null, formatDuration: () => '0m'}));
jest.mock('../MusicBrowse', () => (props) => { mockScreens.music = props; return null; });
jest.mock('../MusicBrowse/MusicCategoryScreen', () => (props) => { mockScreens.musicCategory = props; return null; });
jest.mock('../BookBrowse', () => (props) => { mockScreens.book = props; return null; });
jest.mock('../../components/BackdropLayer', () => () => null);
jest.mock('../../components/TileGrid', () => () => null);
jest.mock('../../components/MediaRow', () => () => null);
jest.mock('../../components/RatingsRow', () => () => null);
jest.mock('./LibrarySkeleton', () => () => null);
jest.mock('../../components/SpottableInput/SpottableInput', () => {
	const React = require('react');
	return React.forwardRef(({value, onChange, placeholder}, ref) => React.createElement('input', {ref, value, onChange, placeholder}));
});

const settle = async () => {
	for (let i = 0; i < 3; i++) {
		await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
	}
};

beforeEach(() => {
	jest.clearAllMocks();
	getFromStorage.mockImplementation(() => Promise.resolve(null));
	mockScreens.book = mockScreens.music = mockScreens.musicCategory = null;
	mockApi.getItems.mockResolvedValue({Items: [], TotalRecordCount: 0});
	mockApi.getQueryFilters.mockResolvedValue(null);
});

describe('the book library', () => {
	const books = {Id: 'books1', Name: 'Books', CollectionType: 'books'};

	it('hands its screens a way to open another screen, and the one that is open', async () => {
		render(<Library library={books} backHandlerRef={{current: null}} />);
		await settle();
		expect(mockScreens.book.screen).toBeNull();
		expect(typeof mockScreens.book.onOpenScreen).toBe('function');

		act(() => mockScreens.book.onOpenScreen({id: 'authors'}));
		expect(mockScreens.book.screen).toEqual({id: 'authors'});
	});
});

describe('the music library', () => {
	const music = {Id: 'music1', Name: 'Music', CollectionType: 'music'};

	it('opens a category screen for a See All, and leaves a genre to the albums grid', async () => {
		render(<Library library={music} backHandlerRef={{current: null}} />);
		await settle();
		expect(mockScreens.musicCategory).toBeNull();

		act(() => mockScreens.music.onOpenGrid('favoriteAlbums'));
		expect(mockScreens.musicCategory.screen).toEqual({id: 'favorites', tab: 'albums'});

		act(() => mockScreens.musicCategory.onBack());
		expect(mockScreens.music).not.toBeNull();

		mockScreens.musicCategory = null;
		act(() => mockScreens.music.onOpenGrid('albums', 'Rock'));
		expect(mockScreens.musicCategory).toBeNull();
	});

	it('opens the Artists See All on the artists screen and not the albums grid', async () => {
		render(<Library library={music} backHandlerRef={{current: null}} />);
		await settle();

		act(() => mockScreens.music.onOpenGrid('allArtists'));
		expect(mockScreens.musicCategory.screen).toEqual({id: 'artists', mode: 'artists'});
	});
});

describe('the filters of a library', () => {
	const movies = {Id: 'lib1', Name: 'Movies', CollectionType: 'movies'};
	const stored = {};
	// Storage answers a beat later, the way the TV's does, so the first render runs on defaults
	const slowStorage = () => getFromStorage.mockImplementation((key) => new Promise((resolve) => setTimeout(() => resolve(key in stored ? stored[key] : null), 0)));

	beforeEach(() => {
		Object.keys(stored).forEach((key) => delete stored[key]);
		mockApi.getItems.mockResolvedValue({Items: [{Id: 'm1', Name: 'Alien', Type: 'Movie'}], TotalRecordCount: 1});
	});

	it('wait for what this device saved before the first page, and the page is fetched with them', async () => {
		stored.library_filters_lib1 = {favoritesOnly: true, tagFilters: ['4K']};
		slowStorage();
		render(<Library library={movies} backHandlerRef={{current: null}} onHome={jest.fn()} />);
		expect(mockApi.getItems).not.toHaveBeenCalled();
		await settle();
		expect(mockApi.getItems).toHaveBeenCalled();
		mockApi.getItems.mock.calls.forEach(([params]) => {
			expect(JSON.stringify(params)).toContain('IsFavorite');
			expect(JSON.stringify(params)).toContain('4K');
		});
	});

	it('are saved for the library when one is picked in the popup, and a library with none saves nothing', async () => {
		slowStorage();
		render(<Library library={movies} backHandlerRef={{current: null}} onHome={jest.fn()} />);
		await settle();
		expect(saveToStorage.mock.calls.filter(([key]) => key === 'library_filters_lib1')).toHaveLength(0);

		fireEvent.click(document.querySelector('[data-spotlight-id="library-sort-btn"]'));
		fireEvent.click(document.querySelector('[data-spotlight-id="sort-panel-group-favorites"]'));
		fireEvent.click(screen.getByText('Favorites Only'));
		await settle();
		expect(saveToStorage).toHaveBeenCalledWith('library_filters_lib1', expect.objectContaining({favoritesOnly: true}));
	});

	it('are not kept for a music library, which opens its grids with filters of their own', async () => {
		slowStorage();
		render(<Library library={{Id: 'music1', Name: 'Music', CollectionType: 'music'}} backHandlerRef={{current: null}} />);
		await settle();
		expect(getFromStorage.mock.calls.filter(([key]) => /^library_filters_music1/.test(key)).length).toBeGreaterThanOrEqual(0);
		expect(saveToStorage.mock.calls.filter(([key]) => /^library_filters_/.test(key))).toHaveLength(0);
	});
});

describe('the popup', () => {
	it('carries Show Alphabet in its own group, with what is on in its summary', async () => {
		getFromStorage.mockImplementation(() => Promise.resolve(null));
		render(<Library library={{Id: 'lib1', Name: 'Movies', CollectionType: 'movies'}} backHandlerRef={{current: null}} />);
		await settle();
		fireEvent.click(document.querySelector('[data-spotlight-id="library-sort-btn"]'));
		const group = document.querySelector('[data-spotlight-id="sort-panel-group-view"]');
		expect(group).not.toBeNull();
		expect(group.textContent).toContain('Show Alphabet');
		fireEvent.click(group);
		// The summary of the group says it too, so the option is the one in the options pane
		fireEvent.click(screen.getAllByText('Show Alphabet').find((el) => /optionLabel/.test(el.className)));
		await settle();
		expect(saveToStorage.mock.calls.map(([key]) => key)).toContain('library_letterNav_lib1');
		expect(saveToStorage).toHaveBeenCalledWith('library_letterNav_lib1', 'off');
	});
});

describe('the Songs grid of a music library', () => {
	it('has a Shuffle button that plays random songs from the library', async () => {
		const onPlay = jest.fn();
		getFromStorage.mockImplementation(() => Promise.resolve(null));
		mockApi.getItems.mockResolvedValue({Items: [{Id: 't1', Name: 'Song', Type: 'Audio'}], TotalRecordCount: 1});
		render(<Library library={{Id: 'music1', Name: 'Music', CollectionType: 'music'}} backHandlerRef={{current: null}} onPlay={onPlay} />);
		await settle();
		act(() => mockScreens.music.onOpenGrid('songs'));
		act(() => mockScreens.musicCategory.onOpenSongsGrid());
		await settle();
		const shuffle = document.querySelector('[data-spotlight-id="library-shuffle-btn"]');
		expect(shuffle).not.toBeNull();
		fireEvent.click(shuffle);
		await settle();
		expect(mockApi.getItems).toHaveBeenCalledWith(expect.objectContaining({IncludeItemTypes: 'Audio', SortBy: 'Random', ParentId: 'music1'}));
		expect(onPlay).toHaveBeenCalledWith(expect.objectContaining({Id: 't1'}), false, {audioPlaylist: [expect.objectContaining({Id: 't1'})]});
	});
});
