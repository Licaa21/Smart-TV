// Wide art fetched ahead of the cards that will wear it, so a card opens with its picture the moment focus lands.
//
// Fetches go nearest card first and only a few at a time, so the card about to be reached never waits behind
// ones that were asked for earlier and sit further off, or behind cards focus has already passed. The rank of
// a request is how near its card is to focus, and moves as focus does. Cards asking for the same picture share
// one request.
//
// The pictures are kept here as blobs and handed to the card as a local address. The TV's own image cache is
// small and let go of pictures fetched ahead before the card came to use them, which showed as the picture
// drawing in from the top as it downloaded. Where a picture can't be read this way (no fetch, or an address that
// does not allow it) it is loaded the plain way and the card asks the network for it as it used to.

const MAX_ACTIVE = 4;
// A request that has not answered by now is let go, so it does not hold one of the places for good.
const FETCH_TIMEOUT_MS = 15000;

// What is held, by address. The oldest goes first, and a picture the focused card draws is the newest again.
const MAX_BYTES = 24 * 1024 * 1024;
const MAX_HELD = 150;
// A held address is given up this long after it left, so a card still loading from it is not cut off.
const REVOKE_DELAY_MS = 10000;
const held = new Map();
// The nearest pictures are decoded ahead. A held copy is only bytes: drawn the first time, a large picture was
// decoded as it was painted, and a TV's slow decoder showed that as the picture drawing in from the top. The images
// are kept here so what was decoded is not let go before the card draws it.
const DECODED_MAX = 6;
const decoded = new Map();

let heldBytes = 0;
// The picture the focused card draws, which is never the one let go.
let drawnUrl = null;

// Art that came in the plain way, and addresses that are loaded that way for a while after a read failed.
const ART_MEMORY = 200;
const PLAIN_MS = 5 * 60 * 1000;
const loaded = new Set();
const plainUntil = new Map();
const PLAIN_MAX = 300;
// A host that several addresses could not be read from is loaded the plain way for a while, a lone failure being
// as likely a dropped connection as a host that allows no read.
const HOST_FAILURES = 3;
const plainHostUntil = new Map();
const hostFailures = new Map();

const hostOf = (url) => {
	const match = /^(?:[a-z]+:)?\/\/[^/]+/i.exec(url);
	return match ? match[0] : '';
};

const markPlain = (url) => {
	plainUntil.delete(url);
	plainUntil.set(url, Date.now() + PLAIN_MS);
	if (plainUntil.size > PLAIN_MAX) plainUntil.delete(plainUntil.keys().next().value);
};

const canFetch = () => typeof window !== 'undefined' && typeof window.fetch === 'function' &&
	typeof window.AbortController === 'function' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';

const stillPlain = (map, key) => {
	const until = map.get(key);
	if (until === undefined) return false;
	if (until < Date.now()) {
		map.delete(key);
		return false;
	}
	return true;
};

const isPlain = (url) => stillPlain(plainUntil, url) || (hostOf(url) !== '' && stillPlain(plainHostUntil, hostOf(url)));

const readsAsBlob = (url) => canFetch() && !isPlain(url);

export const rememberArt = (url) => {
	loaded.delete(url);
	loaded.add(url);
	if (loaded.size > ART_MEMORY) loaded.delete(loaded.values().next().value);
};

const release = (blobUrl) => {
	setTimeout(() => URL.revokeObjectURL(blobUrl), REVOKE_DELAY_MS);
};

const hold = (url, blob) => {
	const old = held.get(url);
	if (old) {
		heldBytes -= old.size;
		release(old.blobUrl);
		held.delete(url);
	}
	held.set(url, {blobUrl: URL.createObjectURL(blob), size: blob.size, blob});
	heldBytes += blob.size;
	while (held.size > 1 && (heldBytes > MAX_BYTES || held.size > MAX_HELD)) {
		const oldest = [...held.keys()].find((key) => key !== drawnUrl && key !== url);
		if (oldest === undefined) break;
		const entry = held.get(oldest);
		held.delete(oldest);
		decoded.delete(oldest);
		heldBytes -= entry.size;
		release(entry.blobUrl);
	}
};

// Whether the card has art to draw: a held copy, or art that came in the plain way for an address read that way.
export const hasArt = (url) => held.has(url) || (!readsAsBlob(url) && loaded.has(url));

// What the card draws the art from: the held copy, the address itself when it can only be loaded that way, and
// null while a held copy is still to come, when the card has nothing to ask the network for.
export const artSource = (url) => {
	const entry = held.get(url);
	if (entry) {
		// Handed out to be drawn, so it is not the one let go
		drawnUrl = url;
		return entry.blobUrl;
	}
	return readsAsBlob(url) ? null : url;
};

// The focused card is drawing this: it goes to the back of the line to be let go.
export const touchArt = (url) => {
	drawnUrl = url;
	const entry = held.get(url);
	if (entry) {
		held.delete(url);
		held.set(url, entry);
	}
};

// The nearest pictures are decoded ahead the plain way, one at a time and nearest first. A TV decodes slowly and on one
// thread: several at once held it up for seconds, and so did making bitmaps of them (1.7.2 and 1.8.0 logged 0.6 to 3
// seconds a picture), which stalled the rest of the app with it.
const DECODE_QUEUE_MAX = 6;
const DECODE_TIMEOUT_MS = 3000;
const decodeQueue = new Map();
let decoding = false;

const pumpDecode = () => {
	if (decoding || typeof window === 'undefined' || typeof window.Image !== 'function') return;
	let nearest = null;
	decodeQueue.forEach((job, queued) => {
		if (!nearest || job.rank < nearest.job.rank) nearest = {url: queued, job};
	});
	if (!nearest) return;
	const {url} = nearest;
	decodeQueue.delete(url);
	const entry = held.get(url);
	if (!entry) {
		pumpDecode();
		return;
	}
	decoding = true;
	const since = Date.now();
	let timer = null;
	let finished = false;
	// Only a decode that ended well is counted, so the report's times are the TV's and not the limit or a broken picture
	const finish = (ok) => {
		if (finished) return;
		finished = true;
		clearTimeout(timer);
		if (ok) noteArtDecoded(url, Date.now() - since); // eslint-disable-line no-use-before-define
		decoding = false;
		pumpDecode();
	};
	timer = setTimeout(() => finish(false), DECODE_TIMEOUT_MS);
	try {
		const img = new window.Image();
		img.src = entry.blobUrl;
		decoded.set(url, {img, blobUrl: entry.blobUrl});
		if (decoded.size > DECODED_MAX) decoded.delete(decoded.keys().next().value);
		if (typeof img.decode === 'function') img.decode().then(() => finish(true), () => finish(false));
		else finish(true);
	} catch (err) {
		finish(false);
	}
};

const waiting = [];
const active = new Set();

const rankOf = (entry) => {
	let best = Infinity;
	entry.holders.forEach((holder) => {
		if (holder.rank < best) best = holder.rank;
	});
	return best;
};

const findEntry = (url) => waiting.find((entry) => entry.url === url) || [...active].find((entry) => entry.url === url) || null;

// Where a picture stands, for the report: held, loaded, running, waiting, or none when nothing is asking for it.
export const artState = (url) => {
	if (held.has(url)) return 'held';
	if (loaded.has(url)) return 'loaded';
	if ([...active].some((entry) => entry.url === url)) return 'running';
	if (waiting.some((entry) => entry.url === url)) return 'waiting';
	return 'none';
};

let sink = null;
// Where the report hears of what happened to a picture a card was waiting for.
export const setArtLogSink = (next) => {
	sink = next;
};
export const logArt = (message, context) => sink?.(message, context);

const startPlain = (entry, finish) => {
	const art = new window.Image();
	const timer = setTimeout(() => {
		art.onload = null;
		art.onerror = null;
		art.src = '';
		finish(-1);
	}, FETCH_TIMEOUT_MS);
	entry.cancelRequest = () => {
		clearTimeout(timer);
		art.onload = null;
		art.onerror = null;
		art.src = '';
	};
	art.onload = () => {
		clearTimeout(timer);
		rememberArt(entry.url);
		finish();
	};
	art.onerror = () => {
		clearTimeout(timer);
		finish(0);
	};
	art.src = entry.url;
};

const startFetch = (entry, finish) => {
	const controller = new window.AbortController();
	let timedOut = false;
	const timer = setTimeout(() => {
		timedOut = true;
		controller.abort();
	}, FETCH_TIMEOUT_MS);
	entry.cancelRequest = () => {
		clearTimeout(timer);
		controller.abort();
	};
	window.fetch(entry.url, {signal: controller.signal, credentials: 'omit'})
		.then((response) => {
			if (!response.ok) {
				const error = new Error('status');
				error.status = response.status;
				throw error;
			}
			return response.blob();
		})
		.then((blob) => {
			clearTimeout(timer);
			if (entry.dropped) return;
			try {
				hold(entry.url, blob);
			} catch {
				// Memory for it ran out: the picture is loaded the plain way instead
				markPlain(entry.url);
				startPlain(entry, finish);
				return;
			}
			finish();
		}, (error) => {
			clearTimeout(timer);
			if (entry.dropped) return;
			if (error && error.status) {
				// The server answered with no picture. A 404 is the plugin saying it has none, and the card goes to its
				// backdrop; anything else may pass, and the card asks the network itself for a while.
				markPlain(entry.url);
				finish(error.status);
			} else if (timedOut) {
				markPlain(entry.url);
				finish(-1);
			} else {
				// Not readable this way (the host allows no read, or the connection broke): this picture is loaded the plain
				// way for a while, and the host too once it has failed a few
				const host = hostOf(entry.url);
				const failures = (hostFailures.get(host) || 0) + 1;
				hostFailures.set(host, failures);
				if (host && failures >= HOST_FAILURES) plainHostUntil.set(host, Date.now() + PLAIN_MS);
				markPlain(entry.url);
				startPlain(entry, finish);
			}
		});
};

const pump = () => {
	while (active.size < MAX_ACTIVE && waiting.length > 0) {
		let next = 0;
		for (let i = 1; i < waiting.length; i++) {
			if (rankOf(waiting[i]) < rankOf(waiting[next])) next = i;
		}
		const entry = waiting.splice(next, 1)[0];
		active.add(entry);
		// The status the request ended on, when it ended with no picture
		const finish = (status) => {
			active.delete(entry);
			entry.cancelRequest = null;
			const holders = [...entry.holders];
			if (status !== undefined) holders.forEach((holder) => holder.onFail?.(status));
			holders.forEach((holder) => holder.onDone?.());
			pump();
		};
		if (readsAsBlob(entry.url)) startFetch(entry, finish);
		else startPlain(entry, finish);
	}
};

// Asks for the art at url. onFail hears of a request that came back with nothing: the status the server answered
// with, 0 for a picture that would not load, -1 for one that did not answer in time. onDone hears of any that is
// over. The handle moves the rank of the ask, and drops it: the request goes when no one is asking for it any more.
export const prefetchArt = (url, rank, onFail, onDone) => {
	const holder = {rank, onFail, onDone};
	let entry = findEntry(url);
	if (entry) {
		entry.holders.add(holder);
	} else {
		entry = {url, holders: new Set([holder]), cancelRequest: null, dropped: false};
		waiting.push(entry);
	}
	const mine = entry;
	pump();
	return {
		setRank: (next) => {
			holder.rank = next;
		},
		cancel: () => {
			mine.holders.delete(holder);
			if (mine.holders.size > 0) return;
			const at = waiting.indexOf(mine);
			if (at >= 0) {
				waiting.splice(at, 1);
			} else if (active.has(mine)) {
				mine.dropped = true;
				mine.cancelRequest?.();
				active.delete(mine);
				pump();
			}
		}
	};
};

// What the report is told, without the address, which carries the viewer's token.
const kindOf = (url) => {
	if (url.indexOf('/Moonfin/Tmdb/Thumb') >= 0) return 'thumb';
	return url.indexOf('image.tmdb.org') >= 0 ? 'tmdb' : 'library';
};

const FOCUSES_PER_SUMMARY = 25;
const LATE_LINES_PER_SUMMARY = 5;
let focuses = 0;
let lateLines = 0;
let arrivedLines = 0;
let tally = {};

const rowFor = (kind) => tally[kind] || (tally[kind] = {ready: 0, late: 0, plain: 0, decodes: 0, decodeMs: 0, decodeMax: 0});

// What the summary says: per kind, the cards that had their art and those that had not, the pictures that were loaded
// the plain way, and how long the TV took to decode a picture it drew.
const summary = () => {
	const out = {};
	Object.keys(tally).forEach((kind) => {
		const row = tally[kind];
		out[kind] = {ready: row.ready, late: row.late, plain: row.plain, decoded: row.decodes, decodeAvgMs: row.decodes ? Math.round(row.decodeMs / row.decodes) : 0, decodeMaxMs: row.decodeMax};
	});
	return out;
};

// A card that grows into wide art has just been focused: whether the art was there, or what became of it.
export const noteArtFocus = (url) => {
	const kind = kindOf(url);
	const ready = hasArt(url);
	const row = rowFor(kind);
	if (!readsAsBlob(url)) row.plain += 1;
	if (ready) {
		row.ready += 1;
	} else {
		row.late += 1;
		if (lateLines < LATE_LINES_PER_SUMMARY) {
			lateLines += 1;
			logArt('Wide art not ready at focus', {kind, state: artState(url), held: held.size, active: active.size, waiting: waiting.length});
		}
	}
	focuses += 1;
	if (focuses >= FOCUSES_PER_SUMMARY) {
		logArt('Wide art summary', summary());
		focuses = 0;
		lateLines = 0;
		arrivedLines = 0;
		tally = {};
	}
	return ready;
};

// The TV finished decoding the picture a card drew, ms after it was drawn.
export const noteArtDecoded = (url, ms) => {
	const row = rowFor(kindOf(url));
	row.decodes += 1;
	row.decodeMs += ms;
	if (ms > row.decodeMax) row.decodeMax = ms;
};

// It came in after the card was focused, ms later.
export const noteArtArrived = (url, ms) => {
	if (arrivedLines >= LATE_LINES_PER_SUMMARY) return;
	arrivedLines += 1;
	logArt('Wide art arrived late', {kind: kindOf(url), ms});
};

// A card that focus has left no longer wants its picture decoded ahead.
export const dropDecode = (url) => {
	decodeQueue.delete(url);
};

// Asks for the held picture to be decoded ahead, nearest card first, one at a time. Nothing happens for a picture that
// is not held yet: the card asks again when it arrives.
export const decodeArt = (url, rank = 0) => {
	const entry = held.get(url);
	if (!entry || typeof window === 'undefined') return;
	const known = decoded.get(url);
	if (known && known.blobUrl === entry.blobUrl) {
		decoded.delete(url);
		decoded.set(url, known);
		return;
	}
	decodeQueue.set(url, {rank});
	while (decodeQueue.size > DECODE_QUEUE_MAX) {
		let farthest = null;
		decodeQueue.forEach((job, other) => {
			if (!farthest || job.rank > farthest.rank) farthest = {url: other, rank: job.rank};
		});
		decodeQueue.delete(farthest.url);
	}
	pumpDecode();
};
