// The update check watches the fork's own releases, tagged fork-v<x.y.z>, against the fork's version stamped into the package.

jest.mock('../platform', () => ({isTizen: () => true, isVega: () => false, isWebOS: () => false, isXbox: () => false}));
jest.mock('./storage', () => ({getFromStorage: jest.fn(async () => null), saveToStorage: jest.fn(async () => {})}));

const load = (forkVersion) => {
	if (forkVersion) process.env.REACT_APP_FORK_VERSION = forkVersion;
	else delete process.env.REACT_APP_FORK_VERSION;
	let mod;
	jest.isolateModules(() => { mod = require('./versionChecker'); });
	return mod;
};

const release = (tag, extra = {}) => ({tag_name: tag, draft: false, prerelease: false, assets: [{name: 'Moonfin_Tizen_Regular_v2.10.0_Lica_Fork_v' + tag.replace('fork-v', '') + '.wgt'}], ...extra});

describe('versionChecker for the fork', () => {
	afterEach(() => {
		delete process.env.REACT_APP_FORK_VERSION;
		delete global.fetch;
	});

	test('a newer fork release is an update, read from its fork-v tag', async () => {
		global.fetch = jest.fn(async () => ({ok: true, json: async () => [release('fork-v1.1.3'), release('fork-v1.1.2')]}));
		const result = await load('1.1.2').checkForUpdatesDetailed();
		expect(result).toEqual({status: 'update', currentVersion: '1.1.2', latestVersion: '1.1.3'});
		expect(global.fetch.mock.calls[0][0]).toContain('repos/Licaa21/Smart-TV/releases');
	});

	test('the same release is current', async () => {
		global.fetch = jest.fn(async () => ({ok: true, json: async () => [release('fork-v1.1.2')]}));
		expect((await load('1.1.2').checkForUpdatesDetailed()).status).toBe('current');
	});

	test('a release without a package for the set is passed over', async () => {
		global.fetch = jest.fn(async () => ({ok: true, json: async () => [release('fork-v1.2.0', {assets: []}), release('fork-v1.1.2')]}));
		expect((await load('1.1.2').checkForUpdatesDetailed()).status).toBe('current');
	});

	test('a check the viewer asked for shows an update whose notice was dismissed, the launch check does not', async () => {
		const {getFromStorage} = require('./storage');
		getFromStorage.mockImplementation(async (key) => (key === 'version_dismissed' ? '1.1.3' : null));
		global.fetch = jest.fn(async () => ({ok: true, json: async () => [release('fork-v1.1.3', {body: 'What changed'})]}));
		const {checkForUpdates} = load('1.1.2');
		expect(await checkForUpdates()).toBeNull();
		expect((await checkForUpdates(true)).releaseNotes).toBe('What changed');
		getFromStorage.mockImplementation(async () => null);
	});

	test('settings shows the fork version after Moonfin\'s, and only Moonfin\'s where there is none', () => {
		process.env.REACT_APP_VERSION = '2.10.0';
		expect(load('1.1.2').getDisplayVersion()).toBe('2.10.0 (Lica\'s Fork 1.1.2)');
		expect(load().getDisplayVersion()).toBe('2.10.0');
	});
});
