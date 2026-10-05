import {act, renderHook} from '@testing-library/react';

import connectionPool from '../../services/connectionPool';
import useLibraryVisibility from './useLibraryVisibility';

jest.mock('../../services/connectionPool', () => ({
	__esModule: true,
	default: {
		getAllLibrariesFromAllServers: jest.fn(),
		getUserConfigFromAllServers: jest.fn(),
		updateUserConfigOnServer: jest.fn()
	}
}));
jest.mock('../../services/libraryScope', () => ({resetLibraryScope: jest.fn()}));

const jellyfin = {serverUrl: 'http://jf', accessToken: 'tj', userId: 'uj', serverType: 'jellyfin', configuration: {MyMediaExcludes: []}};
const emby = {serverUrl: 'http://emby', accessToken: 'te', userId: 'ue', serverType: 'emby', configuration: {MyMediaExcludes: []}};

const setup = (over = {}) => renderHook(() => useLibraryVisibility({
	api: over.api,
	settings: {unifiedLibraryMode: !over.api},
	hasMultipleServers: !over.api,
	pushView: jest.fn(),
	popView: jest.fn(),
	onLibrariesChanged: jest.fn()
}));

let refreshes;
const onRefresh = (e) => refreshes.push(e.detail);

beforeEach(() => {
	jest.clearAllMocks();
	refreshes = [];
	window.addEventListener('moonfin:browseRefresh', onRefresh);
	connectionPool.getAllLibrariesFromAllServers.mockResolvedValue([
		{Id: 'j1', CollectionType: 'movies', _serverUrl: 'http://jf'},
		{Id: 'e1', CollectionType: 'movies', _serverUrl: 'http://emby'}
	]);
	connectionPool.getUserConfigFromAllServers.mockResolvedValue([jellyfin, emby]);
	connectionPool.updateUserConfigOnServer.mockResolvedValue(null);
});

afterEach(() => window.removeEventListener('moonfin:browseRefresh', onRefresh));

describe('saving library visibility', () => {
	test('each server is written on its own route and Home loads again', async () => {
		const {result} = setup();
		await act(async () => { await result.current.openLibraries(); });
		act(() => result.current.toggleLibraryVisibility('e1'));
		await act(async () => { await result.current.saveLibraryVisibility(); });
		expect(connectionPool.updateUserConfigOnServer.mock.calls).toEqual([
			['http://jf', 'tj', 'uj', {MyMediaExcludes: []}, 'jellyfin'],
			['http://emby', 'te', 'ue', {MyMediaExcludes: ['e1']}, 'emby']
		]);
		expect(refreshes).toEqual([{featured: true, libraries: true}]);
	});

	test('a single server saves through its own api and Home loads again', async () => {
		const api = {
			getAllLibraries: jest.fn(async () => ({Items: [{Id: 'm', CollectionType: 'movies'}]})),
			getUserConfiguration: jest.fn(async () => ({Configuration: {MyMediaExcludes: []}})),
			updateUserConfiguration: jest.fn(async () => null)
		};
		const {result} = setup({api});
		await act(async () => { await result.current.openLibraries(); });
		act(() => result.current.toggleLibraryVisibility('m'));
		await act(async () => { await result.current.saveLibraryVisibility(); });
		expect(api.updateUserConfiguration).toHaveBeenCalledWith({MyMediaExcludes: ['m']});
		expect(refreshes).toEqual([{featured: true, libraries: true}]);
	});
});
