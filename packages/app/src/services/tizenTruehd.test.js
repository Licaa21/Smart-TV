import {clearCapabilitiesCache, getDeviceCapabilities, getJellyfinDeviceProfile} from '../../../platform-tizen/src/deviceProfile';

const OPT_IN_KEY = 'moonfin.experimentalTruehd';

// A set that answers yes when asked whether it takes TrueHD, which is all most of them say
const reportTruehd = () => {
	global.webapis = {systeminfo: {isSupportedAudioCodec: (codec) => codec === 'TrueHD'}};
};

const videoAudioCodecs = (profile) => profile.DirectPlayProfiles
	.filter((p) => p.Type === 'Video')
	.map((p) => p.AudioCodec)
	.join(',');

describe('Experimental TrueHD on Tizen', () => {
	beforeEach(() => {
		reportTruehd();
		window.localStorage.removeItem(OPT_IN_KEY);
		clearCapabilitiesCache();
	});

	afterEach(() => {
		delete global.webapis;
		window.localStorage.removeItem(OPT_IN_KEY);
		clearCapabilitiesCache();
	});

	test('a set that reports TrueHD still leaves it to the server until the viewer opts in', async () => {
		expect((await getDeviceCapabilities()).truehd).toBe(false);
		const profile = await getJellyfinDeviceProfile();
		expect(videoAudioCodecs(profile)).not.toContain('truehd');
		expect(profile.CodecProfiles.some((p) => /truehd/.test(p.Codec || ''))).toBe(true);
	});

	test('opting in offers it for direct play', async () => {
		window.localStorage.setItem(OPT_IN_KEY, 'true');
		expect((await getDeviceCapabilities()).truehd).toBe(true);
		expect(videoAudioCodecs(await getJellyfinDeviceProfile())).toContain('truehd');
	});

	test('the opt-in takes effect once the cache is cleared, without a restart', async () => {
		expect((await getDeviceCapabilities()).truehd).toBe(false);
		window.localStorage.setItem(OPT_IN_KEY, 'true');
		clearCapabilitiesCache();
		expect((await getDeviceCapabilities()).truehd).toBe(true);
	});

	test('the answer the set gave is kept for the info panel either way', async () => {
		expect((await getDeviceCapabilities()).truehdCodecSupported).toBe(true);
		global.webapis = {systeminfo: {isSupportedAudioCodec: () => false}};
		clearCapabilitiesCache();
		expect((await getDeviceCapabilities()).truehdCodecSupported).toBe(false);
	});

	test('a set that says no gets nothing from the opt-in', async () => {
		global.webapis = {systeminfo: {isSupportedAudioCodec: () => false}};
		window.localStorage.setItem(OPT_IN_KEY, 'true');
		expect((await getDeviceCapabilities()).truehd).toBe(false);
	});
});
