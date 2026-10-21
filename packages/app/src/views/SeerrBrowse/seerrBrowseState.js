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
