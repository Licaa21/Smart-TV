import {getLatestPerLibraryFromAllServers} from './connectionPool';
import {createApiForServer} from './jellyfinApi';
import * as multiServerManager from './multiServerManager';

jest.mock('./multiServerManager', () => ({getAllServersArray: jest.fn()}));
jest.mock('./jellyfinApi', () => ({createApiForServer: jest.fn()}));
jest.mock('./parentalControls', () => ({withoutBlockedItems: (items) => items}));

const server = (name, url) => ({serverId: name, name, url, userId: 'u', accessToken: 't', serverType: 'jellyfin'});

describe('the latest rows across servers', () => {
	test('keep each server\'s own library order, servers by name', async () => {
		multiServerManager.getAllServersArray.mockResolvedValue([server('Zeta', 'http://z'), server('Alpha', 'http://a')]);
		const librariesFor = {
			'http://a': [{Id: 'a-shows', Name: 'Shows'}, {Id: 'a-movies', Name: 'Movies'}],
			'http://z': [{Id: 'z-music', Name: 'Music'}, {Id: 'z-anime', Name: 'Anime'}]
		};
		createApiForServer.mockImplementation((url) => ({
			getLibraries: async () => ({Items: librariesFor[url]}),
			getLatestMedia: async (libraryId) => [{Id: `${libraryId}-item`}]
		}));
		const results = await getLatestPerLibraryFromAllServers();
		expect(results.map((result) => result.lib.Id)).toEqual(['a-shows', 'a-movies', 'z-music', 'z-anime']);
	});
});
