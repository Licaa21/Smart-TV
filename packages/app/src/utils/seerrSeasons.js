// A Seerr series' seasons and episodes, dressed as the library's own.
//
// The details screens draw Season and Episode items, and there is no Jellyfin item behind these, so
// the TMDB payload is mapped across the way seerrDetailItem does for the title itself. Artwork comes
// as a finished url, since it lives on TMDB.

import seerrApi from '../services/seerrApi';
import serverLogger from '../services/serverLogger';
import {isEnglish} from './metadataLanguage';
import {seasonFromTmdb, tmdbGet} from './tmdbText';

const TICKS_PER_MINUTE = 600000000;
const FALLBACK_LANGUAGE = 'en-US';
let lastLogged = '';

const seriesIdOf = (details) => `seerr-tv-${details.id}`;

// What a season or episode stands for is told apart from a library one by this mark, which keeps a
// press on one from trying to open a page the library has none of.
export const isSeerrPseudo = (item) => Boolean(item?._seerrPseudo);

// TMDB names a season it has no translation for "Season 1" or "Specials", in English. Left unnamed, the tab
// takes the app's own label instead, which is in the viewer's language.
const GENERIC_NAME = /^(season|specials)\s*\d*$/i;

// A season with no episodes yet, an announced one, has nothing to show, and neither does an empty
// specials.
export const seerrSeasonItems = (details) => (details?.seasons || [])
	.filter((season) => season && Number.isInteger(season.seasonNumber) && season.episodeCount > 0)
	.map((season) => ({
		Id: `${seriesIdOf(details)}-s${season.seasonNumber}`,
		Type: 'Season',
		Name: GENERIC_NAME.test(String(season.name || '').trim()) ? '' : season.name || '',
		Overview: season.overview || '',
		IndexNumber: season.seasonNumber,
		SeriesName: details.name || details.title || '',
		ChildCount: season.episodeCount || 0,
		ProviderIds: {Tmdb: String(details.id)},
		UserData: {},
		_external: true,
		_seerrPseudo: true,
		_externalPosterUrl: season.posterPath ? seerrApi.getImageUrl(season.posterPath, 'w342') : null
	}));

// An episode nobody has rated still comes with a score, a flat 1.0 on a row of cards, so a score only counts
// with a few votes behind it. An answer that gives no vote count is trusted above that flat score.
const MIN_VOTES = 3;
const hasRealRating = (episode) => (Number.isFinite(episode.voteCount)
	? episode.voteCount >= MIN_VOTES && episode.voteAverage > 0
	: episode.voteAverage > 1);

const namesOf = (people, jobs) => (Array.isArray(people) ? people : [])
	.filter((person) => person && person.name && (!jobs || jobs.indexOf(String(person.job || '').toLowerCase()) !== -1))
	.map((person) => person.name)
	.filter((name, at, all) => all.indexOf(name) === at);

export const seerrEpisodeItems = (season, details) => (season?.episodes || []).map((episode) => {
	const still = episode.stillPath ? seerrApi.getImageUrl(episode.stillPath, 'w500') : null;
	return {
		Id: `${seriesIdOf(details)}-s${episode.seasonNumber}e${episode.episodeNumber}`,
		Type: 'Episode',
		Name: episode.name || '',
		Overview: episode.overview || '',
		IndexNumber: episode.episodeNumber,
		ParentIndexNumber: episode.seasonNumber != null ? episode.seasonNumber : season.seasonNumber,
		PremiereDate: episode.airDate || null,
		RunTimeTicks: episode.runtime > 0 ? episode.runtime * TICKS_PER_MINUTE : null,
		CommunityRating: hasRealRating(episode) ? episode.voteAverage : null,
		_voteCount: episode.voteCount > 0 ? episode.voteCount : 0,
		_directors: namesOf(episode.crew, ['director']),
		_writers: namesOf(episode.crew, ['writer', 'screenplay', 'story', 'teleplay']),
		_guests: namesOf(episode.guestStars).slice(0, 8),
		SeriesName: details.name || details.title || '',
		ProviderIds: {Tmdb: String(details.id)},
		UserData: {},
		_external: true,
		_seerrPseudo: true,
		// The still serves wherever a screen asks for an episode's picture, whichever kind it wants.
		_externalPosterUrl: still,
		_externalBackdropUrl: still
	};
});

// Whatever the asked-for language has comes first, and English fills the gaps it leaves, so a
// description or a name is only ever blank when neither language has one.
export const withEnglishGaps = (episodes, english) => {
	const byNumber = new Map(english.map((episode) => [episode.IndexNumber, episode]));
	return episodes.map((episode) => {
		const fallback = byNumber.get(episode.IndexNumber);
		if (!fallback) return episode;
		return {
			...episode,
			Name: episode.Name || fallback.Name,
			Overview: episode.Overview || fallback.Overview
		};
	});
};

// English fills what the first language left empty, and is asked for only when an aired episode has no name or
// description. One that has not aired has no text in any language yet, so it is no reason to ask again.
const withGapsFilled = async (episodes, language, loadEnglish) => {
	if (!language || isEnglish(language)) return episodes;
	const now = Date.now();
	const aired = (episode) => !episode.PremiereDate || new Date(episode.PremiereDate).getTime() <= now;
	if (!episodes.some((episode) => aired(episode) && (!episode.Overview || !episode.Name))) return episodes;
	try {
		return withEnglishGaps(episodes, await loadEnglish());
	} catch (err) {
		return episodes;
	}
};

// One season's episodes in the metadata language. With the TMDB key the plugin syncs down they come from
// TMDB. Without the key, or when TMDB cannot be reached, they are Seerr's, which asks TMDB in that language with
// the key it holds. Either way English fills what that language has none of.
export const loadSeerrSeason = async (details, seasonNumber, language, tmdbApiKey = '') => {
	// Once a series, to say where the words came from and how many episodes came with a description.
	const report = (from, list) => {
		const logKey = `${details.id}|${from}|${language}`;
		if (list.length && lastLogged !== logKey) {
			lastLogged = logKey;
			serverLogger.playback('Seerr season text', {from, language, keyed: Boolean(tmdbApiKey), season: seasonNumber, episodes: list.length, withDescription: list.filter((e) => e.Overview).length, name: String(list[0].Name || '').slice(0, 30)});
		}
		return list;
	};
	const fromSeerr = async () => {
		const own = seerrEpisodeItems(await seerrApi.getTvSeason(details.id, seasonNumber, language || undefined), details);
		return report('Seerr', await withGapsFilled(own, language, async () => seerrEpisodeItems(await seerrApi.getTvSeason(details.id, seasonNumber, FALLBACK_LANGUAGE), details)));
	};
	if (!tmdbApiKey || !language) return fromSeerr();

	const path = `/tv/${details.id}/season/${seasonNumber}`;
	let episodes;
	try {
		const raw = await tmdbGet(path, language, tmdbApiKey);
		if (!Array.isArray(raw.episodes)) throw new Error('TMDB gave no episodes');
		episodes = seerrEpisodeItems(seasonFromTmdb(raw), details);
	} catch (err) {
		// Once a series, since a bad key fails every season of it.
		if (lastLogged !== `${details.id}|failed`) {
			lastLogged = `${details.id}|failed`;
			serverLogger.playback('Seerr season text', {from: 'Seerr, TMDB did not answer', error: err.message});
		}
		return fromSeerr();
	}

	episodes = await withGapsFilled(episodes, language, async () => seerrEpisodeItems(seasonFromTmdb(await tmdbGet(path, FALLBACK_LANGUAGE, tmdbApiKey)), details));
	return report('TMDB', episodes);
};
