// The details screen of a title, kept as it was when it had finished loading, so opening the same title again
// draws it whole at once instead of from the row it was opened from and filling in. Screens are kept for two days and
// between runs of the app (detailsStore.js). One is only taken back while nothing it was made from can have changed:
// the watched state, resume position and favorite of the title the card it is opened from shows have to be what they
// were, the title's own user data has not moved since (userDataSync tells), Home was not refreshed, and the account, settings and parental rules are the same. Anything else opens the screen the normal way.
// A screen that was kept more than a few minutes ago, or before something else was played or marked watched, is drawn
// at once and then read again quietly (the caller finds out from `fresh`), since a new episode, an episode finished
// or a change made on another device does not show on the card it is opened from.
import * as userDataSync from '../../services/userDataSync';
import {getBlockedRatings, getBlockedSeriesIds} from '../../services/parentalControls';
import {clearScreens, deleteScreen, loadScreens, putScreen} from './detailsStore';

const TTL_MS = 2 * 24 * 60 * 60 * 1000;
// Younger than this a kept screen is as good as a fresh read and is not read again
const FRESH_MS = 3 * 60 * 1000;
const MAX_ENTRIES = 24;
const PERSIST_DELAY_MS = 1500;
// Moves when what a kept screen holds changes shape, so one kept by an older build is dropped and never restored with a field missing
const SCHEMA = 1;
// The titles whose screens are only their own record and the rows hanging off it. Collections, playlists, music and
// people carry paging and ordering state of their own and always load.
const CACHEABLE_TYPES = ['Movie', 'Episode', 'Series', 'Season', 'Video'];

const entries = new Map();
const savedListeners = new Set();
const persistTimers = new Map();
// Moves when the cache is cleared, so a read of the store that was out before it does not fill it after
let generation = 0;
// Moves whenever user data changes anywhere, which is a way a screen that was kept can be out of date without its own
// title changing (a series' episode finished, a season marked watched), so such a screen is read again behind it.
let dataVersion = 0;
userDataSync.subscribe(() => { dataVersion += 1; });

const forget = (key) => {
	entries.delete(key);
	if (persistTimers.has(key)) {
		clearTimeout(persistTimers.get(key));
		persistTimers.delete(key);
	}
	deleteScreen(key);
};

const clear = () => {
	generation += 1;
	entries.clear();
	persistTimers.forEach((timer) => clearTimeout(timer));
	persistTimers.clear();
	clearScreens();
};

// A refresh of Home or a change of its rows says what was kept may be out of date, so every kept screen is read again behind
// itself when it is next opened, and none is thrown away: a favorite toggled or Home pressed does not cost two days of screens.
const markAllStale = () => entries.forEach((entry) => { entry.version = -1; });
if (typeof window !== 'undefined') {
	['moonfin:browseRefresh', 'moonfin:homeRowsChanged'].forEach((name) => window.addEventListener(name, markAllStale));
}
export const clearDetailsCache = clear;

// One screen goes, from memory and from the store (its title is gone from the server, say)
export const dropKeptScreen = (key) => forget(key);

export const isCacheableType = (item) => CACHEABLE_TYPES.indexOf(item?.Type) >= 0;

// What a screen is made from apart from the title: the settings that change which rows it loads, the rules that filter
// them (blocked ratings and series, Kids Mode), and the account.
export const detailsKey = (serverUrl, userId, itemId, settings) => [
	serverUrl, userId, itemId, settings?.detailScreenStyle, settings?.recommendationSystemSource, settings?.uiLanguage,
	settings?.rememberSeriesAudio, settings?.subtitleMode, settings?.subtitleLanguage, settings?.hiddenDetailSectionsTv,
	settings?.kidsModeEnabled === true, settings?.useMoonfinPlugin, settings?.tmdbEpisodeRatingsEnabled,
	Array.from(getBlockedRatings()).join(','), Array.from(getBlockedSeriesIds()).join(',')
].join('|');

const flag = (value) => (value ? 1 : 0);

// The user data of an item, laid over with what this client knows is newer. A card and the full record of the same
// title do not always carry the same unplayed count (a Home row has none for a series), so [withCount] leaves it out
// where one is set against the other.
export const userDataStamp = (item, withCount = true) => {
	if (!item) return '';
	const data = (userDataSync.apply(item) || item).UserData || {};
	const parts = [flag(data.Played), Number(data.PlaybackPositionTicks) || 0, flag(data.IsFavorite)];
	if (withCount) parts.push(Number(data.UnplayedItemCount) || 0);
	return parts.join('|');
};

const trim = () => {
	while (entries.size > MAX_ENTRIES) {
		// the one kept longest ago goes
		let oldest = null;
		entries.forEach((entry, key) => {
			if (oldest === null || entry.at < entries.get(oldest).at) oldest = key;
		});
		forget(oldest);
	}
};

const persistLater = (key) => {
	if (persistTimers.has(key)) clearTimeout(persistTimers.get(key));
	persistTimers.set(key, setTimeout(() => {
		persistTimers.delete(key);
		const entry = entries.get(key);
		if (!entry) return;
		// The copy a store makes of a screen is some work for the main thread, so it waits for a moment nothing else wants it
		const write = () => {
			// dropped while it waited for its moment, so it is not put back
			if (entries.get(key) === entry) putScreen({v: SCHEMA, key, at: entry.at, stamp: entry.stamp, seedStamp: entry.seedStamp, snapshot: entry.snapshot});
		};
		if (typeof window !== 'undefined' && window.requestIdleCallback) window.requestIdleCallback(write, {timeout: 10000});
		else write();
	}, PERSIST_DELAY_MS));
};

// [seed] is the card the screen was opened from, whose own user data is what the next card is compared with.
export const saveDetails = (key, snapshot, seed = null) => {
	if (!isCacheableType(snapshot?.item)) return;
	// A title of one of several servers is tagged with that server's access token, which is not stored
	if (snapshot.item._serverUrl) return;
	entries.set(key, {
		at: Date.now(),
		version: dataVersion,
		stamp: userDataStamp(snapshot.item),
		seedStamp: seed && seed.Id === snapshot.item.Id ? userDataStamp(seed) : null,
		snapshot
	});
	trim();
	persistLater(key);
	savedListeners.forEach((listener) => listener(key));
};

// Told whenever a screen has been kept, which is how the one filling them in ahead of time knows to go on.
export const onDetailsKept = (listener) => {
	savedListeners.add(listener);
	return () => savedListeners.delete(listener);
};

// The screens kept in an earlier run of the app, read once the app has started. Those already kept in this run stay.
export const loadKeptScreens = async () => {
	const readAt = generation;
	const stored = await loadScreens();
	if (readAt !== generation) return;
	const now = Date.now();
	stored
		.filter((entry) => entry && entry.key)
		.sort((a, b) => (b.at || 0) - (a.at || 0))
		.forEach((entry) => {
			// aged out, kept by another build, or beyond what is held: gone from the store too
			if (entry.v !== SCHEMA || !entry.snapshot || now - entry.at > TTL_MS || (!entries.has(entry.key) && entries.size >= MAX_ENTRIES)) {
				if (!entries.has(entry.key)) deleteScreen(entry.key);
				return;
			}
			if (entries.has(entry.key)) return;
			// kept in an earlier run, so it is read again behind itself the first time it is opened in this one
			entries.set(entry.key, {at: entry.at, version: -1, stamp: entry.stamp, seedStamp: entry.seedStamp, snapshot: entry.snapshot});
		});
};

// How long ago the screen of this title was kept, or null when it was not.
export const keptAge = (key) => {
	const entry = entries.get(key);
	return entry ? Date.now() - entry.at : null;
};

// The kept screen for this title, or null when it is not there or something it was made from has changed. [seed] is the
// row the title is being opened from, where there is one. `fresh` says whether it was kept a moment ago, or is old enough
// to be read again quietly behind it.
export const readDetails = (key, seed) => {
	const entry = entries.get(key);
	if (!entry) return null;
	if (Date.now() - entry.at > TTL_MS) {
		forget(key);
		return null;
	}
	// The record itself, laid over with what is known now, has to read as it did when it was kept
	if (userDataStamp(entry.snapshot.item) !== entry.stamp) {
		forget(key);
		return null;
	}
	// And so does the card it is opened from, which is where a change made on another device shows first. A card is
	// set against the card the screen was kept from, and against the record only when that one had no card.
	if (seed && seed.Id === entry.snapshot.item.Id) {
		const same = entry.seedStamp !== null
			? userDataStamp(seed) === entry.seedStamp
			: userDataStamp(seed, false) === userDataStamp(entry.snapshot.item, false);
		if (!same) return null;
	}
	return {...entry.snapshot, fresh: Date.now() - entry.at < FRESH_MS && entry.version === dataVersion};
};
