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
	// The remote's channel keys arrive as page up and page down.
	CHANNEL_UP: 33,
	CHANNEL_DOWN: 34,
};

export const KEYS = {
	...STANDARD_KEYS,
	...(getPlatform() === 'tizen' ? TIZEN_KEYS : WEBOS_KEYS),
	BACK: getPlatform() === 'tizen' ? 10009 : 461,
};

// 1 for channel up, -1 for channel down, 0 for any other key.
export const channelKeyStep = (e) => {
	const code = e.keyCode || e.which;
	if (e.key === 'ChannelUp' || code === KEYS.CHANNEL_UP) return 1;
	if (e.key === 'ChannelDown' || code === KEYS.CHANNEL_DOWN) return -1;
	return 0;
};

export const isBackKey = (e) => {
	const code = e.keyCode || e.which;
	return code === KEYS.BACK || code === 27 || code === 8;
};

export const isExitKey = (e) => {
	if (getPlatform() !== 'tizen') return false;
	return (e.keyCode || e.which) === TIZEN_KEYS.EXIT;
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

// Remote buttons that hand the TV over to its tuner or to another app. A registered key goes to
// Moonfin and not to the system, and nothing here is bound to these, so pressing one leaves the app
// where it is. Besides the channel and guide keys, any key the TV lists by the name of a streaming
// service is taken too. The dedicated app buttons on some remotes are not listed, and the firmware
// keeps those for itself.
export const BLOCKED_KEY_NAMES = ['ChannelUp', 'ChannelDown', 'ChannelList', 'PreviousChannel', 'Guide'];
export const BLOCKED_KEY_PATTERN = /netflix|rakuten|prime|amazon|disney|hulu|hbo|youtube|apple|tvplus|shortcut/i;

export const registerBlockedKeys = () => {
	if (getPlatform() !== 'tizen') return;
	if (typeof tizen === 'undefined' || !tizen.tvinputdevice) return;

	try {
		const supportedKeyNames = tizen.tvinputdevice.getSupportedKeys().map((k) => k.name);
		console.log('[keys] keys this TV offers:', supportedKeyNames.join(', '));
		const wanted = supportedKeyNames.filter((name) => BLOCKED_KEY_NAMES.includes(name) || BLOCKED_KEY_PATTERN.test(name));
		wanted.forEach((keyName) => {
			try {
				tizen.tvinputdevice.registerKey(keyName);
			} catch (e) {
				console.warn(`Failed to register key ${keyName}:`, e);
			}
		});
	} catch (e) {
		console.error('Error registering blocked TV keys:', e);
	}
};

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
