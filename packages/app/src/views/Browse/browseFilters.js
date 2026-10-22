// The rules that decide what makes it onto the home screen: which libraries are offered,
// which items the viewer has hidden, and which genres they have excluded.

import $L from '@enact/i18n/$L';

export const EXCLUDED_COLLECTION_TYPES = ['boxsets', 'books', 'musicvideos', 'homevideos', 'photos'];

export const FAVORITE_ROW_CONFIGS = [
	{id: 'favoriteMovies', title: $L('Favorite Movies'), includeItemTypes: 'Movie', type: 'portrait'},
	{id: 'favoriteSeries', title: $L('Favorite Series'), includeItemTypes: 'Series', type: 'portrait'},
	{id: 'favoriteEpisodes', title: $L('Favorite Episodes'), includeItemTypes: 'Episode', type: 'landscape'},
	{id: 'favoritePeople', title: $L('Favorite People'), includeItemTypes: 'Person', type: 'portrait'},
	{id: 'favoriteArtists', title: $L('Favorite Artists'), includeItemTypes: 'MusicArtist', type: 'square'},
	{id: 'favoriteMusicVideos', title: $L('Favorite Music Videos'), includeItemTypes: 'MusicVideo', type: 'landscape'},
	{id: 'favoriteAlbums', title: $L('Favorite Albums'), includeItemTypes: 'MusicAlbum', type: 'square'},
	{id: 'favoriteSongs', title: $L('Favorite Songs'), includeItemTypes: 'Audio', type: 'square'}
];

export const parseHiddenMap = (val) => {
	if (!val) return {};
	try {
		return typeof val === 'string' ? JSON.parse(val) : val;
	} catch (e) {
		return {};
	}
};

// seriesOnly keys on the series id only, otherwise it falls back to the item id.
export const isHiddenByMap = (item, hiddenMap, seriesOnly) => {
	const key = seriesOnly ? item.SeriesId : (item.SeriesId || item.Id);
	if (!key || !hiddenMap[key]) return false;
	// Hide timestamps are stored as ISO strings, so parse before comparing.
	const hideTimeMs = Date.parse(hiddenMap[key]);
	// An unparseable hide timestamp can't be reasoned about, so treat it as not hidden
	// rather than hiding the item permanently.
	if (!Number.isFinite(hideTimeMs)) return false;
	const lastPlayed = item.UserData?.LastPlayedDate;
	if (lastPlayed) {
		const lastPlayedMs = Date.parse(lastPlayed);
		if (lastPlayedMs > hideTimeMs) return false;
	}
	return true;
};

export const getItemGenreNames = (item) => {
	if (!item || typeof item !== 'object') return [];
	const directGenres = Array.isArray(item.Genres) ? item.Genres : [];
	const genreItems = Array.isArray(item.GenreItems)
		? item.GenreItems.map((genreItem) => genreItem?.Name).filter(Boolean)
		: [];
	return [...directGenres, ...genreItems]
		.map((name) => String(name).trim().toLowerCase())
		.filter(Boolean);
};

// An item with no genres at all is kept, since there is nothing to match against and
// dropping it would hide everything the server has not tagged.
export const filterItemsByExcludedGenres = (items, excludedGenres) => {
	const excluded = Array.isArray(excludedGenres)
		? excludedGenres.map((genre) => String(genre).trim().toLowerCase()).filter(Boolean)
		: [];
	if (excluded.length === 0) return items;
	const excludedSet = new Set(excluded);
	return items.filter((item) => {
		const genres = getItemGenreNames(item);
		if (genres.length === 0) return true;
		return !genres.some((genre) => excludedSet.has(genre));
	});
};

// Picks an arbitrary but repeatable index for a name, so a genre lands on the same
// representative item every load and the server can serve a thumbnail it has already
// generated. Re-rolling at random asks it to decode and resize artwork it has never seen
// before, every single time.
export const stableIndex = (seed, length) => {
	if (length <= 0) return 0;
	let hash = 0;
	for (let i = 0; i < seed.length; i++) {
		hash = (Math.imul(hash, 31) + seed.charCodeAt(i)) | 0;
	}
	return Math.abs(hash) % length;
};
