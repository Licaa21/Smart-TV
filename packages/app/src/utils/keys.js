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
const isArrow = (e) => (e.keyCode >= KEYS.LEFT && e.keyCode <= KEYS.DOWN) || /^Arrow/.test(e.key || '');
export const watchArrowHolds = (target = window, report) => {
	let hold = null;
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

// Says how the page answered the arrow presses, which is what lag is on a TV: for each press (not a held key), how long it
// took to reach a frame, and the longest frame in the 600 ms after it, and how old the set's stamp on the key was when the page
// got it. A summary of `every` presses goes to the
// diagnostic report, as the median, the 90th percentile and the worst, so a report says whether Home is slow to start
// moving, slow while it moves, or both.
const RESPONSE_WINDOW_MS = 600;
const SLOW_FRAME_MS = 100;
// A batch left short by leaving the app is reported from this many presses
const MIN_REPORTED = 5;
// A frame this late is a standby, not a lag
const STANDBY_MS = 120000;
// A key stamp older than this is from another clock, or a key that sat in a queue for good, and is read as no age
const RESPONSE_STAMP_MAX_MS = 1000;
// The same settings, compared by what they say
const sameContext = (a, b) => {
	const keys = Object.keys(a);
	return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
};
const spread = (list) => {
	const sorted = [...list].sort((a, b) => a - b);
	return [sorted[Math.floor(sorted.length / 2)], sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))], sorted[sorted.length - 1]].map(Math.round);
};
// Up and down are told apart from left and right, which are different moves (a list slides one way, a row the other).
// `context` gives what else a report should say about the moment, such as the settings that change the cost of a move.
const isVertical = (e) => e.keyCode === KEYS.UP || e.keyCode === KEYS.DOWN || /^Arrow(Up|Down)$/.test(e.key || '');
export const watchArrowResponse = (target = window, report, every = 20, context = () => ({}), moves = null) => {
	const empty = () => ({firsts: [], worsts: [], ages: [], ctx: null});
	const batches = {v: empty(), h: empty()};
	// Every press watched at the moment, each for its own window, by one loop of frames shared between them
	let pending = [];
	let previous = 0;
	const down = new Map();
	const flush = (axis, partial) => {
		const {firsts, worsts, ages, ctx} = batches[axis];
		const summary = {
			axis: axis === 'v' ? 'up/down' : 'left/right',
			presses: firsts.length,
			firstMs: spread(firsts),
			worstGapMs: spread(worsts),
			inputAgeMs: spread(ages),
			slow: worsts.filter((w) => w > SLOW_FRAME_MS).length,
			...ctx,
			// what became of the moves of the list, for the up and down batch: slid, or why not
			...(axis === 'v' && moves ? {listMoves: moves()} : {}),
			// cut short by leaving the app, so not an equal sample beside the full batches
			...(partial ? {partial: true} : {})
		};
		batches[axis] = empty();
		report(summary);
	};
	const step = () => {
		const at = performance.now();
		pending = pending.filter((press) => {
			const since = at - press.start;
			// The loop keeps frames coming, so the frame that closes the window is as far from the last as a stall made it
			if (press.first < 0) press.first = since;
			else press.worst = Math.max(press.worst, at - previous);
			if (since <= RESPONSE_WINDOW_MS) return true;
			// A page that was hidden or in standby comes back with a frame hours late, which says nothing about a press
			if (!press.hidden && press.first < STANDBY_MS && press.worst < STANDBY_MS) {
				// A batch is reported with the settings it was taken under, so one that spans a change says so in two
				if (batches[press.axis].ctx && !sameContext(batches[press.axis].ctx, press.ctx)) {
					// a few presses are no sample: they are let go when the settings change under them
					if (batches[press.axis].firsts.length >= MIN_REPORTED) flush(press.axis, true);
					else batches[press.axis] = empty();
				}
				const batch = batches[press.axis];
				batch.ctx = press.ctx;
				batch.firsts.push(press.first);
				batch.worsts.push(press.worst);
				batch.ages.push(press.age);
			}
			return false;
		});
		previous = at;
		if (pending.length) window.requestAnimationFrame(step);
		['v', 'h'].forEach((axis) => {
			if (batches[axis].firsts.length >= every) flush(axis);
		});
	};
	target.addEventListener('keydown', (e) => {
		if (!isArrow(e)) return;
		const at = performance.now();
		// Tizen never flags a repeat, so a key that has not come up since its last key down is a hold, unless that was long
		// ago, which is a key up that never came. Each key is followed apart, for a hold and a tap of another arrow.
		const repeat = e.repeat || (down.has(e.keyCode) && at - down.get(e.keyCode) <= HOLD_GAP_MS);
		down.set(e.keyCode, at);
		if (repeat || !report) return;
		// How old the set's stamp is when the page gets the key: the set's own delay, or a page too busy to take it. The
		// press itself is counted from here, so the two causes read apart.
		const stamp = e.timeStamp;
		const age = stamp > 0 && stamp <= at && at - stamp <= RESPONSE_STAMP_MAX_MS ? at - stamp : 0;
		pending.push({start: at, first: -1, worst: 0, age, hidden: false, axis: isVertical(e) ? 'v' : 'h', ctx: context()});
		if (pending.length === 1) {
			previous = at;
			window.requestAnimationFrame(step);
		}
	}, true);
	target.addEventListener('keyup', (e) => {
		down.delete(e.keyCode);
	}, true);
	// A page that was hidden while a press was watched answers it hours late, which says nothing about the press
	// and what was counted is not lost when the app is left: a batch of a few presses is reported as it is
	const doc = target.document || target.ownerDocument || document;
	doc.addEventListener('visibilitychange', () => {
		pending.forEach((press) => { press.hidden = true; });
		if (doc.hidden) ['v', 'h'].forEach((axis) => { if (batches[axis].firsts.length >= MIN_REPORTED) flush(axis, true); });
	});
};

export const ESSENTIAL_KEY_NAMES = [
	'MediaPlay',
	'MediaPause',
	'MediaStop',
	'MediaRewind',
	'MediaFastForward',
	'MediaPlayPause',
	// Red takes a track out of a playlist. The other color keys stay with the TV.
	'ColorF0Red',
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
