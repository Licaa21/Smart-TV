// Titles, seasons and episodes in TMDB's shapes, as the plugin answers them (services/tmdbProxy.js). The Seerr payload
// carries everything else about a title, and this only lays the words over it, since Seerr answers in its own language.

// What TMDB calls a season, in the shape Seerr's own answer for it has.
export const seasonFromTmdb = (season) => ({
	seasonNumber: season?.season_number,
	episodes: (season?.episodes || []).map((episode) => ({
		seasonNumber: episode.season_number,
		episodeNumber: episode.episode_number,
		name: episode.name || '',
		overview: episode.overview || '',
		airDate: episode.air_date || null,
		runtime: episode.runtime || null,
		stillPath: episode.still_path || null,
		voteAverage: episode.vote_average || 0,
		voteCount: episode.vote_count || 0,
		crew: episode.crew,
		guestStars: episode.guest_stars
	}))
});

// The words a title already has, laid over a fresh Seerr answer, so a refresh that only wants its status keeps them.
export const keepingText = (fresh, previous) => {
	if (!previous) return fresh;
	const names = new Map((previous.seasons || []).map((season) => [season.seasonNumber, season.name]));
	return {
		...fresh,
		overview: previous.overview || fresh.overview,
		tagline: previous.tagline || fresh.tagline,
		...(previous.title ? {title: previous.title} : {}),
		...(previous.name ? {name: previous.name} : {}),
		...(Array.isArray(fresh.seasons) ? {seasons: fresh.seasons.map((season) => ({...season, name: names.get(season.seasonNumber) || season.name}))} : {})
	};
};

// Seerr's payload with the words of TMDB's, wherever TMDB has some. Names of seasons are matched by number.
export const withTmdbText = (seerrData, tmdbData) => {
	if (!tmdbData) return seerrData;
	const names = new Map((tmdbData.seasons || []).map((season) => [season.season_number, season.name]));
	return {
		...seerrData,
		overview: tmdbData.overview || seerrData.overview,
		tagline: tmdbData.tagline || seerrData.tagline,
		...(tmdbData.title ? {title: tmdbData.title} : {}),
		...(tmdbData.name ? {name: tmdbData.name} : {}),
		...(Array.isArray(seerrData.seasons)
			? {seasons: seerrData.seasons.map((season) => ({...season, name: names.get(season.seasonNumber) || season.name}))}
			: {})
	};
};
