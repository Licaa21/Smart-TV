import {getImageUrl, moonfinPing} from '../../services/seerrApi';
import {fetchTmdbDetails} from '../../services/externalRowsApi';
import {getActiveParentalFilter} from '../../services/parentalControls';
import {IMDB_PRESETS, TMDB_PRESETS, fetchCustomHomeRow, fetchExternalPresetRow} from '../../utils/externalHomeRows';
import {withoutBlockedOrUnrated} from '../../utils/parentalFilter';
import {shuffleArray} from '../Details/detailsMedia';
import {matchesContentType} from './browseFilters';

// The outside lists the media bar can draw from, under the ids every client stores them by:
// the IMDb charts by chart name, the TMDB charts by their home row id, then the viewer's own
// lists. The TMDB charts need a TMDB key on the server.
export const mediaBarExternalListOptions = (customRows = [], tmdbAvailable = false) => [
	...IMDB_PRESETS.map((preset) => ({Id: preset.type, Name: preset.title})),
	...(tmdbAvailable ? TMDB_PRESETS.map((preset) => ({Id: preset.id, Name: preset.title})) : []),
	...customRows.map((row) => ({Id: row.id, Name: row.name}))
];

// The whole list goes in the pool rather than the first few a home row shows. An id this TV
// has no list for, like a custom row made on another client, comes back empty.
const fetchList = (id, customRows, language) => {
	const options = {language, limit: Infinity};
	const custom = customRows.find((row) => row.id === id);
	if (custom) return fetchCustomHomeRow(custom, options);
	const imdb = IMDB_PRESETS.find((preset) => preset.type === id);
	return fetchExternalPresetRow(imdb ? imdb.id : id, options);
};

// TMDB numbers movies and shows separately, so the type is part of what makes a title unique.
const titleKey = (item) => {
	const id = item.ProviderIds?.Tmdb || item.ProviderIds?.Imdb;
	return id ? `${item.Type}:${id}` : null;
};

// The list titles the bar may show, once each. A title with no backdrop can still get one from
// TMDB when the plugin can look it up.
export const externalPool = (items, contentType, detailsSupported) => {
	const seen = new Set();
	const pool = items.filter((item) => {
		const key = titleKey(item);
		if (!key || seen.has(key)) return false;
		seen.add(key);
		return matchesContentType(item, contentType) && Boolean(item._externalBackdropUrl || detailsSupported);
	});
	return withoutBlockedOrUnrated(pool, getActiveParentalFilter());
};

// A list title dressed as a slide from what TMDB knows about it. Null when there is still no
// backdrop to show.
export const toExternalSlide = (item, details) => {
	const backdrop = details?.backdropPath ? getImageUrl(details.backdropPath, 'w1280') : item._externalBackdropUrl;
	if (!backdrop) return null;
	return {
		...item,
		Overview: details?.overview || item.Overview,
		CommunityRating: details?.rating ?? item.CommunityRating,
		Genres: details?.genres?.length ? details.genres : item.Genres,
		RunTimeTicks: details?.runTimeTicks ?? item.RunTimeTicks,
		LogoUrl: details?.logoPath ? getImageUrl(details.logoPath, 'w500') : null,
		RemoteTrailers: details?.trailerUrl ? [{Url: details.trailerUrl}] : [],
		_externalBackdropUrl: backdrop,
		_strictRating: true
	};
};

// Up to a bar's worth of list titles shuffled in with the library picks, a bar's worth in all.
// Only the list titles that make it on are looked up on TMDB.
export const withExternalSlides = async (libraryItems, listIds, settings, {serverUrl, accessToken}) => {
	const count = settings.featuredItemCount;
	const customRows = settings.customHomeRows || [];
	const [lists, ping] = await Promise.all([
		Promise.all(listIds.map((id) => fetchList(id, customRows, settings.uiLanguage))),
		moonfinPing(serverUrl, accessToken).catch(() => null)
	]);
	const detailsSupported = ping?.tmdbDetailsSupported === true;
	const pool = externalPool(lists.flat(), settings.featuredContentType, detailsSupported);
	const chosen = shuffleArray([...libraryItems, ...shuffleArray(pool).slice(0, count)]).slice(0, count);
	const slides = await Promise.all(chosen.map(async (item) => {
		if (!item._external) return item;
		const details = detailsSupported
			? await fetchTmdbDetails({type: item._seerrMediaType, tmdbId: item.ProviderIds?.Tmdb, imdbId: item.ProviderIds?.Imdb})
			: null;
		return toExternalSlide(item, details);
	}));
	return slides.filter(Boolean);
};
