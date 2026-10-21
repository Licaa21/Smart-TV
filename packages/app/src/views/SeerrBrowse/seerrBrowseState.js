// The browse screen is torn down whenever an item is opened, so what it was
// showing has to live somewhere that outlives the mount. Keyed by which browse
// it was, so coming back to Movies never inherits the filters left on TV Shows.

const cache = new Map();

// Enough for the browses one sitting realistically visits. The oldest goes when
// it fills, so a long session cant grow without end.
const MAX_ENTRIES = 12;

export const browseStateKey = (browseType, item, mediaType) =>
	`${browseType || ''}|${item?.id ?? item?.name ?? ''}|${mediaType || ''}`;

export const readBrowseState = (key) => cache.get(key) || null;

// What a screen starts from when it is mounted. A browse that was left by opening a title is kept for the return, and any
// other leave is dropped, so a fresh visit starts on the first title with the default sort and filters.
export const takeBrowseState = (key) => {
	const state = cache.get(key);
	if (state?.focusedId) return state;
	cache.delete(key);
	return null;
};

export const writeBrowseState = (key, patch) => {
	const existing = cache.get(key);
	if (!existing && cache.size >= MAX_ENTRIES) {
		cache.delete(cache.keys().next().value);
	}
	cache.set(key, {...existing, ...patch});
};

// The card an opened title was reached from is only for the one return from its details page, so it is dropped once used
export const forgetReturnPoint = (key) => {
	if (cache.has(key)) writeBrowseState(key, {focusedId: null, pagesLoaded: null});
};
