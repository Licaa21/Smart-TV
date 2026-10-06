// The labels a library puts on anime: the genre list and the tags, on the item or on its series.
export const hasAnimeLabel = (item) => [
	...(item?.Genres || []),
	...(item?.GenreItems || []).map((genre) => genre?.Name),
	...(item?.Tags || []),
	...(item?.SeriesGenres || [])
].some((label) => String(label || '').trim().toLowerCase() === 'anime');

/**
 * The audio settings a title is picked with. Anime has a language of its own, and where that is left
 * empty it follows the default one, so nothing changes until it is set.
 * @param {Object} settings - the app settings
 * @param {boolean} anime - whether the title is anime
 * @returns {Object} settings to hand to selectPreferredAudioStream
 */
export const audioSettingsFor = (settings, anime) => {
	if (!anime || !settings?.animeAudioLanguage) return settings;
	return {
		...settings,
		audioLanguage: settings.animeAudioLanguage,
		fallbackAudioLanguage: settings.animeFallbackAudioLanguage || ''
	};
};
