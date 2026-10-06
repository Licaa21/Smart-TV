jest.mock('../platform', () => ({getPlatform: () => 'tizen'}));

import {registerBlockedKeys} from './blockedKeys';

describe('registerBlockedKeys', () => {
	const supported = ['MediaPlay', 'ChannelUp', 'ChannelDown', 'ChannelList', 'Guide', 'PreviousChannel', 'NetflixKey', 'RakutenTV', 'Menu', 'Source', 'VolumeUp'];
	let registered;

	beforeEach(() => {
		registered = [];
		global.tizen = {tvinputdevice: {
			getSupportedKeys: () => supported.map((name) => ({name})),
			registerKey: (name) => registered.push(name)
		}};
		jest.spyOn(console, 'log').mockImplementation(() => {});
	});
	afterEach(() => { delete global.tizen; jest.restoreAllMocks(); });

	test('takes the channel and guide keys and any streaming service key the TV lists', () => {
		registerBlockedKeys();
		expect(registered.sort()).toEqual(['ChannelDown', 'ChannelList', 'ChannelUp', 'Guide', 'NetflixKey', 'PreviousChannel', 'RakutenTV']);
	});

	test('leaves the system keys alone', () => {
		registerBlockedKeys();
		expect(registered).not.toContain('Menu');
		expect(registered).not.toContain('Source');
		expect(registered).not.toContain('VolumeUp');
	});

	test('does nothing without the Tizen API', () => {
		delete global.tizen;
		expect(() => registerBlockedKeys()).not.toThrow();
	});
});
