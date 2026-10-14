import seerrApi from '../services/seerrApi';
import serverLogger from '../services/serverLogger';
import {tmdbGet, withTmdbText} from './tmdbText';

let lastLogged = '';

// A Seerr title with its words in the metadata language. Seerr answers in its own language, so with the
// TMDB key the plugin syncs down the words come from TMDB, and wherever TMDB has none Seerr's own stay,
// which is the English fallback. Without the key, or when TMDB cannot be reached, the title is Seerr's
// as it always was. The screen's own fetches go through this, or a refresh would lose the language.
export const fetchSeerrTitle = async (mediaType, mediaId, language, {tmdbApiKey = ''} = {}) => {
	const data = await (mediaType === 'movie' ? seerrApi.getMovie(mediaId) : seerrApi.getTv(mediaId));
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
