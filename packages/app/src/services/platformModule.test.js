jest.mock('../platform', () => ({getPlatform: jest.fn()}));
jest.mock('@moonfin/platform-tizen/storage', () => ({name: 'tizen'}), {virtual: true});
jest.mock('@moonfin/platform-webos/storage', () => ({name: 'webos'}), {virtual: true});
jest.mock('@moonfin/platform-vega/storage', () => ({name: 'vega'}), {virtual: true});

import {getPlatform} from '../platform';
import {resolvePlatformModule} from './platformModule';

describe('resolvePlatformModule', () => {
	test.each(['tizen', 'webos', 'vega'])('loads the %s module', async (platform) => {
		getPlatform.mockReturnValue(platform);
		expect((await resolvePlatformModule('storage')).name).toBe(platform);
	});

	test('a platform it doesnt know gets the webOS module', async () => {
		getPlatform.mockReturnValue('unknown');
		expect((await resolvePlatformModule('storage')).name).toBe('webos');
	});

	test('a module it doesnt know is refused', async () => {
		getPlatform.mockReturnValue('vega');
		await expect(resolvePlatformModule('keyboard')).rejects.toThrow('keyboard');
	});
});
