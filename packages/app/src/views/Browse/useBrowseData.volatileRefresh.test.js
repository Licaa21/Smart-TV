import {renderHook, waitFor} from '@testing-library/react';

import useBrowseData from './useBrowseData';
import {clearMemoryCache, loadBrowseCache, memoryCache} from './browseCache';

jest.mock('../../services/storage', () => ({
	getFromStorage: async () => null,
	saveToStorage: async () => {},
	removeFromStorage: async () => {}
}));
jest.mock('../../services/connectionPool', () => ({}));
jest.mock('../../services/seerrApi', () => ({}));
jest.mock('../../context/SettingsContext', () => ({activeSyncProfile: () => 'tv'}));
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
		loadBrowseCache: jest.fn(),
		saveBrowseCache: jest.fn(),
		clearBrowseCache: jest.fn(async () => {}),
		cancelPendingCacheSave: jest.fn()
	};
});

const empty = async () => ({Items: []});
const getResumeItems = jest.fn();
const api = {
	getLibraries: empty,
	getResumeItems,
	getNextUp: empty,
	getItems: empty,
	getRandomItems: empty,
	getCollectionItems: empty,
	getUserConfiguration: async () => null
};

const props = (accessToken, userId) => ({
	api,
	serverUrl: 'http://server',
	accessToken,
	userId,
	settings: {},
	unifiedMode: false,
	seerrEnabled: false,
	seerrAuthenticated: false,
	recommendationsSupported: false,
	getItemServerUrl: () => 'http://server',
	homeRowsConfig: []
});

const cacheAged = (minutes) => ({
	serverUrl: 'http://server',
	userId: 'user-a',
	rowData: [
		{id: 'resume', title: 'Continue Watching', items: [{Id: 'item'}]},
		{id: 'latest-lib', title: 'Recently Added', items: [{Id: 'new'}]}
	],
	libraries: [{Id: 'lib'}],
	featuredItems: [{Id: 'featured'}],
	timestamp: Date.now() - minutes * 60000
});

const loaded = async (minutes) => {
	loadBrowseCache.mockImplementation(async () => cacheAged(minutes));
	const {result} = renderHook((p) => useBrowseData(p), {initialProps: props('token-a', 'user-a')});
	await waitFor(() => expect(result.current.allRowData.length).toBeGreaterThan(0));
	return result;
};

beforeEach(() => {
	clearMemoryCache();
	memoryCache.owner = null;
	loadBrowseCache.mockReset();
	getResumeItems.mockImplementation(empty);
});

afterEach(() => jest.restoreAllMocks());

describe('refreshing Continue Watching and Next Up', () => {
	test("rows the load just refreshed aren't fetched again when Home first shows", async () => {
		const result = await loaded(10);
		await waitFor(() => expect(getResumeItems).toHaveBeenCalledTimes(1));
		await result.current.refreshVolatileData(true);
		expect(getResumeItems).toHaveBeenCalledTimes(1);
	});

	test('rows served from a fresh cache are still refreshed when Home first shows', async () => {
		const result = await loaded(1);
		expect(getResumeItems).not.toHaveBeenCalled();
		await result.current.refreshVolatileData(true);
		expect(getResumeItems).toHaveBeenCalledTimes(1);
	});

	test('a show well after the load refreshes them again', async () => {
		const result = await loaded(10);
		await waitFor(() => expect(getResumeItems).toHaveBeenCalledTimes(1));
		const later = Date.now() + 15000;
		jest.spyOn(Date, 'now').mockImplementation(() => later);
		await result.current.refreshVolatileData(true);
		expect(getResumeItems).toHaveBeenCalledTimes(2);
	});
});
