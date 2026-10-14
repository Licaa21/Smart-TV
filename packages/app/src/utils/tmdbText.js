// Titles, seasons and episodes in the metadata language, straight from TMDB with the key the plugin syncs
// down. The Seerr payload carries everything else about a title, and this only supplies the words, since
// Seerr answers in its own language. The key is a v4 token or a v3 key, which are sent differently.

const BASE = 'https://api.themoviedb.org/3';

export const tmdbGet = async (path, language, rawKey) => {
	const key = String(rawKey).trim();
	let url = `${BASE}${path}?language=${encodeURIComponent(language)}`;
	const options = {};
	if (String(key).startsWith('eyJ')) options.headers = {Authorization: `Bearer ${key}`};
	else url += `&api_key=${encodeURIComponent(key)}`;
	const response = await fetch(url, options);
	if (!response.ok) throw new Error(`TMDB answered ${response.status}`);
	const data = await response.json();
	// A page that is not TMDB's, such as a network's sign in page, can answer 200 with something else.
	if (!data || typeof data !== 'object' || data.success === false) throw new Error('TMDB gave no usable answer');
	return data;
};

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
		voteAverage: episode.vote_average || 0
	}))
});

// Seerr's payload with the words of TMDB's, wherever TMDB has some. Names of seasons are matched by number.
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
