import Spotlight from '@enact/spotlight';

// Leaving the navigation means handing focus to whatever view is mounted, and
// only that view knows which container it uses. Rather than ask, both
// navigations walk this list in order and take the first one that exists.
export const CONTENT_FOCUS_TARGETS = [
	'featured-banner',
	'row-0',
	'categories-view',
	'category-view',
	'subcategory-view',
	'options-view',
	'homerows-view',
	'libraries-view',
	'favorites-active-tab',
	'favorites-grid',
	'genres-grid',
	'genre-browse-grid',
	'library-letter-hash',
	'library-grid',
	'person-grid',
	'discover-row-0',
	'seerr-browse-grid',
	'hub-tabs',
	'action-buttons',
	'details-primary-btn',
	'details-favorite-btn',
	'person-overview',
	'person-action-favorite',
	'search-input',
	'livetv-guide'
];

// The sidebar enters the details screen from the side, where the whole button
// row is the natural landing spot. The top bar comes down onto it and wants an
// individual button instead, so it skips this extra entry.
const detailsRowIndex = CONTENT_FOCUS_TARGETS.indexOf('action-buttons') + 1;
export const SIDEBAR_CONTENT_FOCUS_TARGETS = [
	...CONTENT_FOCUS_TARGETS.slice(0, detailsRowIndex),
	'details-action-buttons',
	...CONTENT_FOCUS_TARGETS.slice(detailsRowIndex)
];

// Where focus was last in the view that is up, so leaving the navigation for it comes back to that card and not to the
// first row. A view that keeps its place sets it as focus moves and clears it when it goes away. It is the card itself,
// since an id built from a title can be anything and focusing by it would read it as a selector.
let contentFocusHint = null;
export const setContentFocusHint = (element) => {
	contentFocusHint = element || null;
};

// Falls back to a plain directional move when no known container is mounted.
export const focusFirstContentTarget = (targets, fallbackDirection) => {
	if (contentFocusHint && contentFocusHint.isConnected && Spotlight.focus(contentFocusHint)) return;
	for (const target of targets) {
		if (Spotlight.focus(target)) return;
	}
	Spotlight.setPointerMode(false);
	Spotlight.move(fallbackDirection);
};
