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

// Fast forward and rewind, and the track and page keys a remote may carry, page a list. 1 is a
// page forward, -1 a page back and 0 any other key.
const PAGE_FORWARD_KEYS = [KEYS.FAST_FORWARD || 417, 425, 10233, 34];
const PAGE_BACK_KEYS = [KEYS.REWIND || 412, 424, 10232, 33];
export const pageDirection = (keyCode) => {
	if (PAGE_FORWARD_KEYS.indexOf(keyCode) >= 0) return 1;
	if (PAGE_BACK_KEYS.indexOf(keyCode) >= 0) return -1;
	return 0;
};

export const isBackKey = (e) => {
	const code = e.keyCode || e.which;
	return code === KEYS.BACK || code === 27 || code === 8;
};

// The transport keys, which music playing behind the other screens still answers.
export const isMediaKey = (e) => [KEYS.PLAY, KEYS.PAUSE, KEYS.PLAY_PAUSE, KEYS.STOP, KEYS.FAST_FORWARD, KEYS.REWIND].includes(e.keyCode || e.which);

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

// A slow TV can take longer to draw a move than the remote takes to repeat a held arrow. Older engines
// stamp events when they're handled, so a repeat's wait can't be read off the event. A repeat that
// arrives before the last move has been drawn is dropped, so focus keeps pace with the key and stops
// when it's let go. A separate press always goes through.
const MAX_DRAW_WAIT_MS = 1000;
export const paceArrowKeys = (target = window) => {
	let held = null;
	let drawing = false;
	let acceptedAt = 0;
	// A message posted from the next frame's callback is handled once that frame has been drawn.
	const channel = new MessageChannel();
	channel.port1.onmessage = () => {
		drawing = false;
	};
	target.addEventListener('keydown', (e) => {
		const code = e.keyCode;
		if (code !== KEYS.UP && code !== KEYS.DOWN && code !== KEYS.LEFT && code !== KEYS.RIGHT) return;
		const repeat = e.repeat || held === code;
		held = code;
		// A page that stops drawing, hidden behind another app for one, can't hold the arrows forever.
		if (repeat && drawing && Date.now() - acceptedAt < MAX_DRAW_WAIT_MS) {
			e.preventDefault();
			e.stopImmediatePropagation();
			return;
		}
		drawing = true;
		acceptedAt = Date.now();
		window.requestAnimationFrame(() => channel.port2.postMessage(null));
	}, true);
	target.addEventListener('keyup', (e) => {
		if (e.keyCode === held) held = null;
	}, true);
};

// Says what a held arrow looked like to the page: how many key downs the set sent while it was held, how many of them
// were flagged as repeats, and how far apart they came. A held key that moves nothing is told apart by this from one the
// app threw away, since the set may not repeat the key at all. One line per hold of over 600 ms, for the diagnostic report.
const HOLD_REPORT_MS = 600;
// A key down this long after the last one is the start of a new hold, whatever came of the one before
const HOLD_GAP_MS = 1500;
export const watchArrowHolds = (target = window, report) => {
	let hold = null;
	const isArrow = (e) => (e.keyCode >= KEYS.LEFT && e.keyCode <= KEYS.DOWN) || /^Arrow/.test(e.key || '');
	const finish = (endedBy) => {
		if (hold && report && hold.last - hold.start >= HOLD_REPORT_MS) {
			const gaps = [...hold.gaps].sort((a, b) => a - b);
			report({
				key: hold.key,
				keyCode: hold.keyCode,
				downs: hold.downs,
				flaggedRepeats: hold.flagged,
				heldMs: Math.round(hold.last - hold.start),
				gapMs: gaps.length ? [gaps[0], gaps[Math.floor(gaps.length / 2)], gaps[gaps.length - 1]] : [],
				endedBy
			});
		}
		hold = null;
	};
	target.addEventListener('keydown', (e) => {
		if (!isArrow(e)) return;
		const at = performance.now();
		if (hold && (hold.keyCode !== e.keyCode || at - hold.last > HOLD_GAP_MS)) finish('no key up');
		if (!hold) hold = {key: e.key, keyCode: e.keyCode, start: at, last: at, downs: 0, flagged: 0, gaps: []};
		else hold.gaps.push(Math.round(at - hold.last));
		hold.downs += 1;
		if (e.repeat) hold.flagged += 1;
		hold.last = at;
	}, true);
	target.addEventListener('keyup', (e) => {
		if (!hold || e.keyCode !== hold.keyCode) return;
		// The time of the key up is what a hold is measured to
		hold.last = performance.now();
		finish('key up');
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
