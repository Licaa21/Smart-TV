import {KIND, SETTINGS_SCHEMA, resolve, spotlightIdOf} from '../settingsSchema';

// The mock screen each setting changes. Settings missing here leave the preview on
// whatever it was showing.
export const SCENE_BY_KEY = {
	showClock: 'home',
	clockDisplay: 'home',
	navbarPosition: 'home',
	navbarAlwaysExpanded: 'home',
	showShuffleButton: 'home',
	showFavoritesButton: 'home',
	navbarColor: 'home',
	navbarOpacity: 'home',
	homeRowsStyle: 'home',
	homeRowsPosterSize: 'home',
	featuredBarStyle: 'home',
	mediaBarOverlayColor: 'home',
	mediaBarOverlayOpacity: 'home',
	detailScreenStyle: 'details',
	hideDetailsMediaDescription: 'details',
	playerZoomMode: 'player',
	showDescriptionOnPause: 'player',
	skipBackLength: 'player',
	skipForwardLength: 'player',
	subtitleMode: 'player',
	subtitleLanguage: 'player',
	introAction: 'player',
	nextUpBehavior: 'player',
	keyboardStyle: 'search'
};

// Settings whose home preview is the media bar rather than the navbar and rows.
export const MEDIA_BAR_KEYS = ['featuredBarStyle', 'mediaBarOverlayColor', 'mediaBarOverlayOpacity'];

let rowsBySpotlightId = null;

const indexRows = () => {
	const index = {};
	SETTINGS_SCHEMA.forEach((category) => {
		index[`cat-${category.id}`] = {kind: 'category', label: category.label, desc: category.description};
		category.subcategories.forEach((sub) => {
			index[`subcat-${sub.id}`] = {kind: 'subcategory', label: sub.label, desc: sub.description};
			(sub.rows || []).forEach((row) => {
				if (row && (row.key || row.id) && row.kind !== KIND.SECTION && row.kind !== KIND.DIVIDER) {
					index[spotlightIdOf(row)] = row;
				}
			});
		});
	});
	return index;
};

const safeResolve = (value, ctx, fallback) => {
	try {
		const resolved = resolve(value, ctx);
		return resolved == null ? fallback : resolved;
	} catch (e) {
		return fallback;
	}
};

// What the inspector shows for the row with [spotlightId]: its name, description, scene,
// and for a picker every choice with the saved one marked.
export const describeRow = (spotlightId, settings) => {
	if (!spotlightId) return null;
	if (!rowsBySpotlightId) rowsBySpotlightId = indexRows();
	const row = rowsBySpotlightId[spotlightId];
	if (!row) return null;
	const ctx = {settings};
	const resolved = row.kind === KIND.OPTION ? safeResolve(row.options, ctx, []) : [];
	const options = Array.isArray(resolved) ? resolved : [];
	return {
		key: row.key || null,
		title: safeResolve(row.label, ctx, ''),
		description: safeResolve(row.desc, ctx, ''),
		scene: row.key ? SCENE_BY_KEY[row.key] || null : null,
		options,
		saved: options.findIndex((option) => option.value === settings[row.key])
	};
};
