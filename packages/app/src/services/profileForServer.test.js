import {profileForServer} from './profileForServer';

jest.mock('./storage', () => ({getFromStorage: jest.fn(), saveToStorage: jest.fn()}));

const oldTizenProfile = () => ({
	Name: 'Moonfin Tizen 5',
	ContainerProfiles: [
		{Type: 'Video', Conditions: [{Condition: 'LessThanEqual', Property: 'NumStreams', Value: '32', IsRequired: false}]},
		{Type: 'Video', Conditions: [{Condition: 'LessThanEqual', Property: 'Width', Value: '3840', IsRequired: false}]}
	]
});

const serverAt = (serverUrl, version) => ({
	getServerInfo: () => ({serverUrl}),
	getPublicInfo: jest.fn(() => (version ? Promise.resolve({Version: version}) : Promise.reject(new Error('offline'))))
});

const propertiesOf = (profile) => profile.ContainerProfiles.flatMap((p) => p.Conditions.map((c) => c.Property));

test('Jellyfin 10.10 gets the profile without NumStreams', async () => {
	const profile = await profileForServer(oldTizenProfile(), 'jellyfin', serverAt('http://jf1010', '10.10.7'));
	expect(propertiesOf(profile)).toEqual(['Width']);
});

test('Jellyfin 10.11 and 12 keep NumStreams', async () => {
	expect(propertiesOf(await profileForServer(oldTizenProfile(), 'jellyfin', serverAt('http://jf1011', '10.11.0')))).toEqual(['NumStreams', 'Width']);
	expect(propertiesOf(await profileForServer(oldTizenProfile(), 'jellyfin', serverAt('http://jf12', '12.1.0')))).toEqual(['NumStreams', 'Width']);
});

test('Emby keeps NumStreams without being asked for its version', async () => {
	const server = serverAt('http://emby', '4.9.5.0');
	expect(propertiesOf(await profileForServer(oldTizenProfile(), 'emby', server))).toEqual(['NumStreams', 'Width']);
	expect(server.getPublicInfo).not.toHaveBeenCalled();
});

test('a server that cant be asked is treated as older', async () => {
	expect(propertiesOf(await profileForServer(oldTizenProfile(), 'jellyfin', serverAt('http://offline', null)))).toEqual(['Width']);
	expect(propertiesOf(await profileForServer(oldTizenProfile(), 'jellyfin', null))).toEqual(['Width']);
});

test('each server is asked for its version once', async () => {
	const server = serverAt('http://jf-once', '10.11.10');
	await profileForServer(oldTizenProfile(), 'jellyfin', server);
	await profileForServer(oldTizenProfile(), 'jellyfin', server);
	expect(server.getPublicInfo).toHaveBeenCalledTimes(1);
});

test('a profile without NumStreams goes out untouched and nothing is asked', async () => {
	const profile = {Name: 'Moonfin Tizen 8', ContainerProfiles: []};
	const server = serverAt('http://jf-new-set', '10.10.7');
	expect(await profileForServer(profile, 'jellyfin', server)).toBe(profile);
	expect(server.getPublicInfo).not.toHaveBeenCalled();
});
