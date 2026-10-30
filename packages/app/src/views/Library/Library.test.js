import {act, render} from '@testing-library/react';

import {getFromStorage} from '../../services/storage';
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
