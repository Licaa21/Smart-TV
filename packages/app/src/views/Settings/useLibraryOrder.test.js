import {act, renderHook} from '@testing-library/react';

import connectionPool from '../../services/connectionPool';
import {resetLibraryScope} from '../../services/libraryScope';
import useLibraryOrder from './useLibraryOrder';

jest.mock('../../services/connectionPool', () => ({
	__esModule: true,
	default: {
		getAllLibrariesFromAllServers: jest.fn(),
		getUserConfigFromAllServers: jest.fn(),
		updateUserConfigOnServer: jest.fn()
	}
}));
jest.mock('../../services/libraryScope', () => ({resetLibraryScope: jest.fn()}));

const MOVIES = {Id: 'movies', Name: 'Movies', CollectionType: 'movies'};
const SHOWS = {Id: 'shows', Name: 'Shows', CollectionType: 'tvshows'};
const MUSIC = {Id: 'music', Name: 'Music', CollectionType: 'music'};

// A server whose configuration other apps keep changing underneath the screen.
let configuration;
let api;

const elapse = (ms) => act(async () => {
	await jest.advanceTimersByTimeAsync(ms);
});

const open = async (options = {}) => {
	const onLibrariesChanged = jest.fn();
	const view = renderHook(() => useLibraryOrder({api, unified: false, onLibrariesChanged, ...options}));
	await elapse(0);
	return {...view, onLibrariesChanged};
};

const names = (result) => result.current.libraries.map((library) => library.Id);
const writes = () => api.updateUserConfiguration.mock.calls.map(([config]) => config.OrderedViews);

beforeEach(() => {
	jest.useFakeTimers();
	jest.clearAllMocks();
	configuration = {MyMediaExcludes: ['music'], OrderedViews: [], SubtitleLanguagePreference: 'eng'};
	api = {
		getAllLibraries: jest.fn(async () => ({Items: [MOVIES, SHOWS, MUSIC]})),
		getUserConfiguration: jest.fn(async () => ({Configuration: {...configuration}})),
		updateUserConfiguration: jest.fn(async (config) => { configuration = config; })
	};
});

afterEach(() => jest.useRealTimers());

describe('the library order', () => {
	test('shows the libraries in server order and knows which are hidden', async () => {
		const {result} = await open();
		expect(names(result)).toEqual(['movies', 'shows', 'music']);
		expect([...result.current.hidden]).toEqual(['music']);
	});

	test('right and left move a library and the move is saved and shown', async () => {
		const refreshes = [];
		const onRefresh = (e) => refreshes.push(e.detail);
		window.addEventListener('moonfin:browseRefresh', onRefresh);
		const {result, onLibrariesChanged} = await open();
		act(() => { result.current.move(0, 1); });
		expect(names(result)).toEqual(['shows', 'movies', 'music']);
		await elapse(600);
		window.removeEventListener('moonfin:browseRefresh', onRefresh);
		expect(writes()).toEqual([['shows', 'movies', 'music']]);
		expect(resetLibraryScope).toHaveBeenCalled();
		expect(onLibrariesChanged).toHaveBeenCalled();
		expect(refreshes).toEqual([{libraries: true}]);
	});

	test('a run of presses goes out as one write', async () => {
		const {result} = await open();
		act(() => { result.current.move(0, 1); });
		await elapse(300);
		act(() => { result.current.move(1, 2); });
		await elapse(599);
		expect(writes()).toEqual([]);
		await elapse(1);
		expect(writes()).toEqual([['shows', 'music', 'movies']]);
	});

	test('each save starts from the configuration as it is now', async () => {
		const {result} = await open();
		configuration = {...configuration, SubtitleLanguagePreference: 'spa'};
		act(() => { result.current.move(2, 1); });
		await elapse(600);
		expect(api.updateUserConfiguration).toHaveBeenCalledWith(expect.objectContaining({
			SubtitleLanguagePreference: 'spa',
			MyMediaExcludes: ['music'],
			OrderedViews: ['movies', 'music', 'shows']
		}));
	});

	test('a move made just before leaving is still saved', async () => {
		const {result, unmount} = await open();
		act(() => { result.current.move(0, 1); });
		unmount();
		await elapse(0);
		expect(writes()).toEqual([['shows', 'movies', 'music']]);
	});

	test('a write the server refuses puts the old order back', async () => {
		const {result} = await open();
		api.updateUserConfiguration.mockRejectedValueOnce(new Error('401'));
		act(() => { result.current.move(0, 1); });
		await elapse(600);
		expect(names(result)).toEqual(['movies', 'shows', 'music']);
		expect(result.current.saveFailures).toBe(1);
	});

	test('a library cant be moved past the end of the list', async () => {
		const {result} = await open();
		let moved;
		act(() => { moved = result.current.move(2, 3); });
		expect(moved).toBe(false);
		await elapse(600);
		expect(writes()).toEqual([]);
	});

	test('a list that fails to load can be tried again', async () => {
		api.getAllLibraries.mockRejectedValueOnce(new Error('offline'));
		const {result} = await open();
		expect(result.current.loadFailed).toBe(true);
		await act(async () => { await result.current.retry(); });
		expect(result.current.loadFailed).toBe(false);
		expect(names(result)).toEqual(['movies', 'shows', 'music']);
	});
});

describe('the library order across servers', () => {
	const serverA = {serverUrl: 'http://a', accessToken: 'ta', userId: 'ua', serverType: 'jellyfin', configuration: {MyMediaExcludes: [], OrderedViews: []}};
	const serverB = {serverUrl: 'http://b', accessToken: 'tb', userId: 'ub', serverType: 'emby', configuration: {MyMediaExcludes: ['b2'], OrderedViews: []}};
	const tagged = (Id, server) => ({Id, Name: Id, _serverUrl: server.serverUrl, _serverName: server.serverUrl});

	beforeEach(() => {
		connectionPool.getAllLibrariesFromAllServers.mockResolvedValue([
			tagged('a1', serverA), tagged('a2', serverA), tagged('b1', serverB), tagged('b2', serverB)
		]);
		connectionPool.getUserConfigFromAllServers.mockResolvedValue([serverA, serverB]);
		connectionPool.updateUserConfigOnServer.mockResolvedValue(null);
	});

	test('each server is sent its own libraries in their new order', async () => {
		const {result} = await open({unified: true});
		expect([...result.current.hidden]).toEqual(['b2']);
		act(() => { result.current.move(2, 3); });
		await elapse(600);
		expect(connectionPool.updateUserConfigOnServer.mock.calls).toEqual([
			['http://a', 'ta', 'ua', {MyMediaExcludes: [], OrderedViews: ['a1', 'a2']}, 'jellyfin'],
			['http://b', 'tb', 'ub', {MyMediaExcludes: ['b2'], OrderedViews: ['b2', 'b1']}, 'emby']
		]);
	});

	test('a library stops at the edge of its server\'s libraries', async () => {
		const {result} = await open({unified: true});
		let moved;
		act(() => { moved = result.current.move(1, 2); });
		expect(moved).toBe(false);
	});

	test('a server that cant be read fails the save and keeps the old order', async () => {
		const {result} = await open({unified: true});
		connectionPool.getUserConfigFromAllServers.mockResolvedValueOnce([serverA]);
		act(() => { result.current.move(0, 1); });
		await elapse(600);
		expect(connectionPool.updateUserConfigOnServer).not.toHaveBeenCalled();
		expect(names(result)).toEqual(['a1', 'a2', 'b1', 'b2']);
		expect(result.current.saveFailures).toBe(1);
	});
});
