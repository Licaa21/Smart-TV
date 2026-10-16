/* global tizen */
import {getPlatform} from '../platform';

const STANDARD_KEYS = {
	UP: 38,
	DOWN: 40,
	LEFT: 37,
	RIGHT: 39,
	ENTER: 13,
	ESCAPE: 27,
	BACKSPACE: 8,
	SPACE: 32,
	NUM_0: 48,
	NUM_1: 49,
	NUM_2: 50,
	NUM_3: 51,
	NUM_4: 52,
	NUM_5: 53,
	NUM_6: 54,
	NUM_7: 55,
	NUM_8: 56,
	NUM_9: 57,
};

const TIZEN_KEYS = {
	BACK: 10009,
	EXIT: 10182,
	PLAY: 415,
	PAUSE: 19,
	STOP: 413,
	REWIND: 412,
	FAST_FORWARD: 417,
	PLAY_PAUSE: 10252,
	RED: 403,
	GREEN: 404,
	YELLOW: 405,
	BLUE: 406,
	CHANNEL_UP: 427,
	CHANNEL_DOWN: 428,
};

// The channel buttons reach the page as Page Up and Page Down, and the Magic Remote's pointer
// hiding comes in as a key of its own.
const WEBOS_KEYS = {
	BACK: 461,
	PLAY: 415,
	PAUSE: 19,
	STOP: 413,
	REWIND: 412,
	FAST_FORWARD: 417,
	CHANNEL_UP: 33,
	CHANNEL_DOWN: 34,
	POINTER_HIDE: 1537,
};

// The Vega WebView hands the page the back key as Escape and the transport keys
// by their media key codes. The remote's menu key never reaches the page, so the
// shell reports it and the platform raises it as the context menu key.
const VEGA_KEYS = {
	BACK: 27,
	MENU: 93,
	PLAY_PAUSE: 179,
	REWIND: 227,
	FAST_FORWARD: 228,
};

// The controller's own key codes are turned into arrows, Enter, Escape and the
// context menu key before the app sees them, see @moonfin/platform-xbox/keys.
// The transport keys are the ones the host raises for the media remote, and the
// triggers come as its rewind and fast forward.
const XBOX_KEYS = {
	BACK: 27,
	MENU: 93,
	PLAY: 250,
	PAUSE: 19,
	STOP: 178,
	REWIND: 227,
	FAST_FORWARD: 228,
};

const PLATFORM_KEYS = {tizen: TIZEN_KEYS, webos: WEBOS_KEYS, vega: VEGA_KEYS, xbox: XBOX_KEYS};

export const KEYS = {
	...STANDARD_KEYS,
	...(PLATFORM_KEYS[getPlatform()] || WEBOS_KEYS),
};

export const isBackKey = (e) => {
	const code = e.keyCode || e.which;
	return code === KEYS.BACK || code === 27 || code === 8;
};

// A remote with a menu key does with one press what the others do by holding OK.
export const isMenuKey = (e) => KEYS.MENU !== undefined && (e.keyCode || e.which) === KEYS.MENU;

export const isExitKey = (e) => {
	if (getPlatform() !== 'tizen') return false;
	return (e.keyCode || e.which) === TIZEN_KEYS.EXIT;
};

// The channel buttons that are not the up and down pair: Guide, Channel List and Previous Channel. Sets that
// have none never send them, and they are taken from the TV in blockedKeys.js so they reach the app.
const TIZEN_CHANNEL_MENU_KEYS = [458, 10073, 10190];

export const isChannelMenuKey = (e) => {
	if (getPlatform() !== 'tizen') return false;
	return TIZEN_CHANNEL_MENU_KEYS.includes(e.keyCode || e.which);
};

// A held arrow repeats at the remote's own rate, which a slow TV can't always keep up with. A repeat that sat
// waiting behind the last move is dropped, so focus keeps pace with the key and stops when it's let go.
const STALE_REPEAT_MS = 100;
// A wait this long is a clock that does not agree with the page's, not a TV that is slow, so the repeat is kept
const MAX_PLAUSIBLE_WAIT_MS = 2000;
export const dropStaleArrowRepeats = (target = window, report) => {
	let held = null;
	// Some sets stamp their key events on a clock of their own, so every event reads as old by a fixed amount and every
	// repeat of a held key would be dropped, which left a held arrow doing nothing. That amount is the least age any arrow
	// press has been seen with, since a real wait only adds to it, and only the age beyond it counts as waiting.
	let skew = Infinity;
	let dropped = 0;
	let worst = 0;
	target.addEventListener('keydown', (e) => {
		const code = e.keyCode;
		if (code !== KEYS.UP && code !== KEYS.DOWN && code !== KEYS.LEFT && code !== KEYS.RIGHT) return;
		const repeat = e.repeat || held === code;
		held = code;
		// A set that leaves the stamp empty has nothing to measure a wait by
		if (!e.timeStamp) return;
		// Older engines stamp events with the wall clock rather than the page's own.
		const now = e.timeStamp > 1e12 ? Date.now() : performance.now();
		const age = now - e.timeStamp;
		if (age < skew) skew = age;
		const waited = age - skew;
		if (!repeat || waited <= STALE_REPEAT_MS || waited > MAX_PLAUSIBLE_WAIT_MS) return;
		dropped += 1;
		if (waited > worst) worst = waited;
		e.preventDefault();
		e.stopImmediatePropagation();
	}, true);
	target.addEventListener('keyup', (e) => {
		if (e.keyCode !== held) return;
		held = null;
		// What a held key lost is told once it is let go, for the diagnostic report
		if (dropped && report) report({dropped, worstWaitMs: Math.round(worst), skewMs: Math.round(skew)});
		dropped = 0;
		worst = 0;
	}, true);
};

export const ESSENTIAL_KEY_NAMES = [
	'MediaPlay',
	'MediaPause',
	'MediaStop',
	'MediaRewind',
	'MediaFastForward',
	'MediaPlayPause',
	'ColorF0Red',
	'ColorF1Green',
	'ColorF2Yellow',
	'ColorF3Blue',
	'Info',
	'Search',
	'ChannelUp',
	'ChannelDown'
];

export const registerKeys = (keyNames = ESSENTIAL_KEY_NAMES) => {
	if (getPlatform() !== 'tizen') return;
	if (typeof tizen === 'undefined' || !tizen.tvinputdevice) return;

	try {
		const supportedKeys = tizen.tvinputdevice.getSupportedKeys();
		const supportedKeyNames = supportedKeys.map(k => k.name);

		keyNames.forEach(keyName => {
			if (supportedKeyNames.includes(keyName)) {
				try {
					tizen.tvinputdevice.registerKey(keyName);
				} catch (e) {
					console.warn(`Failed to register key ${keyName}:`, e);
				}
			}
		});
	} catch (e) {
		console.error('Error registering TV keys:', e);
	}
};
