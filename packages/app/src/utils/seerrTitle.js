import seerrApi from '../services/seerrApi';
import serverLogger from '../services/serverLogger';
import {isEnglish} from './metadataLanguage';

// A Seerr title in the metadata language. English is only asked for when that language has no
// description, and then fills the tagline too. A tagline missing on its own is left, since many titles
// have none in any language and asking for each of them would double the requests.
// The screen's own fetches go through this, or a refresh would lose the language.
let lastLogged = '';

export const fetchSeerrTitle = async (mediaType, mediaId, language, {fallback = true} = {}) => {
	const fetchIn = (lang) => (mediaType === 'movie' ? seerrApi.getMovie(mediaId, lang) : seerrApi.getTv(mediaId, lang));
	const data = await fetchIn(language);
	// What came back, to tell a language Seerr never applied from one TMDB has no text in.
	if (fallback && data && lastLogged !== `${mediaType}${mediaId}|${language}`) {
		lastLogged = `${mediaType}${mediaId}|${language}`;
		serverLogger.playback('Seerr title language', {asked: language, got: String(data.overview || '').slice(0, 40)});
	}
	if (!fallback || !data || !language || isEnglish(language) || data.overview) return data;
	try {
		const english = await fetchIn('en-US');
		return {...data, overview: data.overview || english?.overview, tagline: data.tagline || english?.tagline};
	} catch (err) {
		void err;
		return data;
	}
};
