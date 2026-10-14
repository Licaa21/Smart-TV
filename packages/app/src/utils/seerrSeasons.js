// A Seerr series' seasons and episodes, dressed as the library's own.
//
// The details screens draw Season and Episode items, and there is no Jellyfin item behind these, so
// the TMDB payload is mapped across the way seerrDetailItem does for the title itself. Artwork comes
// as a finished url, since it lives on TMDB.

import seerrApi from '../services/seerrApi';
import serverLogger from '../services/serverLogger';
import {isEnglish} from './metadataLanguage';

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
		CommunityRating: episode.voteAverage > 0 ? episode.voteAverage : null,
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

// One season's episodes in the viewer's language, with English asked for only when there is a gap.
export const loadSeerrSeason = async (details, seasonNumber, language) => {
	const season = await seerrApi.getTvSeason(details.id, seasonNumber, language);
	let episodes = seerrEpisodeItems(season, details);
	// Once a series, to tell a language Seerr never applied from one TMDB has no text in.
	const logKey = `${details.id}|${language}`;
	if (episodes.length && lastLogged !== logKey) {
		lastLogged = logKey;
		serverLogger.playback('Seerr season language', {asked: language, season: seasonNumber, name: String(episodes[0].Name || '').slice(0, 30), got: String(episodes[0].Overview || '').slice(0, 40)});
	}
	// An episode that has not aired has no text in any language yet, so it is no reason to ask again.
	const now = Date.now();
	const aired = (episode) => !episode.PremiereDate || new Date(episode.PremiereDate).getTime() <= now;
	const gaps = episodes.some((episode) => aired(episode) && (!episode.Overview || !episode.Name));
	if (gaps && !isEnglish(language)) {
		try {
			const english = await seerrApi.getTvSeason(details.id, seasonNumber, FALLBACK_LANGUAGE);
			episodes = withEnglishGaps(episodes, seerrEpisodeItems(english, details));
		} catch (err) {
			void err;
		}
	}
	return episodes;
};
