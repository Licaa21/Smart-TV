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

const WEBOS_KEYS = {
	BACK: 461,
	PLAY: 415,
	PAUSE: 19,
	STOP: 413,
	REWIND: 412,
	FAST_FORWARD: 417,
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

const PLATFORM_KEYS = {tizen: TIZEN_KEYS, webos: WEBOS_KEYS, vega: VEGA_KEYS};

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
