// The details screen of a title, kept as it was when it had finished loading, so opening the same title again
// draws it whole at once instead of from the row it was opened from and filling in. It is only taken back while
// nothing it was made from can have changed: the watched state, resume position and favorite of the title the
// screen was opened from have to be what they were, nothing the app knows about played, watched or favorited has
// moved since (userDataSync tells), Home was not refreshed, and a few minutes have not gone by. Anything else
// opens the screen the normal way.
import * as userDataSync from '../../services/userDataSync';
import {getBlockedRatings, getBlockedSeriesIds} from '../../services/parentalControls';

const TTL_MS = 3 * 60 * 1000;
const MAX_ENTRIES = 12;
// The titles whose screens are only their own record and the rows hanging off it. Collections, playlists, music and
// people carry paging and ordering state of their own and always load.
const CACHEABLE_TYPES = ['Movie', 'Episode', 'Series', 'Season', 'Video'];

const entries = new Map();
// Moves whenever user data changes anywhere, which is the one way a screen that was kept can be wrong without its
// own title changing (a series' episode finished, a season marked watched).
let dataVersion = 0;
userDataSync.subscribe(() => { dataVersion += 1; });

const clear = () => entries.clear();
if (typeof window !== 'undefined') {
	['moonfin:browseRefresh', 'moonfin:homeRowsChanged'].forEach((name) => window.addEventListener(name, clear));
}
export const clearDetailsCache = clear;

export const isCacheableType = (item) => CACHEABLE_TYPES.indexOf(item?.Type) >= 0;

// What a screen is made from apart from the title: the settings that change which rows it loads, the rules that filter
// them (blocked ratings and series, Kids Mode), and the account.
export const detailsKey = (serverUrl, userId, itemId, settings) => [
	serverUrl, userId, itemId, settings?.detailScreenStyle, settings?.recommendationSystemSource, settings?.uiLanguage,
	settings?.rememberSeriesAudio, settings?.subtitleMode, settings?.subtitleLanguage, settings?.hiddenDetailSectionsTv,
	settings?.kidsModeEnabled === true, Array.from(getBlockedRatings()).join(','), Array.from(getBlockedSeriesIds()).join(',')
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

// [seed] is the card the screen was opened from, whose own user data is what the next card is compared with.
export const saveDetails = (key, snapshot, seed = null) => {
	if (!isCacheableType(snapshot?.item)) return;
	entries.delete(key);
	entries.set(key, {
		at: Date.now(),
		version: dataVersion,
		stamp: userDataStamp(snapshot.item),
		seedStamp: seed && seed.Id === snapshot.item.Id ? userDataStamp(seed) : null,
		snapshot
	});
	while (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value);
};

// The kept screen for this title, or null when it is not there or something it was made from has changed. [seed] is the
// row the title is being opened from, where there is one.
export const readDetails = (key, seed) => {
	const entry = entries.get(key);
	if (!entry) return null;
	if (Date.now() - entry.at > TTL_MS || entry.version !== dataVersion) {
		entries.delete(key);
		return null;
	}
	// The record itself, laid over with what is known now, has to read as it did when it was kept
	if (userDataStamp(entry.snapshot.item) !== entry.stamp) {
		entries.delete(key);
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
	return entry.snapshot;
};
