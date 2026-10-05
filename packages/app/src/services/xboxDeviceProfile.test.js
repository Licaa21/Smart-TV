import {clearCapabilitiesCache, detectXboxVersion, getDeviceCapabilities, getDeviceName, getJellyfinDeviceProfile} from '../../../platform-xbox/src/deviceProfile';
import {getPlayMethod} from '../../../platform-xbox/src/video';

// Chromium with the HEVC decoder present
const canPlayType = (type) => (/hvc1|avc1|mp4a|flac/.test(type) ? 'probably' : '');

const boot = (over = {}) => ({
	v: 1,
	os: {name: 'Windows.Xbox', version: '10.0.26100.5000'},
	device: {form: 'Xbox One S'},
	display: {width: 3840, height: 2160, hdr: ['hdr10'], modes: []},
	protection: {hevc: true, uhd: true, uhdHdr: true, hdcp22: true},
	webview: {version: '140.0.3485.54'},
	ip: '192.168.50.140',
	...over
});

const source = (over = {}) => ({
	Container: 'mkv',
	SupportsDirectPlay: true,
	SupportsDirectStream: true,
	MediaStreams: [
		{Type: 'Video', Codec: 'h264', VideoRangeType: 'SDR', Width: 1920, BitRate: 12_000_000},
		{Type: 'Audio', Codec: 'aac', Index: 1}
	],
	...over
});

const video = (over) => source({MediaStreams: [{Type: 'Video', Codec: 'h264', VideoRangeType: 'SDR', Width: 1920, ...over}, {Type: 'Audio', Codec: 'aac', Index: 1}]});

const capabilitiesFor = async (bootData) => {
	if (bootData) window.__MOONFIN_XBOX__ = bootData;
	else delete window.__MOONFIN_XBOX__;
	clearCapabilitiesCache();
	return getDeviceCapabilities();
};

// The suite resets mocks between tests, so the probes are stood in for each time
beforeEach(() => {
	jest.spyOn(window.HTMLMediaElement.prototype, 'canPlayType').mockImplementation(canPlayType);
	jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(() => {
	delete window.__MOONFIN_XBOX__;
});

describe('the Xbox device profile', () => {
	test('without the host it stays at 1080p H.264', async () => {
		const capabilities = await capabilitiesFor(null);
		expect(capabilities).toMatchObject({modelName: 'Xbox', xboxVersionDisplay: 'Xbox OS', hevc: false, uhd: false, hdr10: false, ac3: false});
		const profile = await getJellyfinDeviceProfile();
		expect(profile.DirectPlayProfiles.find((entry) => entry.Container === 'mp4,m4v')).toMatchObject({VideoCodec: 'h264', AudioCodec: 'aac,mp3,flac'});
		expect(profile.DirectPlayProfiles.find((entry) => entry.Container === 'mkv').AudioCodec).toBe('aac,mp3,flac,pcm_s16le,pcm_s24le');
		expect(profile.DirectPlayProfiles.some((entry) => entry.Container === 'ogg')).toBe(false);
		expect(profile.CodecProfiles.find((entry) => entry.Codec === 'h264').Conditions[2].Value).toBe('42');
	});

	test('reads the console and its OS from the host', async () => {
		const capabilities = await capabilitiesFor(boot());
		expect(capabilities).toMatchObject({modelName: 'Xbox One S', xboxVersionDisplay: 'Xbox OS 10.0.26100.5000'});
		expect(detectXboxVersion()).toBe('10.0.26100.5000');
		expect(await getDeviceName()).toBe('Xbox One S');
	});

	test('offers HEVC and 4K only when the WebView and the console both say so', async () => {
		expect(await capabilitiesFor(boot())).toMatchObject({hevc: true, uhd: true});
		expect(await capabilitiesFor(boot({protection: {hevc: true, uhd: false}}))).toMatchObject({hevc: true, uhd: false});
		expect(await capabilitiesFor(boot({protection: {hevc: false, uhd: true}}))).toMatchObject({hevc: false, uhd: false});
		expect(await capabilitiesFor(boot({protection: {hevc: null, uhd: null}}))).toMatchObject({hevc: false, uhd: false});

		window.HTMLMediaElement.prototype.canPlayType.mockImplementation((type) => (/hvc1/.test(type) ? '' : canPlayType(type)));
		expect(await capabilitiesFor(boot())).toMatchObject({hevc: false, uhd: false});
		window.HTMLMediaElement.prototype.canPlayType.mockImplementation(canPlayType);
	});

	test('offers the sound formats the WebView says it plays, and never DTS', async () => {
		window.HTMLMediaElement.prototype.canPlayType.mockImplementation((type) => (/ac-3|ec-3|opus|vorbis|dtsc/.test(type) ? 'probably' : canPlayType(type)));
		const capabilities = await capabilitiesFor(boot());
		expect(capabilities).toMatchObject({ac3: true, eac3: true, opus: true, vorbis: true, dts: false});

		const profile = await getJellyfinDeviceProfile();
		expect(profile.DirectPlayProfiles.find((entry) => entry.Container === 'mp4,m4v').AudioCodec).toBe('aac,mp3,flac,ac3,eac3,opus');
		expect(profile.DirectPlayProfiles.find((entry) => entry.Container === 'mkv').AudioCodec).toBe('aac,mp3,flac,ac3,eac3,opus,vorbis,pcm_s16le,pcm_s24le');
		expect(profile.DirectPlayProfiles.find((entry) => entry.Container === 'mov').AudioCodec).toBe('aac');
		expect(profile.DirectPlayProfiles.some((entry) => entry.Container === 'ogg' && entry.Type === 'Audio')).toBe(true);
		expect(JSON.stringify(profile.DirectPlayProfiles)).not.toMatch(/dts|dca|truehd/);

		const withSound = (codec) => source({MediaStreams: [{Type: 'Video', Codec: 'h264', Width: 1920}, {Type: 'Audio', Codec: codec, Index: 1}]});
		expect(getPlayMethod(withSound('eac3'), capabilities)).toBe('DirectPlay');
		expect(getPlayMethod(withSound('vorbis'), capabilities)).toBe('DirectPlay');
		expect(getPlayMethod(withSound('dts'), capabilities)).toBe('Transcode');
		expect(getPlayMethod(withSound('truehd'), capabilities)).toBe('Transcode');
	});

	test('holds HDR back whatever the display says, and the sound formats the WebView turns down', async () => {
		await capabilitiesFor(boot());
		const profile = await getJellyfinDeviceProfile();
		const mp4 = profile.DirectPlayProfiles.find((entry) => entry.Container === 'mp4,m4v');
		expect(mp4.VideoCodec).toBe('h264,hevc');
		expect(mp4.AudioCodec).toBe('aac,mp3,flac');
		expect(profile.CodecProfiles.find((entry) => entry.Codec === 'hevc').Conditions[1].Value).toBe('SDR');
		expect(profile.CodecProfiles.find((entry) => entry.Codec === 'hevc').Conditions[2].Value).toBe('153');
		expect(profile.DirectPlayProfiles.some((entry) => /(^|,)(ts|webm)(,|$)/.test(entry.Container))).toBe(false);
	});

	test('every transcode is H.264 and stereo AAC over HLS', async () => {
		await capabilitiesFor(boot());
		const profile = await getJellyfinDeviceProfile();
		expect(profile.TranscodingProfiles[0]).toMatchObject({Protocol: 'hls', Container: 'ts', VideoCodec: 'h264', AudioCodec: 'aac', MaxAudioChannels: '2'});
		expect(profile.TranscodingProfiles.some((entry) => /hevc/.test(entry.VideoCodec || ''))).toBe(false);
	});
});

describe('the Xbox play method', () => {
	let full;
	let bare;

	beforeEach(async () => {
		full = {...await capabilitiesFor(boot())};
		bare = {...await capabilitiesFor(null)};
	});

	test('plays 1080p H.264 with AAC as it is on any console', () => {
		expect(getPlayMethod(source(), bare)).toBe('DirectPlay');
		expect(getPlayMethod(source({Container: 'mp4'}), bare)).toBe('DirectPlay');
	});

	test('transcodes what isnt offered', () => {
		expect(getPlayMethod(video({Codec: 'hevc'}), bare)).toBe('Transcode');
		expect(getPlayMethod(video({Width: 3840}), bare)).toBe('Transcode');
		expect(getPlayMethod(video({Codec: 'vp9'}), full)).toBe('Transcode');
		expect(getPlayMethod(video({Codec: 'hevc', VideoRangeType: 'HDR10'}), full)).toBe('Transcode');
		expect(getPlayMethod(video({Codec: 'hevc', VideoRangeType: 'DOVIWithHDR10'}), full)).toBe('Transcode');
		expect(getPlayMethod(source({Container: 'ts'}), full)).toBe('Transcode');
		expect(getPlayMethod(source({MediaStreams: [{Type: 'Video', Codec: 'h264', Width: 1920}, {Type: 'Audio', Codec: 'eac3', Index: 1}]}), full)).toBe('Transcode');
	});

	test('plays SDR HEVC and 4K where the console reported them', () => {
		expect(getPlayMethod(video({Codec: 'hevc'}), full)).toBe('DirectPlay');
		expect(getPlayMethod(video({Codec: 'hevc', Width: 3840}), full)).toBe('DirectPlay');
	});

	test('respects a bitrate limit the user set', () => {
		expect(getPlayMethod(video({BitRate: 30_000_000}), full, {maxBitrate: 20_000_000})).toBe('Transcode');
		expect(getPlayMethod(video({BitRate: 30_000_000}), full)).toBe('DirectPlay');
	});

	test('plays an audio file it has the codec for', () => {
		const song = (codec, container) => ({Container: container, SupportsDirectPlay: true, SupportsDirectStream: true, MediaStreams: [{Type: 'Audio', Codec: codec}]});
		expect(getPlayMethod(song('flac', 'flac'), bare)).toBe('DirectPlay');
		expect(getPlayMethod(song('opus', 'ogg'), bare)).toBe('Transcode');
	});
});
