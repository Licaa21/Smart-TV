import seerrApi from '../services/seerrApi';
import serverLogger from '../services/serverLogger';
import {tmdbAvailable, tmdbGet} from '../services/tmdbProxy';
import {isEnglish} from './metadataLanguage';
import {withTmdbText} from './tmdbText';

let lastLogged = '';

// A Seerr title with its words in the metadata language. Seerr answers in its own language, so the words come from
// TMDB through the plugin, which holds the key, and wherever TMDB has none Seerr's own stay, which is the English
// fallback. When the plugin cannot give them (no routes yet, no server key, TMDB down) the title is Seerr's, asked in
// that language. The screen's own fetches go through this, or a refresh would lose the language. statusOnly asks Seerr alone, for
// a refresh that wants the request's status and keeps the words already on screen.
export const fetchSeerrTitle = async (mediaType, mediaId, language, {statusOnly = false} = {}) => {
	const load = (asked) => (mediaType === 'movie' ? seerrApi.getMovie(mediaId, asked) : seerrApi.getTv(mediaId, asked));
	if (!language || statusOnly) return load();
	// For English the plugin has nothing to add, Seerr is asked in it directly
	if (isEnglish(language)) return load(language);

	// A plugin known not to answer costs no request: Seerr in the language, and English only where that has no description
	if (!tmdbAvailable()) {
		const inLanguage = await load(language);
		if (inLanguage && !inLanguage.overview) return (await load().catch(() => null)) || inLanguage;
		return inLanguage;
	}

	let reason = '';
	const [data, text] = await Promise.all([
		load(undefined),
		tmdbGet(`/${mediaType === 'movie' ? 'movie' : 'tv'}/${mediaId}`, language).catch((err) => {
			reason = err.message;
			return null;
		})
	]);
	const key = `${mediaType}${mediaId}|${language}`;
	// Seerr has nothing for the title, so there is nothing to lay words over
	if (!data) return data;
	if (text) {
		const merged = withTmdbText(data, text);
		if (lastLogged !== key) {
			lastLogged = key;
			serverLogger.playback('Seerr title text', {from: 'TMDB through the plugin', language, got: String(merged.overview || '').slice(0, 40)});
		}
		return merged;
	}
	if (lastLogged !== key) {
		lastLogged = key;
		serverLogger.playback('Seerr title text', {from: 'Seerr, the plugin could not give TMDB text', language, error: reason});
	}
	// Seerr in the language itself, which it passes on to TMDB with its own key, and the English answer already in hand
	// is what stays wherever that has no description.
	const own = await load(language).catch(() => null);
	if (own && !own.overview) return data;
	return own || data;
};
