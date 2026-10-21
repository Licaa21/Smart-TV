import {clearCapabilitiesCache, getJellyfinDeviceProfile} from '../../../platform-webos/src/deviceProfile';

let mockPanel;

jest.mock('@enact/webos/deviceinfo', () => ({
	__esModule: true,
	default: (callback) => callback({sdkVersion: '6.0.0'})
}));

jest.mock('@enact/webos/LS2Request', () => ({
	__esModule: true,
	default: class {
		send ({method, onSuccess}) {
			if (method === 'getConfigs') onSuccess({configs: {'tv.hw.panelResolution': mockPanel}});
			else if (method === 'getSystemSettings') onSuccess({settings: {soundOutput: 'tv_speaker'}});
			else onSuccess({});
		}
	}
}));

const answerHevcLevels = (levels) => {
	jest.spyOn(window.HTMLMediaElement.prototype, 'canPlayType').mockImplementation((type) => {
		const level = /\.L(\d+)"/.exec(type)?.[1];
		return level && levels.includes(level) ? 'probably' : '';
	});
};

const hevcLevels = (profile) => profile.CodecProfiles
	.filter((p) => ['hevc', 'dvh1', 'dvhe'].includes(p.Codec))
	.map((p) => p.Conditions.find((c) => c.Property === 'VideoLevel').Value);

describe('HEVC level on webOS', () => {
	beforeEach(() => {
		mockPanel = 'UD';
		clearCapabilitiesCache();
	});

	test('a 4K set that says it decodes Level 6.1 takes files tagged above 5.1', async () => {
		answerHevcLevels(['153', '183']);
		expect(hevcLevels(await getJellyfinDeviceProfile())).toEqual(['183', '183', '183']);
	});

	test('a 4K set that says no keeps the Level 5.1 LG lists', async () => {
		answerHevcLevels(['153']);
		expect(hevcLevels(await getJellyfinDeviceProfile())).toEqual(['153', '153', '153']);
	});

	test('a 1080p set stays at Level 4.1 whatever it answers', async () => {
		mockPanel = 'FHD';
		answerHevcLevels(['153', '183']);
		expect(hevcLevels(await getJellyfinDeviceProfile())).toEqual(['123', '123']);
	});
});
