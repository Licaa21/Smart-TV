jest.mock('../platform', () => ({isTizen: jest.fn(), isWebOS: jest.fn()}));
jest.mock('./serverLogger', () => ({__esModule: true, default: {warn: jest.fn(), LOG_CATEGORIES: {PLAYBACK: 'Playback'}}}));

import {isTizen, isWebOS} from '../platform';
import serverLogger from './serverLogger';
import {
	attachTrailerStream,
	buildInnertubePayload,
	extractInnertubeStream,
	fetchVideoStream,
	freshVisitorData,
	isManifestUrl,
	isStaleVisitor,
	keepOriginalAudioTrack,
	nativeManifestSkipped,
	needsHlsJs,
	noteNativeManifest,
	originalAudioLanguage,
	pickOriginalAudioTrackIndex,
	playsManifestNatively,
	watchManifestPlayback
} from './youtubeTrailer';

const HLS_URL = 'https://manifest.googlevideo.com/api/manifest/hls_variant/id/abc/file/index.m3u8';

// Stands in for hls.js, keeping what the attach set up so a test can play the events back
class FakeHls {
	static isSupported () { return true; }
	constructor (config) {
		this.config = config;
		this.handlers = {};
		this.destroyed = false;
		FakeHls.instances.push(this);
	}
	on (event, handler) { this.handlers[event] = handler; }
	loadSource (url) { this.url = url; }
	attachMedia (media) { this.media = media; }
	destroy () { this.destroyed = true; }
}
FakeHls.instances = [];
FakeHls.Events = {ERROR: 'hlsError'};

beforeEach(() => {
	isTizen.mockReturnValue(false);
	isWebOS.mockReturnValue(false);
});

// The shape of a Vision Pro answer for a trailer YouTube has machine dubbed
const dubbedAnswer = () => ({
	playabilityStatus: {status: 'OK'},
	responseContext: {visitorData: 'visitor-1'},
	streamingData: {
		hlsManifestUrl: HLS_URL,
		adaptiveFormats: [
			{itag: 137, mimeType: 'video/mp4; codecs="avc1.640028"', url: 'https://v/137'},
			{itag: 140, mimeType: 'audio/mp4; codecs="mp4a.40.2"', url: 'https://v/140-de', audioTrack: {id: 'de-DE.10', audioIsDefault: false}},
			{itag: 140, mimeType: 'audio/mp4; codecs="mp4a.40.2"', url: 'https://v/140-en', audioTrack: {id: 'en-US.4', audioIsDefault: true}}
		]
	}
});

const turnedAway = (visitor) => ({
	playabilityStatus: {status: 'LOGIN_REQUIRED'},
	responseContext: {visitorData: visitor}
});

const fakeTracks = (entries) => {
	const tracks = entries.map((entry) => ({enabled: false, ...entry}));
	tracks.onaddtrack = null;
	return tracks;
};

describe('buildInnertubePayload', () => {
	test('sends the visitor id and leaves out an empty platform', () => {
		const payload = buildInnertubePayload('vid', {name: 'VISIONOS', version: '1.02', platform: '', extra: {osName: 'visionOS'}}, 'visitor-1');

		expect(payload.context.client).toEqual({clientName: 'VISIONOS', clientVersion: '1.02', hl: 'en', gl: 'US', osName: 'visionOS', visitorData: 'visitor-1'});
	});

	test('keeps the platform and sends no visitor id when there is none', () => {
		const payload = buildInnertubePayload('vid', {name: 'ANDROID', version: '20.10.41', platform: 'MOBILE', extra: {}});

		expect(payload.context.client.platform).toBe('MOBILE');
		expect(payload.context.client).not.toHaveProperty('visitorData');
	});
});

describe('freshVisitorData', () => {
	test('hands back the id a turned away request came with', () => {
		expect(freshVisitorData(turnedAway('visitor-2'), '')).toBe('visitor-2');
	});

	test('doesnt retry with the id that was already sent', () => {
		expect(freshVisitorData(turnedAway('visitor-2'), 'visitor-2')).toBeNull();
	});

	test('doesnt retry an answer that played', () => {
		expect(freshVisitorData(dubbedAnswer(), '')).toBeNull();
	});
});

describe('isStaleVisitor', () => {
	test('marks a sent id YouTube handed back on a bot check', () => {
		expect(isStaleVisitor(turnedAway('visitor-2'), 'visitor-2')).toBe(true);
	});

	test('leaves a fresh id, an unplayable video and an empty id alone', () => {
		expect(isStaleVisitor(turnedAway('visitor-2'), 'visitor-1')).toBe(false);
		expect(isStaleVisitor({playabilityStatus: {status: 'UNPLAYABLE'}, responseContext: {visitorData: 'visitor-2'}}, 'visitor-2')).toBe(false);
		expect(isStaleVisitor(turnedAway('visitor-2'), '')).toBe(false);
	});
});

describe('originalAudioLanguage', () => {
	test('names the soundtrack YouTube flags as the default', () => {
		expect(originalAudioLanguage(dubbedAnswer())).toBe('en-US');
	});

	test('is empty for a trailer with only its own soundtrack', () => {
		expect(originalAudioLanguage({streamingData: {adaptiveFormats: [{itag: 140, mimeType: 'audio/mp4'}]}})).toBe('');
	});
});

describe('extractInnertubeStream', () => {
	test('takes the manifest over the muxed file', () => {
		const answer = dubbedAnswer();
		answer.streamingData.formats = [{itag: 18, qualityLabel: '360p', mimeType: 'video/mp4; codecs="avc1.42001E, mp4a.40.2"', url: 'https://v/18'}];

		expect(extractInnertubeStream(answer, true)).toEqual({url: HLS_URL, quality: 720});
	});

	test('passes over the manifest when only a file with its own sound will do', () => {
		const answer = dubbedAnswer();
		answer.streamingData.formats = [{itag: 18, qualityLabel: '360p', mimeType: 'video/mp4; codecs="avc1.42001E, mp4a.40.2"', url: 'https://v/18'}];

		expect(extractInnertubeStream(answer, true, true)).toEqual({url: 'https://v/18', quality: 360});
	});

	test('falls back to the muxed file when there is no manifest', () => {
		const answer = {
			playabilityStatus: {status: 'OK'},
			streamingData: {formats: [{itag: 18, qualityLabel: '360p', mimeType: 'video/mp4; codecs="avc1.42001E, mp4a.40.2"', url: 'https://v/18'}]}
		};

		expect(extractInnertubeStream(answer, true)).toEqual({url: 'https://v/18', quality: 360});
	});
});

describe('isManifestUrl', () => {
	test('knows a YouTube manifest from a file', () => {
		expect(isManifestUrl(HLS_URL)).toBe(true);
		expect(isManifestUrl('https://rr3---sn.googlevideo.com/videoplayback?itag=18&mime=video%2Fmp4')).toBe(false);
	});
});

describe('pickOriginalAudioTrackIndex', () => {
	test('finds the track the manifest names as the original', () => {
		const tracks = fakeTracks([{label: 'Deutsch - dubbed-auto', language: 'de-DE'}, {label: 'American English - original', language: 'en-US'}]);

		expect(pickOriginalAudioTrackIndex(tracks, 'en-US')).toBe(1);
	});

	test('takes the copy in the audio group the sharp variants use', () => {
		const tracks = fakeTracks([
			{label: 'Deutsch - dubbed-auto', language: 'de-DE'},
			{label: 'American English - original', language: 'en-US'},
			{label: 'Deutsch - dubbed-auto', language: 'de-DE'},
			{label: 'American English - original', language: 'en-US'}
		]);

		expect(pickOriginalAudioTrackIndex(tracks, 'en-US')).toBe(3);
	});

	test('falls back to the language when the engine drops the name', () => {
		const tracks = fakeTracks([{label: '', language: 'de'}, {label: '', language: 'en'}]);

		expect(pickOriginalAudioTrackIndex(tracks, 'en-US')).toBe(1);
	});

	test('leaves a single track or an unknown language alone', () => {
		expect(pickOriginalAudioTrackIndex(fakeTracks([{label: 'original', language: 'en'}]), 'en-US')).toBe(-1);
		expect(pickOriginalAudioTrackIndex(fakeTracks([{label: 'a'}, {label: 'b - original'}]), '')).toBe(-1);
	});
});

describe('keepOriginalAudioTrack', () => {
	test('switches to the original as tracks turn up and lets go when released', () => {
		const tracks = fakeTracks([{label: 'Deutsch - dubbed-auto', language: 'de-DE', enabled: true}]);
		const video = {audioTracks: tracks};

		const release = keepOriginalAudioTrack(video, 'en-US');
		expect(tracks[0].enabled).toBe(true);

		tracks.push({label: 'American English - original', language: 'en-US', enabled: false});
		tracks.onaddtrack();
		expect(tracks.map((t) => t.enabled)).toEqual([false, true]);

		release();
		expect(tracks.onaddtrack).toBeNull();
	});

	test('does nothing on an engine without the audioTracks API', () => {
		expect(() => keepOriginalAudioTrack({}, 'en-US')()).not.toThrow();
	});
});

describe('fetchVideoStream', () => {
	afterEach(() => {
		delete global.fetch;
	});

	test('asks again with the visitor id it was turned away with, then keeps using it', async () => {
		const bodies = [];
		const answers = [turnedAway('visitor-2'), dubbedAnswer(), dubbedAnswer()];
		global.fetch = jest.fn((url, options) => {
			bodies.push(JSON.parse(options.body));
			return Promise.resolve({ok: true, json: () => Promise.resolve(answers.shift())});
		});

		const first = await fetchVideoStream('vid', true);
		const second = await fetchVideoStream('vid', true);

		expect(first).toEqual({url: HLS_URL, captionsUrl: null, audioLanguage: 'en-US', client: 'VISIONOS'});
		expect(second.url).toBe(HLS_URL);
		expect(bodies.map((b) => [b.context.client.clientName, b.context.client.visitorData])).toEqual([
			['VISIONOS', undefined],
			['VISIONOS', 'visitor-2'],
			['VISIONOS', 'visitor-2']
		]);
		expect(global.fetch.mock.calls[0][0]).toBe('https://www.youtube.com/youtubei/v1/player?prettyPrint=false');
	});

	test('drops a kept id YouTube stops taking, so the next lookup starts over', async () => {
		const bodies = [];
		const androidAnswer = {playabilityStatus: {status: 'OK'}, streamingData: {formats: [{qualityLabel: '360p', mimeType: 'video/mp4; codecs="avc1.42001E, mp4a.40.2"', url: 'https://v/18'}]}};
		const answers = [turnedAway('visitor-3'), dubbedAnswer(), turnedAway('visitor-3'), androidAnswer, turnedAway('visitor-4'), dubbedAnswer()];
		global.fetch = jest.fn((url, options) => {
			bodies.push(JSON.parse(options.body));
			return Promise.resolve({ok: true, json: () => Promise.resolve(answers.shift())});
		});

		await fetchVideoStream('vid', true);
		const refused = await fetchVideoStream('vid', true);
		const recovered = await fetchVideoStream('vid', true);

		expect(refused.url).toBe('https://v/18');
		expect(recovered.url).toBe(HLS_URL);
		expect(bodies.map((b) => [b.context.client.clientName, b.context.client.visitorData])).toEqual([
			['VISIONOS', expect.anything()],
			['VISIONOS', 'visitor-3'],
			['VISIONOS', 'visitor-3'],
			['ANDROID', undefined],
			['VISIONOS', undefined],
			['VISIONOS', 'visitor-4']
		]);
	});
});

describe('needsHlsJs', () => {
	test('only sends a manifest on Tizen through hls.js', () => {
		expect(needsHlsJs(HLS_URL)).toBe(false);
		isTizen.mockReturnValue(true);
		expect(needsHlsJs(HLS_URL)).toBe(true);
		expect(needsHlsJs('https://rr3---sn.googlevideo.com/videoplayback?itag=18')).toBe(false);
	});
});

describe('attachTrailerStream', () => {
	afterEach(() => {
		FakeHls.instances.length = 0;
	});

	test('hands the stream to the element when there is no hls.js to use', () => {
		const tracks = fakeTracks([]);
		const video = {audioTracks: tracks};

		const release = attachTrailerStream(video, HLS_URL, {audioLanguage: 'en-US', startTime: 12});

		expect(video.src).toBe(HLS_URL);
		expect(video.currentTime).toBe(12);
		release();
		expect(tracks.onaddtrack).toBeNull();
	});

	test('plays a manifest through hls.js on H.264 and the original soundtrack', () => {
		const video = {};
		const onError = jest.fn();

		const release = attachTrailerStream(video, HLS_URL, {Hls: FakeHls, audioLanguage: 'en-US', startTime: 12, onError});
		const hls = FakeHls.instances[0];

		expect(video.src).toBeUndefined();
		expect(hls.media).toBe(video);
		expect(hls.url).toBe(HLS_URL);
		expect(hls.config).toMatchObject({startPosition: 12, videoPreference: {videoCodec: 'avc1'}, audioPreference: {lang: 'en-US'}});

		hls.handlers.hlsError('hlsError', {fatal: false});
		expect(onError).not.toHaveBeenCalled();
		hls.handlers.hlsError('hlsError', {fatal: true});
		expect(onError).toHaveBeenCalledTimes(1);

		release();
		expect(hls.destroyed).toBe(true);
		hls.handlers.hlsError('hlsError', {fatal: true});
		expect(onError).toHaveBeenCalledTimes(1);
	});
});

describe('attachTrailerStream on webOS', () => {
	const lgVideo = () => {
		const video = document.createElement('video');
		video.load = jest.fn();
		return video;
	};

	test("hands a manifest to LG's player held to 1080p and started at the offset", () => {
		isWebOS.mockReturnValue(true);
		const video = lgVideo();

		const release = attachTrailerStream(video, HLS_URL, {startTime: 12.5});
		const source = video.querySelector('source');
		const option = JSON.parse(decodeURI(source.getAttribute('type').split(';mediaOption=')[1]));

		expect(source.getAttribute('src')).toBe(HLS_URL);
		expect(source.getAttribute('type').indexOf('application/vnd.apple.mpegurl;')).toBe(0);
		expect(option).toEqual({
			mediaTransportType: 'HLS',
			option: {adaptiveStreaming: {maxWidth: 1920, maxHeight: 1080}, transmission: {playTime: {start: 12500}}}
		});
		expect(video.load).toHaveBeenCalled();
		release();
		expect(video.querySelector('source')).toBeNull();
	});

	test("hears the player turn the manifest away, which only the source reports", () => {
		isWebOS.mockReturnValue(true);
		const video = lgVideo();
		const onError = jest.fn();
		const release = attachTrailerStream(video, HLS_URL, {onError});
		const source = video.querySelector('source');
		source.dispatchEvent(new Event('error'));
		expect(onError).toHaveBeenCalledTimes(1);
		release();
		source.dispatchEvent(new Event('error'));
		expect(onError).toHaveBeenCalledTimes(1);
	});

	test('still gives the muxed file straight to the element', () => {
		isWebOS.mockReturnValue(true);
		const video = lgVideo();
		attachTrailerStream(video, 'https://rr3---sn.googlevideo.com/videoplayback?itag=18');
		expect(video.querySelector('source')).toBeNull();
		expect(video.getAttribute('src')).toBe('https://rr3---sn.googlevideo.com/videoplayback?itag=18');
	});
});

describe('playsManifestNatively', () => {
	test("is a manifest that isnt going through hls.js", () => {
		expect(playsManifestNatively(HLS_URL)).toBe(true);
		expect(playsManifestNatively('https://rr3---sn.googlevideo.com/videoplayback?itag=18')).toBe(false);
		isTizen.mockReturnValue(true);
		expect(playsManifestNatively(HLS_URL)).toBe(false);
	});
});

describe('watchManifestPlayback', () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});
	afterEach(() => {
		jest.useRealTimers();
	});

	const advance = (video, seconds, step = 0.5) => {
		for (let t = 0; t < seconds; t += step) {
			video.currentTime += step;
			jest.advanceTimersByTime(step * 1000);
		}
	};

	test('gives up on a manifest that never starts', () => {
		const video = {currentTime: 0, paused: false};
		const onStall = jest.fn();
		watchManifestPlayback(video, {onStall});
		jest.advanceTimersByTime(7500);
		expect(onStall).not.toHaveBeenCalled();
		jest.advanceTimersByTime(1000);
		expect(onStall).toHaveBeenCalledWith('did not start');
	});

	test('confirms a manifest that keeps playing and catches one that stops', () => {
		const video = {currentTime: 0, paused: false};
		const onStall = jest.fn();
		const onConfirmed = jest.fn();
		watchManifestPlayback(video, {onStall, onConfirmed});
		advance(video, 11);
		expect(onConfirmed).toHaveBeenCalledTimes(1);
		jest.advanceTimersByTime(4500);
		expect(onStall).not.toHaveBeenCalled();
		jest.advanceTimersByTime(1000);
		expect(onStall).toHaveBeenCalledWith('stalled');
	});

	test('doesnt count a pause or a skip past a segment as trouble', () => {
		const video = {currentTime: 0, paused: false};
		const onStall = jest.fn();
		const onConfirmed = jest.fn();
		watchManifestPlayback(video, {onStall, onConfirmed});
		advance(video, 2);
		video.paused = true;
		jest.advanceTimersByTime(20000);
		video.paused = false;
		video.currentTime += 30;
		advance(video, 4);
		expect(onStall).not.toHaveBeenCalled();
		expect(onConfirmed).not.toHaveBeenCalled();
	});

	test('stops watching when asked', () => {
		const video = {currentTime: 0, paused: false};
		const onStall = jest.fn();
		const stop = watchManifestPlayback(video, {onStall});
		stop();
		jest.advanceTimersByTime(20000);
		expect(onStall).not.toHaveBeenCalled();
	});
});

describe('native manifest memory', () => {
	const now = 1000000;
	const week = 7 * 24 * 60 * 60 * 1000;

	beforeEach(() => {
		noteNativeManifest(true);
	});

	test('takes two failures in a row before the TV skips manifests for a week', () => {
		serverLogger.warn.mockClear();
		noteNativeManifest(false, now);
		expect(nativeManifestSkipped(now)).toBe(false);
		expect(serverLogger.warn).not.toHaveBeenCalled();
		noteNativeManifest(false, now);
		expect(nativeManifestSkipped(now + week - 1)).toBe(true);
		expect(nativeManifestSkipped(now + week + 1)).toBe(false);
		expect(serverLogger.warn).toHaveBeenCalledTimes(1);
	});

	test('a manifest that plays clears a failure before it adds up', () => {
		noteNativeManifest(false, now);
		noteNativeManifest(true, now);
		noteNativeManifest(false, now);
		expect(nativeManifestSkipped(now)).toBe(false);
	});
});
