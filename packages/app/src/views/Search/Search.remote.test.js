import {act, fireEvent, render, screen} from '@testing-library/react';
import Spotlight from '@enact/spotlight';
import Search from './Search';
import {createRemoteSearch} from '../../services/remoteSearch';

const mockApi = {getLibraries: jest.fn(), search: jest.fn(), searchPeople: jest.fn()};
const mockAuth = {api: mockApi, serverUrl: 'http://server', hasMultipleServers: false};
let mockSettings = {settings: {}};
const mockSave = jest.fn();

jest.mock('react/jsx-dev-runtime', () => {
	const React = require('react');
	return {jsxDEV: (type, props, key, staticChildren) => {
		const config = key === undefined ? props : {...props, key};
		return staticChildren && Array.isArray(props.children)
			? React.createElement(type, config, ...props.children)
			: React.createElement(type, config);
	}};
});
jest.mock('@enact/i18n/$L', () => (text) => text);
jest.mock('@enact/spotlight', () => ({focus: jest.fn(() => true)}));
jest.mock('@enact/spotlight/Pause', () => ({isPaused: () => false}));
jest.mock('@enact/spotlight/Spottable', () => (type) => type);
jest.mock('@enact/spotlight/SpotlightContainerDecorator', () => (config, type) => type);
jest.mock('../../context/AuthContext', () => ({useAuth: () => mockAuth}));
jest.mock('../../context/SettingsContext', () => ({useSettings: () => mockSettings}));
let mockSeerr = {isEnabled: false};
jest.mock('../../context/SeerrContext', () => ({useSeerr: () => mockSeerr}));
jest.mock('../../utils/seerrHomeRows', () => ({normalizeMediaItem: (result) => ({Id: `seerr-${result.id}`, Type: 'Movie', Name: result.title, _seerrMediaType: result.mediaType})}));
jest.mock('../../services/connectionPool', () => ({}));
jest.mock('../../services/serverLogger', () => ({__esModule: true, default: {info: jest.fn(), LOG_CATEGORIES: {APP: 'Application'}}}));
jest.mock('../../services/gamesApi', () => ({}));
jest.mock('../../services/parentalControls', () => ({withoutBlockedItems: (items) => items}));
jest.mock('../../hooks/useStorage', () => () => [[], mockSave]);
jest.mock('../../hooks/useItemMenuHold', () => () => ({}));
jest.mock('../../components/DetailsTabBar', () => (props) => { global.mockTabs = props; return null; });
jest.mock('../../components/LoadingSpinner', () => () => null);
jest.mock('../../components/ProxiedImage', () => () => null);
jest.mock('../../components/GameCard', () => () => null);
// Stand-ins that show which Home component drew a row and what it was handed.
jest.mock('../../components/MediaRow', () => {
	const React = require('react');
	const row = (style) => (props) => {
		const {title, items, cardType, loading, rowImageType} = props;
		global.mockRowProps[title] = props;
		return React.createElement('div', {
		'data-testid': 'row', 'data-style': style, 'data-title': title, 'data-card-type': cardType,
			'data-count': items ? items.length : 0, 'data-loading': loading ? 'yes' : 'no', 'data-image-type': rowImageType
		});
	};
	return {ClassicMediaRow: row('classic'), ModernMediaRow: row('modern')};
});
jest.mock('../../components/MediaCard', () => ({ClassicMediaCard: () => null, ModernMediaCard: () => null}));
jest.mock('../../components/SpottableInput/SpottableInput', () => {
	const React = require('react');
	return React.forwardRef(({value, onChange, onKeyDown}, ref) => React.createElement('input', {ref, value, onChange, onKeyDown}));
});

beforeEach(() => {
	global.mockRowProps = {};
	jest.useFakeTimers();
	jest.clearAllMocks();
	mockApi.getLibraries.mockResolvedValue([]);
	mockApi.search.mockResolvedValue({Items: []});
	mockApi.searchPeople.mockResolvedValue({Items: []});
});
afterEach(() => jest.useRealTimers());

test('mounts with pending text and updates the real search path without stealing focus', async () => {
	const search = createRemoteSearch('phone');
	search.receive({String: 'alien'});
	const view = render(<Search remoteSearch={search} />);
	expect(screen.getByRole('textbox').value).toBe('alien');
	await act(async () => { jest.advanceTimersByTime(450); });
	expect(mockApi.search).toHaveBeenCalledWith('alien', expect.any(Number));
	await act(async () => { jest.advanceTimersByTime(60); });
	expect(Spotlight.focus.mock.calls.every(([target]) => target === 'search-input')).toBe(true);
	view.unmount();
	expect(search.active).toBe(false);
});

test('preserves remote Unicode without the local keyboard encoding workaround', async () => {
	const search = createRemoteSearch('phone');
	search.receive({String: 'Ã© 日本語 🦞'});
	render(<Search remoteSearch={search} />);
	await act(async () => { jest.advanceTimersByTime(450); });
	expect(mockApi.search).toHaveBeenCalledWith('Ã© 日本語 🦞', expect.any(Number));
});

test('opening the receiver keyboard does not end phone typing', async () => {
	const search = createRemoteSearch('phone');
	render(<Search remoteSearch={search} />);
	const input = screen.getByRole('textbox');
	fireEvent.keyDown(input, {keyCode: 13});
	fireEvent.click(input);
	expect(search.active).toBe(true);
	act(() => search.receive({String: 'alien', MoonfinInputId: 'phone', MoonfinRevision: '1'}));
	expect(input.value).toBe('alien');
	await act(async () => { jest.advanceTimersByTime(450); });
	expect(mockApi.search).toHaveBeenCalledWith('alien', expect.any(Number));
});

test('a phone edit over the system keyboard hands focus back to the search field', () => {
	const search = createRemoteSearch('phone');
	render(<Search remoteSearch={search} />);
	const input = screen.getByRole('textbox');
	input.focus();
	Spotlight.focus.mockClear();
	act(() => search.receive({String: 'alien', MoonfinInputId: 'phone', MoonfinRevision: '1'}));
	expect(document.activeElement).not.toBe(input);
	expect(Spotlight.focus).toHaveBeenCalledWith('search-input');
	expect(input.value).toBe('alien');
});

test('clear discards results from a request that completes after the clear', async () => {
	let finish;
	mockApi.search.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
	const search = createRemoteSearch('phone');
	search.receive({String: 'alien'});
	render(<Search remoteSearch={search} />);
	await act(async () => { jest.advanceTimersByTime(450); });
	act(() => search.receive({String: ''}));
	await act(async () => { jest.advanceTimersByTime(450); });
	await act(async () => { finish({Items: [{Id: 'old', Type: 'Movie', Name: 'Old movie'}]}); });
	expect(screen.getByRole('textbox').value).toBe('');
	expect(screen.getByText('Search for content')).toBeTruthy();
	expect(screen.queryByText('Old movie')).toBeNull();
});

test('local input takes over and a new remote search can start on the same screen', async () => {
	const first = createRemoteSearch('first');
	const view = render(<Search remoteSearch={first} />);
	fireEvent.change(screen.getByRole('textbox'), {target: {value: 'local'}});
	act(() => first.receive({String: 'late remote'}));
	expect(screen.getByRole('textbox').value).toBe('local');
	const second = createRemoteSearch('second');
	second.receive({String: 'next'});
	view.rerender(<Search remoteSearch={second} />);
	expect(screen.getByRole('textbox').value).toBe('next');
	await act(async () => { jest.advanceTimersByTime(450); });
	expect(mockApi.search).toHaveBeenLastCalledWith('next', expect.any(Number));
});

describe('results drawn with the Home rows', () => {
	const items = [
		{Id: 'm1', Type: 'Movie', Name: 'Alien'},
		{Id: 'e1', Type: 'Episode', Name: 'Pilot', SeriesName: 'Show'},
		{Id: 'p1', Type: 'Person', Name: 'Sigourney'}
	];
	const searchFor = async (settings) => {
		mockSettings = {settings};
		mockApi.search.mockResolvedValue({Items: items});
		const search = createRemoteSearch('phone');
		search.receive({String: 'alien'});
		render(<Search remoteSearch={search} />);
		await act(async () => { jest.advanceTimersByTime(450); });
		await act(async () => { jest.advanceTimersByTime(60); });
	};
	afterEach(() => { mockSettings = {settings: {}}; });

	test('each kind of result gets the row shape Home gives it, with the title and count', async () => {
		await searchFor({});
		const rows = screen.getAllByTestId('row');
		expect(rows.map((row) => row.getAttribute('data-title'))).toEqual(['Movies (1)', 'Episodes (1)', 'People (1)']);
		expect(rows.map((row) => row.getAttribute('data-card-type'))).toEqual(['portrait', 'landscape', 'circle']);
	});

	test('only the rows around the focused one are built, the rest stand in as placeholders', async () => {
		await searchFor({});
		const rows = screen.getAllByTestId('row');
		expect(rows.map((row) => row.getAttribute('data-loading'))).toEqual(['no', 'no', 'yes']);
	});

	test('the Home rows setting picks the classic or the modern row, and its artwork type comes along', async () => {
		await searchFor({homeRowsStyle: 'v1', homeRowsImageType: 'thumb'});
		const row = screen.getAllByTestId('row')[0];
		expect(row.getAttribute('data-style')).toBe('classic');
		expect(row.getAttribute('data-image-type')).toBe('thumb');
	});

	test('the modern rows are the default', async () => {
		await searchFor({});
		expect(screen.getAllByTestId('row')[0].getAttribute('data-style')).toBe('modern');
	});
});

test('a row drawn before the Seerr results arrive can still move down onto the Seerr row', async () => {
	let finishSeerr;
	mockSeerr = {isEnabled: true, displayName: 'Seerr', api: {search: () => new Promise((resolve) => { finishSeerr = resolve; })}};
	mockSettings = {settings: {}};
	mockApi.search.mockResolvedValue({Items: [
		{Id: 's1', Type: 'Series', Name: 'Show'},
		{Id: 'p1', Type: 'Person', Name: 'Actor'}
	]});
	const search = createRemoteSearch('phone');
	search.receive({String: 'show'});
	render(<Search remoteSearch={search} />);
	await act(async () => { jest.advanceTimersByTime(450); });
	await act(async () => { jest.advanceTimersByTime(60); });
	// The handler the People row was given before Seerr had answered, the one a row that
	// ignores handler changes keeps hold of.
	const early = global.mockRowProps['People (1)'].onNavigateDown;
	await act(async () => { finishSeerr({results: [{id: 7, title: 'Requestable', mediaType: 'movie'}]}); });
	expect(global.mockRowProps['Seerr (1)']).toBeTruthy();
	Spotlight.focus.mockClear();
	early(1);
	expect(Spotlight.focus).toHaveBeenCalledWith('search-row-seerr');
	mockSeerr = {isEnabled: false};
});


test('on the Seerr tab each section is a row, and down moves between them by the rows own id', async () => {
	mockSeerr = {isEnabled: true, displayName: 'Seerr', api: {search: async () => ({results: [
		{id: 1, title: 'The Last A', mediaType: 'movie'}, {id: 2, title: 'The Last B', mediaType: 'tv'},
		{id: 3, title: 'Other C', mediaType: 'movie'}, {id: 4, title: 'Other D', mediaType: 'tv'}
	]})}};
	mockSettings = {settings: {}};
	mockApi.search.mockResolvedValue({Items: []});
	const search = createRemoteSearch('phone');
	search.receive({String: 'the last'});
	render(<Search remoteSearch={search} />);
	await act(async () => { jest.advanceTimersByTime(450); });
	await act(async () => { jest.advanceTimersByTime(60); });
	act(() => global.mockTabs.onSelect('seerr'));
	expect(screen.getAllByTestId('row').map((row) => row.getAttribute('data-title'))).toEqual(['Most relevant (4)', 'Movies (2)', 'TV Shows (2)']);
	Spotlight.focus.mockClear();
	global.mockRowProps['Most relevant (4)'].onNavigateDown(0);
	// By position, a row mounted for the tab before it was left could not be found by Spotlight.
	expect(Spotlight.focus).toHaveBeenCalledWith('search-row-movie');
	mockSeerr = {isEnabled: false};
});

describe('the tab a search opens on', () => {
	const searchWithSeerr = async (settings) => {
		mockSeerr = {isEnabled: true, displayName: 'Seerr', api: {search: async () => ({results: [{id: 1, title: 'The Last A', mediaType: 'movie'}]})}};
		mockSettings = {settings};
		mockApi.search.mockResolvedValue({Items: [{Id: 'm1', Type: 'Movie', Name: 'The Last Movie'}]});
		const search = createRemoteSearch('phone');
		search.receive({String: 'the last'});
		render(<Search remoteSearch={search} />);
		await act(async () => { jest.advanceTimersByTime(450); });
		await act(async () => { jest.advanceTimersByTime(60); });
	};
	afterEach(() => { mockSeerr = {isEnabled: false}; mockSettings = {settings: {}}; });

	test('opens on All unless set otherwise', async () => {
		await searchWithSeerr({});
		expect(global.mockTabs.activeId).toBe('all');
	});

	test('opens on Seerr once it has results when set to', async () => {
		await searchWithSeerr({searchDefaultTab: 'seerr'});
		expect(global.mockTabs.activeId).toBe('seerr');
	});

	test('keeps an All the viewer picked themselves while Seerr is still pending', async () => {
		let finishSeerr;
		mockSeerr = {isEnabled: true, displayName: 'Seerr', api: {search: () => new Promise((resolve) => { finishSeerr = resolve; })}};
		mockSettings = {settings: {searchDefaultTab: 'seerr'}};
		mockApi.search.mockResolvedValue({Items: [{Id: 'm1', Type: 'Movie', Name: 'The Last Movie'}]});
		const search = createRemoteSearch('phone');
		search.receive({String: 'the last'});
		render(<Search remoteSearch={search} />);
		await act(async () => { jest.advanceTimersByTime(450); });
		await act(async () => { jest.advanceTimersByTime(60); });
		act(() => global.mockTabs.onSelect('movies'));
		act(() => global.mockTabs.onSelect('all'));
		await act(async () => { finishSeerr({results: [{id: 1, title: 'The Last A', mediaType: 'movie'}]}); });
		expect(global.mockTabs.activeId).toBe('all');
	});

	test('leaves the viewer where they went if they moved to another tab before Seerr answered', async () => {
		let finishSeerr;
		mockSeerr = {isEnabled: true, displayName: 'Seerr', api: {search: () => new Promise((resolve) => { finishSeerr = resolve; })}};
		mockSettings = {settings: {searchDefaultTab: 'seerr'}};
		mockApi.search.mockResolvedValue({Items: [{Id: 'm1', Type: 'Movie', Name: 'The Last Movie'}]});
		const search = createRemoteSearch('phone');
		search.receive({String: 'the last'});
		render(<Search remoteSearch={search} />);
		await act(async () => { jest.advanceTimersByTime(450); });
		await act(async () => { jest.advanceTimersByTime(60); });
		act(() => global.mockTabs.onSelect('movies'));
		await act(async () => { finishSeerr({results: [{id: 1, title: 'The Last A', mediaType: 'movie'}]}); });
		expect(global.mockTabs.activeId).toBe('movies');
	});
});
