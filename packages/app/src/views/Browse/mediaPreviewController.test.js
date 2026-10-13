// Stands in for hls.js, keeping what the attach set up so a test can play the events back
class MockHls {
	static isSupported () { return true; }
	constructor (config) {
		this.config = config;
		this.handlers = {};
		this.destroyed = false;
		MockHls.instances.push(this);
	}
	on (event, handler) { this.handlers[event] = handler; }
	loadSource (url) { this.url = url; }
	attachMedia (media) { this.media = media; }
	destroy () {
		this.destroyed = true;
		MockHls.order.push('destroy');
	}
}
MockHls.instances = [];
MockHls.order = [];
MockHls.Events = {ERROR: 'hlsError'};

jest.mock('../../platform', () => ({
	getPlatform: () => 'tizen',
	isTizen: () => true,
	isWebOS: () => false,
	isXbox: () => false,
	isVega: () => false,
	isLegacyTizen: () => false
}));
jest.mock('../../services/serverLogger', () => ({
	__esModule: true,
	default: {warn: jest.fn(), playback: jest.fn(), LOG_CATEGORIES: {PLAYBACK: 'Playback'}}
}));
jest.mock('../../services/jellyfinApi', () => ({
	createApiForServer: jest.fn(),
	getDeviceId: () => 'device-1',
	getApiKey: () => 'token',
	getServerType: () => 'jellyfin',
	getServerUrl: () => 'http://server',
	getTokenParam: () => 'ApiKey'
}));
jest.mock('../../services/deviceProfile', () => ({getDeviceCapabilities: jest.fn()}));
// The platform module is reached through a dynamic import, so it's stood in for
// with a real jsdom element and a cleanup the tests can watch.
jest.mock('@moonfin/platform-webos/video', () => {
	const element = globalThis.document.createElement('video');
	return {
		getSharedVideoElement: () => element,
		cleanupVideoElement: jest.fn()
	};
}, {virtual: true});
jest.mock('hls.js', () => ({__esModule: true, default: MockHls}));

import {cleanupVideoElement, getSharedVideoElement} from '@moonfin/platform-webos/video';
import {PREVIEW_DWELL_MS, PREVIEW_OPEN_TIMEOUT_MS, PREVIEW_PLAY_CAP_MS} from '../../services/mediaPreviewSource';
import {claimSharedVideo, ownsSharedVideo, releaseSharedVideo} from '../../utils/sharedVideoOwner';
import {createMediaPreviewController} from './mediaPreviewController';

const KEY = 'media-row-film';
const TICK = 10000000;

const movie = (overrides = {}) => ({Id: 'film', Type: 'Movie', Name: 'Film', ...overrides});
const target = (Id = 'film', extra = {}) => ({
	Id,
	RunTimeTicks: 5400 * TICK,
	MediaSources: [{Id: `${Id}-src`, MediaStreams: [{Type: 'Audio', Index: 1, Language: 'eng', Codec: 'aac', Channels: 2}]}],
	...extra
});

// jsdom lays nothing out, so the frame and the video are given sizes by hand.
const sized = (element, props) => {
	Object.keys(props).forEach((name) => {
		Object.defineProperty(element, name, {configurable: true, get: () => props[name]});
	});
	return element;
};

const makeFrame = () => sized(document.createElement('div'), {clientWidth: 240, clientHeight: 360});

// Enough microtask turns for the resolve, the two dynamic imports and the attach.
const flush = async () => {
	for (let i = 0; i < 60; i++) await Promise.resolve();
};

let api;
let order;
let holds;
let announced;
let phases;
let controller;
let frame;
let video;

const makeController = (options = {}) => {
	controller = createMediaPreviewController({
		getSettings: () => ({}),
		api,
		onThemeMusicHold: (held) => {
			holds.push(held);
			order.push(`hold:${held}`);
		},
		platform: 'tizen',
		...options
	});
	controller.subscribe(KEY, (phase) => {
		phases.push(phase);
		order.push(`phase:${phase}`);
	});
	controller.setEnabled(true);
	return controller;
};

const dwell = async () => {
	jest.advanceTimersByTime(PREVIEW_DWELL_MS);
	await flush();
};

const startPreview = async (item = movie()) => {
	controller.attachFrame(KEY, frame);
	controller.schedule(KEY, item);
	await dwell();
};

const play = () => {
	video.onplaying();
};

const onAnnounce = (e) => {
	announced.push(!!e.detail?.active);
	order.push(`announce:${!!e.detail?.active}`);
};

beforeEach(() => {
	jest.useFakeTimers();
	MockHls.instances = [];
	MockHls.order = [];
	order = MockHls.order;
	holds = [];
	announced = [];
	phases = [];
	releaseSharedVideo('preview');
	releaseSharedVideo('trailer');
	frame = makeFrame();
	video = sized(getSharedVideoElement(), {videoWidth: 1280, videoHeight: 720});
	window.HTMLMediaElement.prototype.play = jest.fn(() => Promise.resolve());
	window.HTMLMediaElement.prototype.pause = jest.fn();
	window.HTMLMediaElement.prototype.load = jest.fn();
	cleanupVideoElement.mockImplementation(() => {
		order.push('cleanup');
		return Promise.resolve(true);
	});
	api = {
		getNextUp: jest.fn(),
		getItemMediaInfo: jest.fn(),
		stopActiveEncodings: jest.fn(() => {
			order.push('delete');
			return Promise.resolve(null);
		})
	};
	api.getItemMediaInfo.mockResolvedValue(target());
	window.addEventListener('moonfin:trailerPreview', onAnnounce);
	makeController();
});

afterEach(() => {
	controller.dispose();
	window.removeEventListener('moonfin:trailerPreview', onAnnounce);
	jest.useRealTimers();
});

describe('the dwell', () => {
	test('nothing is fetched until the card has been focused for the dwell', async () => {
		controller.schedule(KEY, movie());
		jest.advanceTimersByTime(PREVIEW_DWELL_MS - 1);
		await flush();

		expect(api.getItemMediaInfo).not.toHaveBeenCalled();
		expect(holds).toEqual([]);

		jest.advanceTimersByTime(1);
		await flush();

		expect(api.getItemMediaInfo).toHaveBeenCalledWith('film');
	});

	test('a cancel before the dwell fetches nothing', async () => {
		controller.schedule(KEY, movie());
		jest.advanceTimersByTime(600);
		controller.cancel(KEY);
		jest.advanceTimersByTime(PREVIEW_DWELL_MS);
		await flush();

		expect(api.getItemMediaInfo).not.toHaveBeenCalled();
		expect(controller.getCurrent()).toBeNull();
	});

	test('the same card scheduled again doesn\'t restart the dwell', async () => {
		controller.schedule(KEY, movie());
		jest.advanceTimersByTime(1000);
		controller.schedule(KEY, movie());
		jest.advanceTimersByTime(300);
		await flush();

		expect(api.getItemMediaInfo).toHaveBeenCalledTimes(1);
	});

	test('another card stops the first and starts its own dwell', async () => {
		await startPreview();
		play();
		api.getItemMediaInfo.mockResolvedValue(target('other'));

		controller.schedule('media-row-other', movie({Id: 'other'}));

		expect(phases[phases.length - 1]).toBe('idle');
		expect(controller.getCurrent()).toEqual({key: 'media-row-other', phase: 'pending'});
		// Moving between cards keeps the music held rather than fading it in and out.
		expect(holds).toEqual([true]);
	});

	test('a card that can\'t be previewed starts nothing', async () => {
		controller.schedule('media-row-seerr', movie({_seerr: true}));
		controller.schedule('media-row-box', {Id: 'box', Type: 'BoxSet'});
		await dwell();

		expect(api.getItemMediaInfo).not.toHaveBeenCalled();
		expect(controller.getCurrent()).toBeNull();
	});
});

describe('attaching', () => {
	test('the element goes into the card frame with the stream on hls.js and the start offset', async () => {
		await startPreview();

		expect(phases).toEqual(['attached']);
		expect(frame.contains(video)).toBe(true);
		expect(MockHls.instances).toHaveLength(1);
		const hls = MockHls.instances[0];
		expect(hls.media).toBe(video);
		expect(hls.url).toContain('http://server/Videos/film/master.m3u8?');
		expect(hls.url).toContain('DeviceId=device-1');
		expect(hls.url).toContain('SegmentContainer=ts');
		expect(hls.url).toContain('AudioStreamIndex=1');
		expect(hls.url).toContain('ApiKey=token');
		expect(hls.url).not.toContain('StartTimeTicks');
		expect(hls.config.startPosition).toBe(180);
		expect(video.play).toHaveBeenCalledTimes(1);
		expect(holds).toEqual([true]);
	});

	test('the stream waits for a frame the card draws after hearing attached', async () => {
		controller.schedule(KEY, movie());
		await dwell();

		expect(phases).toEqual(['attached']);
		expect(MockHls.instances).toHaveLength(0);

		controller.attachFrame(KEY, frame);
		await flush();

		expect(frame.contains(video)).toBe(true);
		expect(MockHls.instances).toHaveLength(1);
	});

	test('a series plays its next up episode and a special means no preview', async () => {
		api.getNextUp.mockResolvedValue({Items: [{Id: 'ep3', ParentIndexNumber: 2}]});
		api.getItemMediaInfo.mockResolvedValue(target('ep3'));

		await startPreview(movie({Id: 'show', Type: 'Series'}));

		expect(api.getNextUp).toHaveBeenCalledWith(1, 'show');
		expect(MockHls.instances[0].url).toContain('/Videos/ep3/master.m3u8');

		controller.stop('blur');
		phases.length = 0;
		api.getNextUp.mockResolvedValue({Items: [{Id: 'sp1', ParentIndexNumber: 0}]});
		api.getItemMediaInfo.mockClear();

		await startPreview(movie({Id: 'show', Type: 'Series'}));

		expect(api.getItemMediaInfo).not.toHaveBeenCalled();
		expect(phases).toEqual(['idle']);
		expect(controller.getCurrent()).toBeNull();
	});

	test('a stale resolve after a stop never attaches, never plays and never tells the server', async () => {
		controller.attachFrame(KEY, frame);
		controller.schedule(KEY, movie());
		jest.advanceTimersByTime(PREVIEW_DWELL_MS);
		controller.stop('blur');
		await flush();

		expect(api.getItemMediaInfo).toHaveBeenCalledTimes(1);
		expect(frame.contains(video)).toBe(false);
		expect(MockHls.instances).toHaveLength(0);
		expect(video.play).not.toHaveBeenCalled();
		expect(api.stopActiveEncodings).not.toHaveBeenCalled();
		// The card never heard attached, only the idle the stop sends.
		expect(phases).toEqual(['idle']);
		expect(holds).toEqual([true, false]);
	});

	test('autoplay refused with sound is retried muted', async () => {
		video.muted = false;
		window.HTMLMediaElement.prototype.play = jest.fn()
			.mockImplementationOnce(() => Promise.reject(new Error('NotAllowedError')))
			.mockImplementation(() => Promise.resolve());

		await startPreview();

		expect(video.play).toHaveBeenCalledTimes(2);
		expect(video.muted).toBe(true);
	});
});

describe('playing', () => {
	test('reveals the card, sizes the video to cover the frame and holds the screensaver off', async () => {
		await startPreview();
		play();

		expect(phases).toEqual(['attached', 'playing']);
		expect(announced).toEqual([true]);
		expect(video.style.width).toBe('640px');
		expect(video.style.height).toBe('360px');
		expect(video.style.left).toBe('-200px');
		expect(controller.getCurrent()).toEqual({key: KEY, phase: 'playing'});
	});

	test('the audio toggle applies to a running preview', async () => {
		await startPreview();
		play();
		expect(video.muted).toBe(false);

		controller.setAudioEnabled(false);
		expect(video.muted).toBe(true);
		expect(video.volume).toBe(0);

		controller.setAudioEnabled(true);
		expect(video.muted).toBe(false);
	});

	test('starts muted when preview audio is off', async () => {
		controller.setAudioEnabled(false);
		await startPreview();

		expect(video.muted).toBe(true);
	});
});

describe('stopping', () => {
	test('lets go of everything in order: stream, element, server, music, screensaver, card', async () => {
		await startPreview();
		play();
		const hls = MockHls.instances[0];
		order.length = 0;

		controller.stop('blur');

		expect(order).toEqual(['destroy', 'cleanup', 'delete', 'hold:false', 'announce:false', 'phase:idle']);
		expect(hls.destroyed).toBe(true);
		expect(cleanupVideoElement).toHaveBeenCalledWith(video);
		expect(video.style.width).toBe('100%');
		expect(video.style.height).toBe('100%');
		expect(frame.contains(video)).toBe(false);
		expect(video.onplaying).toBeNull();
		expect(video.onerror).toBeNull();
		expect(ownsSharedVideo('preview')).toBe(false);
		const playSessionId = /PlaySessionId=([0-9a-f]{32})/.exec(hls.url)[1];
		expect(api.stopActiveEncodings).toHaveBeenCalledWith(playSessionId);
		expect(controller.getCurrent()).toBeNull();
	});

	test('a stream that never opens is given up on after the open timeout', async () => {
		await startPreview();

		jest.advanceTimersByTime(PREVIEW_OPEN_TIMEOUT_MS - 1);
		expect(controller.getCurrent()).toEqual({key: KEY, phase: 'attached'});

		jest.advanceTimersByTime(1);
		expect(controller.getCurrent()).toBeNull();
		expect(phases).toEqual(['attached', 'idle']);
		expect(api.stopActiveEncodings).toHaveBeenCalledTimes(1);
	});

	test('a playing preview ends at the cap', async () => {
		await startPreview();
		play();

		jest.advanceTimersByTime(PREVIEW_PLAY_CAP_MS - 1);
		expect(controller.getCurrent()).toEqual({key: KEY, phase: 'playing'});

		jest.advanceTimersByTime(1);
		expect(controller.getCurrent()).toBeNull();
		expect(announced).toEqual([true, false]);
	});

	test('the element reporting an error stops it, and so does hls.js giving up', async () => {
		await startPreview();
		video.onerror();
		expect(controller.getCurrent()).toBeNull();

		phases.length = 0;
		await startPreview();
		MockHls.instances[1].handlers.hlsError({}, {fatal: true});
		expect(controller.getCurrent()).toBeNull();
		expect(phases).toEqual(['attached', 'idle']);
	});

	test('turning the setting off stops a running preview and blocks new ones', async () => {
		await startPreview();
		play();

		controller.setEnabled(false);
		expect(controller.getCurrent()).toBeNull();

		controller.schedule(KEY, movie());
		await dwell();
		expect(controller.getCurrent()).toBeNull();
		expect(api.getItemMediaInfo).toHaveBeenCalledTimes(1);
	});

	test('a card focused while previews are off starts once they come back on', async () => {
		controller.setEnabled(false);
		controller.attachFrame(KEY, frame);
		controller.schedule(KEY, movie());
		await dwell();
		expect(controller.getCurrent()).toBeNull();

		controller.setEnabled(true);
		expect(controller.getCurrent()).toEqual({key: KEY, phase: 'pending'});
		await dwell();
		expect(api.getItemMediaInfo).toHaveBeenCalledTimes(1);
	});

	test('a card that blurred while previews were off is left alone when they come back on', () => {
		controller.setEnabled(false);
		controller.schedule(KEY, movie());
		controller.cancel(KEY);

		controller.setEnabled(true);
		expect(controller.getCurrent()).toBeNull();
	});

	test('the trailer claiming the element evicts the preview', async () => {
		await startPreview();
		play();

		claimSharedVideo('trailer', () => {});

		expect(controller.getCurrent()).toBeNull();
		expect(frame.contains(video)).toBe(false);
		expect(MockHls.instances[0].destroyed).toBe(true);
		expect(ownsSharedVideo('trailer')).toBe(true);
		expect(api.stopActiveEncodings).toHaveBeenCalledTimes(1);
	});

	test('a blur releases the music hold', async () => {
		await startPreview();
		controller.cancel(KEY);

		expect(holds).toEqual([true, false]);
	});

	test('dispose stops the preview and drops the card', async () => {
		await startPreview();
		play();

		controller.dispose();

		expect(controller.getCurrent()).toBeNull();
		expect(frame.contains(video)).toBe(false);
		expect(announced).toEqual([true, false]);
	});
});
