// The picture behind a details screen. It used to be asked for when the screen opened, so a screen drawn whole from a kept
// copy still waited a second or two on a black page for its backdrop to be fetched and decoded on the TV. The pictures of
// the titles that may be opened (the screens kept, and every card of Continue Watching and Next Up) are read ahead through
// the same held and decoded art the cards use (artPrefetch.js) and pinned there, so card art that keeps coming does not
// push them out, and the screen draws from memory when it opens.
import {getBackdropId, getImageUrl} from './helpers';
import {serverBlurredUrl} from './serverBlur';
import {afterHomeReady} from './homeReady';
import {artSource, decodeArt, hasArt, pinArt, prefetchArt, unpinArt} from '../components/MediaCard/artPrefetch';

// How far from focus the work is counted, so it never gets in front of what the viewer is looking at
const WARM_RANK = 12;
// The card in focus is the likeliest one to be opened, so its picture is decoded ahead before the ones read ahead for a row
const FOCUS_RANK = 6;
// The row is read two pictures at a time (a title with its blurred copy counts for two), which leaves half of the art
// scheduler's places to the cards
const FEED_PICTURES_AT_ONCE = 2;
const FEED_BUSY_MS = 2000;
// Focus has to rest this long on a card before its picture is decoded ahead, so moving along a row queues nothing
const FOCUS_REST_MS = 350;
const FEED_OWNER = 'row';

// The picture the screen asks the server for, before any blur. Seerr artwork arrives as a finished address.
export const detailsBackdropUrl = (item, serverUrl) => {
	if (!item) return null;
	if (item._externalBackdropUrl) return item._externalBackdropUrl;
	const backdropId = getBackdropId(item);
	return backdropId ? getImageUrl(serverUrl, backdropId, 'Backdrop', {maxWidth: 1920, quality: 90}) : null;
};

// What the styles of the details screen draw: the full picture, or the server's blurred copy of it (a fifth of the size),
// so both are read.
const backdropUrlsFor = (item, serverUrl, settings) => {
	if (!item || item.Type === 'Person' || settings?.detailsBackdropEnabled === false) return [];
	const plain = detailsBackdropUrl(item, serverUrl);
	if (!plain) return [];
	return [plain, serverBlurredUrl(plain, settings?.backdropBlurDetail)].filter(Boolean);
};

// What to put in an <img> for a backdrop address: the copy read ahead when there is one (in memory, decoded), else the
// address itself, as before. Every details style draws its backdrop through this, which also pins what it returns.
export const heldBackdrop = (url) => {
	if (!url) return url;
	// pinned as a screen that was kept, which ranks after every card of the rows, so a picture on screen is not let go of by
	// card art while it is open and browsing titles never pushes the cards of the rows out
	pinArt(url);
	return artSource(url) || url;
};

// Reads the picture of this title's screen ahead and decodes it once it is held, unless [decode] is false, and pins it (at
// [pinRank], the lower the likelier to be opened, for [pinOwner]; a screen that was kept pins with none). [onSettled] is told when every
// picture is held, has failed or was held already.
export const warmDetailsBackdrop = (item, serverUrl, settings, {decode = true, onSettled, pinRank, pinOwner} = {}) => {
	const urls = backdropUrlsFor(item, serverUrl, settings);
	if (!urls.length) {
		if (onSettled) onSettled();
		return false;
	}
	// one for the loop itself, so a picture that is held at once does not settle the title before the others are asked for
	let pending = 1;
	const settle = () => {
		pending -= 1;
		if (pending === 0 && onSettled) onSettled();
	};
	urls.forEach((url) => {
		pinArt(url, pinRank, pinOwner);
		if (hasArt(url)) {
			if (decode) decodeArt(url, WARM_RANK);
			return;
		}
		pending += 1;
		let told = false;
		const once = (after) => () => {
			if (told) return;
			told = true;
			if (after) after();
			settle();
		};
		prefetchArt(url, WARM_RANK, once(), once(decode ? () => decodeArt(url, WARM_RANK) : null));
	});
	settle();
	return true;
};

// The pictures the feed pinned for the cards of the rows
let fedUrls = new Set();

// The card in focus on Home is the one most likely to be opened next: once focus has rested on it for a moment, its
// backdrop is decoded if it is held.
let focusTimer = null;
export const decodeDetailsBackdrop = (item, serverUrl, settings) => {
	clearTimeout(focusTimer);
	const urls = backdropUrlsFor(item, serverUrl, settings);
	if (!urls.length) return;
	focusTimer = setTimeout(() => urls.forEach((url) => {
		if (hasArt(url)) {
			decodeArt(url, FOCUS_RANK);
		} else if (fedUrls.has(url)) {
			// a card of the row that the feed has not reached yet is read now, nearer than the rest, and decoded when it lands
			prefetchArt(url, FOCUS_RANK, null, () => decodeArt(url, FOCUS_RANK));
		}
	}), FOCUS_REST_MS);
};

const appIsBusy = () => typeof document !== 'undefined' &&
	(document.hidden || Boolean(document.querySelector('video, object[type="application/avplayer"]')));

let feedRun = 0;
let feedKey = '';

// Reads ahead the backdrops of [items] (the cards of Continue Watching and Next Up, in the order Home shows them), once
// Home has settled, a couple at a time, and waiting out playback or a hidden app. Each is pinned at the place of its card,
// so the first cards are the last to lose it. Asked again with the same cards and settings it does nothing, and with other
// cards it starts over (what is already held is passed over at once, and the pins of cards that left the row are let go).
export const feedBackdrops = (items, serverUrl, settings) => {
	const seen = new Set();
	const queue = [];
	const nextFed = new Set();
	(items || []).forEach((item) => {
		const urls = backdropUrlsFor(item, serverUrl, settings);
		if (!urls.length || seen.has(urls[0])) return;
		seen.add(urls[0]);
		urls.forEach((url) => nextFed.add(url));
		queue.push({item, rank: queue.length});
	});
	// Rows that are away for a moment (a refresh) say nothing about the cards, so what is pinned stays as it is
	if (queue.length === 0) return;
	const key = `${serverUrl}|${settings?.backdropBlurDetail}|${settings?.detailsBackdropEnabled}|${[...seen].join(',')}`;
	if (key === feedKey) return;
	feedKey = key;
	fedUrls.forEach((url) => {
		if (!nextFed.has(url)) unpinArt(url, FEED_OWNER);
	});
	fedUrls = nextFed;
	feedRun += 1;
	const run = feedRun;
	let active = 0;
	const picturesPerCard = settings?.backdropBlurDetail > 0 ? 2 : 1;
	const pump = () => {
		if (run !== feedRun) return;
		if (appIsBusy()) {
			setTimeout(pump, FEED_BUSY_MS);
			return;
		}
		while (active + picturesPerCard <= Math.max(FEED_PICTURES_AT_ONCE, picturesPerCard) && queue.length > 0) {
			const next = queue.shift();
			active += picturesPerCard;
			// the cards are only read here, and decoded when focus rests on one (decodeDetailsBackdrop)
			warmDetailsBackdrop(next.item, serverUrl, settings, {
				decode: false,
				pinRank: next.rank,
				pinOwner: FEED_OWNER,
				onSettled: () => {
					active -= picturesPerCard;
					setTimeout(pump, 0);
				}
			});
		}
	};
	afterHomeReady().then(pump);
};

// Home is gone for now (playback, sign out): nothing more is read ahead. What is held and pinned stays, since Home comes
// back with the same cards and asks again, and a feed for other cards lets go of the pins of the ones that left.
export const stopFeedingBackdrops = () => {
	feedRun += 1;
	feedKey = '';
	clearTimeout(focusTimer);
};
