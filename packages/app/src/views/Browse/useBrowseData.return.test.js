import {renderHook, waitFor} from '@testing-library/react';

import useBrowseData from './useBrowseData';
import {clearMemoryCache, memoryCache} from './browseCache';

jest.mock('../../services/storage', () => ({
	getFromStorage: async () => null,
	saveToStorage: async () => {},
	removeFromStorage: async () => {}
}));
jest.mock('../../services/connectionPool', () => ({}));
jest.mock('../../services/seerrApi', () => ({}));
jest.mock('../../services/jellyfinApi', () => ({
	HOME_ROW_ITEM_FIELDS: '',
	getServerUrl: () => 'http://server',
	getApiKey: () => 'key',
	getServerType: () => 'jellyfin'
}));
jest.mock('./browseCache', () => {
	const actual = jest.requireActual('./browseCache');
	return {
		...actual,
		loadBrowseCache: jest.fn(async () => null),
		saveBrowseCache: jest.fn(),
		clearBrowseCache: jest.fn(async () => {}),
		cancelPendingCacheSave: jest.fn()
	};
});

const makeApi = () => ({
	getLibraries: jest.fn(async () => ({Items: [{Id: 'lib', Name: 'Movies', CollectionType: 'movies'}]})),
	getResumeItems: jest.fn(async () => ({Items: []})),
	getNextUp: jest.fn(async () => ({Items: []})),
	getItems: jest.fn(async () => ({Items: []})),
	getRandomItems: jest.fn(async () => ({Items: []})),
	getCollectionItems: jest.fn(async () => ({Items: []})),
	getLatest: jest.fn(async () => []),
	getRecentlyReleased: jest.fn(async () => ({Items: []})),
	getUserConfiguration: jest.fn(async () => null)
});

const props = (api, extra = {}, settings = {}) => ({
	api,
	serverUrl: 'http://server',
	accessToken: 'token',
	userId: 'user',
	settings,
	unifiedMode: false,
	seerrEnabled: false,
	seerrAuthenticated: false,
	recommendationsSupported: false,
	getItemServerUrl: () => 'http://server',
	homeRowsConfig: [],
	...extra
});

// The first visit loads everything and leaves the screen kept, as leaving for a title does
const visitAndLeave = async (settings) => {
	const api = makeApi();
	const {result, unmount} = renderHook((p) => useBrowseData(p), {initialProps: props(api, {}, settings)});
	await waitFor(() => expect(result.current.isLoading).toBe(false));
	await waitFor(() => expect(memoryCache.screen).not.toBeNull());
	const rows = result.current.allRowData;
	unmount();
	return rows;
};

beforeEach(() => {
	clearMemoryCache();
	memoryCache.owner = null;
});

describe('returning to the home screen', () => {
	test('comes back with the rows in the first render and loads nothing', async () => {
		const rows = await visitAndLeave();
		expect(rows.length).toBeGreaterThan(0);

		const api = makeApi();
		const {result} = renderHook((p) => useBrowseData(p), {initialProps: props(api, {reuse: true})});
		expect(result.current.isLoading).toBe(false);
		expect(result.current.browseMode).toBe('rows');
		expect(result.current.allRowData).toBe(rows);
		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(api.getLibraries).not.toHaveBeenCalled();
		expect(api.getResumeItems).not.toHaveBeenCalled();
	});

	test('a visit of its own loads again', async () => {
		await visitAndLeave();

		const api = makeApi();
		const {result} = renderHook((p) => useBrowseData(p), {initialProps: props(api)});
		expect(result.current.isLoading).toBe(true);
		await waitFor(() => expect(api.getLibraries).toHaveBeenCalled());
	});

	test('rows loaded for other settings are not taken back', async () => {
		await visitAndLeave({displayFavoritesRows: false});

		const api = makeApi();
		const {result} = renderHook((p) => useBrowseData(p), {initialProps: props(api, {reuse: true}, {displayFavoritesRows: true})});
		expect(result.current.isLoading).toBe(true);
		await waitFor(() => expect(api.getLibraries).toHaveBeenCalled());
	});

	test('another account does not take the rows', async () => {
		await visitAndLeave();

		const api = makeApi();
		const {result} = renderHook((p) => useBrowseData(p), {initialProps: props(api, {reuse: true, userId: 'someone-else', accessToken: 'other'})});
		expect(result.current.isLoading).toBe(true);
		await waitFor(() => expect(api.getLibraries).toHaveBeenCalled());
	});

	test('a favorite or playlist change while away drops the kept screen', async () => {
		await visitAndLeave();
		expect(memoryCache.screen).not.toBeNull();
		window.dispatchEvent(new window.CustomEvent('moonfin:homeRowsChanged'));
		expect(memoryCache.screen).toBeNull();
	});

	test('hiding a library or changing the media bar while away drops the kept screen', async () => {
		await visitAndLeave();
		window.dispatchEvent(new window.CustomEvent('moonfin:browseRefresh', {detail: {libraries: true}}));
		expect(memoryCache.screen).toBeNull();

		await visitAndLeave();
		window.dispatchEvent(new window.CustomEvent('moonfin:browseRefresh', {detail: {featured: true}}));
		expect(memoryCache.screen).toBeNull();
	});

	test('playback ending while away keeps the screen and marks the volatile rows stale', async () => {
		await visitAndLeave();
		window.dispatchEvent(new window.CustomEvent('moonfin:browseRefresh'));
		expect(memoryCache.screen).not.toBeNull();
		expect(memoryCache.volatileStale).toBe(true);
	});

	test('a change made while the home screen is up is not kept by the next refresh', async () => {
		const api = makeApi();
		const {result, unmount} = renderHook((p) => useBrowseData(p), {initialProps: props(api)});
		await waitFor(() => expect(memoryCache.screen).not.toBeNull());

		window.dispatchEvent(new window.CustomEvent('moonfin:homeRowsChanged'));
		expect(memoryCache.screen).toBeNull();
		window.dispatchEvent(new window.CustomEvent('moonfin:browseRefresh'));
		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(memoryCache.screen).toBeNull();
		unmount();
	});
});
