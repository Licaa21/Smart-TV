import {act, fireEvent, render, screen} from '@testing-library/react';
import Spotlight from '@enact/spotlight';

import {getFromStorage, saveToStorage} from '../../services/storage';
import Library from './Library';

const mockApi = {getItems: jest.fn(), getQueryFilters: jest.fn(), getLibraries: jest.fn()};
const mockAuth = {api: mockApi, serverUrl: 'http://server', serverType: 'jellyfin'};
const mockSettings = {settings: {libraryStyle: 'modern'}, updateSetting: jest.fn()};
const mockScreens = {book: null, music: null, musicCategory: null};
const movies = {Id: 'lib1', Name: 'Movies', CollectionType: 'movies'};

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
jest.mock('../../services/jellyfinApi', () => ({createApiForServer: () => mockApi}));
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
let mockGrid = {};
jest.mock('../../components/TileGrid', () => (props) => {
	mockGrid = props;
	return null;
});
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

// The landing waits a beat after the first page, so the check waits past it.
const previewMovies = {Id: 'lib1', Name: 'Movies', CollectionType: 'movies'};
// [ownApi] leaves the answers the test set up for getItems alone
const renderLibrary = (ownApi = false) => {
	getFromStorage.mockImplementation(() => Promise.resolve(null));
	if (!ownApi) mockApi.getItems.mockResolvedValue({Items: [{Id: 'm1', Name: 'Alien', Type: 'Movie'}], TotalRecordCount: 1});
	return render(<Library library={previewMovies} backHandlerRef={{current: null}} onHome={jest.fn()} />);
};
const pastLanding = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 150)); });
const CONTAINER_IDS = ['library-toolbar', 'library-bar', 'library-dock', 'library-letters', 'library-grid-area'];
const containerIds = () => CONTAINER_IDS.filter((id) => document.querySelector(`[data-spotlight-id="${id}"]`));

test('the screen lands focus on its grid and keeps its own container ids', async () => {
	renderLibrary();
	await settle();
	await pastLanding();

	expect(Spotlight.focus).toHaveBeenCalledWith('library-grid');
	expect(containerIds()).toEqual(['library-bar', 'library-letters', 'library-grid-area']);
	expect(screen.queryByText('Alien')).toBeNull();
});

test('the settings preview holds its first card, takes no focus and leaves the screen\'s container ids to it in every style', async () => {
	const saved = mockSettings.settings;
	getFromStorage.mockImplementation(() => Promise.resolve(null));
	mockApi.getItems.mockResolvedValue({Items: [{Id: 'm1', Name: 'Alien', Type: 'Movie'}], TotalRecordCount: 1});
	try {
		for (const libraryStyle of ['classic', 'modern', 'docked']) {
			mockSettings.settings = {...saved, libraryStyle, showAlphabeticalFilters: true};
			const {unmount} = render(<Library library={previewMovies} settingsPreview />);
			await settle();
			await pastLanding();

			expect(screen.getByText('Alien')).toBeTruthy();
			expect(containerIds()).toEqual([]);
			unmount();
		}
		expect(Spotlight.focus).not.toHaveBeenCalled();
	} finally {
		mockSettings.settings = saved;
	}
});

test('a scroll page for a list that has since been reloaded leaves the new list\'s paging alone', async () => {
	const pageOf = (prefix) => Array.from({length: 150}, (_, i) => ({Id: `${prefix}${i}`, Name: `${prefix} ${i}`, Type: 'Movie'}));
	let staleScrollPage;
	mockApi.getItems.mockImplementation((params) => {
		if (params.StartIndex > 0 && !staleScrollPage) {
			return new Promise((resolve) => {
				staleScrollPage = () => resolve({Items: pageOf('old-more'), TotalRecordCount: 400});
			});
		}
		return Promise.resolve({Items: pageOf(params.SortBy === 'SortName' ? 'old' : 'new'), TotalRecordCount: 400});
	});
	renderLibrary(true);
	await settle();
	act(() => {
		window.dispatchEvent(new CustomEvent('moonfin:libraryLoadMore'));
	});

	fireEvent.click(document.querySelector('[data-spotlight-id="library-sort-btn"]'));
	// the fork's popup opens on Sort By, so its options are already there
	fireEvent.click(screen.getByText('Date Added'));
	await settle();
	await act(async () => staleScrollPage());
	await settle();
	act(() => {
		window.dispatchEvent(new CustomEvent('moonfin:libraryLoadMore'));
	});
	await settle();

	expect(mockApi.getItems).toHaveBeenLastCalledWith(expect.objectContaining({StartIndex: 150, SortBy: 'DateCreated,SortName'}));
});

test('a studio from another server is browsed for its movies and shows', async () => {
	const otherServer = {Id: null, Name: 'A24', _serverUrl: 'http://other', _serverAccessToken: 'token', _serverUserId: 'user'};
	render(<Library library={otherServer} studioFilter="A24" backHandlerRef={{current: null}} onHome={jest.fn()} />);
	await settle();

	const [params] = mockApi.getItems.mock.calls[0];
	expect(params).toMatchObject({Studios: 'A24', IncludeItemTypes: 'Movie,Series', Recursive: true});
	expect(params.ParentId).toBeUndefined();
	expect(params.ExcludeItemTypes).toBeUndefined();
});

describe('a photo slideshow', () => {
	const photos = [
		{Id: 'p1', Name: 'Beach day', Type: 'Photo'},
		{Id: 'p2', Name: 'Snow', Type: 'Photo'},
		{Id: 'v1', Name: 'Beach clip', Type: 'Video'}
	];
	const openPhoto = (index) => act(() => {
		mockGrid.onClick({currentTarget: {dataset: {index: String(index)}}});
	});

	test('that played a video brings the library back on the search it was started from', async () => {
		mockApi.getItems.mockResolvedValue({Items: photos, TotalRecordCount: 3});
		const onViewPhoto = jest.fn();
		const {unmount} = render(<Library library={movies} backHandlerRef={{current: null}} onHome={jest.fn()} onViewPhoto={onViewPhoto} />);
		await settle();
		fireEvent.change(screen.getByPlaceholderText('Search this library...'), {target: {value: 'beach'}});
		openPhoto(0);
		const [, siblings, source] = onViewPhoto.mock.calls[0];
		expect(siblings.map((item) => item.Id)).toEqual(['p1', 'v1']);

		source.noteReturn('v1');
		unmount();
		const handed = [];
		const onItems = (ev) => handed.push(ev.detail.items.map((item) => item.Id));
		window.addEventListener('moonfin:libraryItems', onItems);
		render(<Library library={movies} backHandlerRef={{current: null}} onHome={jest.fn()} onViewPhoto={onViewPhoto} />);
		await settle();
		await pastLanding();
		window.removeEventListener('moonfin:libraryItems', onItems);

		expect(screen.getByPlaceholderText('Search this library...').value).toBe('beach');
		expect(handed[handed.length - 1]).toEqual(['p1', 'v1']);
	});

	test('closing on a photo the library has yet to fetch pages it in and lands on it', async () => {
		const firstPage = Array.from({length: 150}, (_, i) => ({Id: `p${i}`, Name: `Photo ${i}`, Type: 'Photo'}));
		mockApi.getItems.mockImplementation(async (params) => (params.StartIndex === 150
			? {Items: [{Id: 'p150', Name: 'Photo 150', Type: 'Photo'}], TotalRecordCount: 151}
			: {Items: firstPage, TotalRecordCount: 151}));
		renderLibrary(true);
		await settle();
		await pastLanding();
		const scrollTo = jest.fn();
		mockGrid.cbScrollTo(scrollTo);

		act(() => {
			window.dispatchEvent(new CustomEvent('moonfin:focusLibraryItem', {detail: 'p150'}));
		});
		await settle();

		expect(mockApi.getItems).toHaveBeenLastCalledWith(expect.objectContaining({StartIndex: 150}));
		expect(scrollTo).toHaveBeenCalledWith({index: 150, focus: true});
	});
});
