import seerrApi from '../services/seerrApi';
import serverLogger from '../services/serverLogger';
import {tmdbGet, withTmdbText} from './tmdbText';

let lastLogged = '';

// A Seerr title with its words in the metadata language. Seerr answers in its own language, so with the
// TMDB key the plugin syncs down the words come from TMDB, and wherever TMDB has none Seerr's own stay,
// which is the English fallback. Without the key the title is Seerr's in that language, and when TMDB cannot be
// reached it is Seerr's as it always was. The screen's own fetches go through this, or a refresh would lose the language.
export const fetchSeerrTitle = async (mediaType, mediaId, language, {tmdbApiKey = ''} = {}) => {
	const load = (asked) => (mediaType === 'movie' ? seerrApi.getMovie(mediaId, asked) : seerrApi.getTv(mediaId, asked));
	// Without the key Seerr is asked in the language itself, which it passes on to TMDB with its own key, and its
	// own answer is what stays wherever that has no description.
	const data = await load(tmdbApiKey ? undefined : language || undefined);
	if (!tmdbApiKey && language && data && !data.overview) return (await load()) || data;
	if (!data || !tmdbApiKey || !language) return data;

	try {
		const merged = withTmdbText(data, await tmdbGet(`/${mediaType === 'movie' ? 'movie' : 'tv'}/${mediaId}`, language, tmdbApiKey));
		const key = `${mediaType}${mediaId}|${language}`;
		if (lastLogged !== key) {
			lastLogged = key;
			serverLogger.playback('Seerr title text', {from: 'TMDB', language, got: String(merged.overview || '').slice(0, 40)});
		}
		return merged;
	} catch (err) {
		serverLogger.playback('Seerr title text', {from: 'Seerr, TMDB did not answer', language, error: err.message});
		return data;
	}
};
