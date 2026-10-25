import {getAuthHeader, getServerUrl} from './jellyfinApi';
import {fetchWithTimeout} from '../utils/fetchTimeout';
import {mediaServerQueue} from '../utils/requestQueue';

// TMDB's words, seasons and recommendations through the Moonfin plugin, which holds the server-wide TMDB key
// (the plugin fork's Moonfin/Tmdb/Details, Season and Recommendations). The app has no key of its own. The
// plugin answers in TMDB's own field names, so what reads TMDB's answer reads this one. A plugin that lacks the
// routes, or has no key, answers 404 or 503, and the callers then use Seerr's own text.

const TIMEOUT_MS = 8000;
// A plugin that cannot help (no routes, no key, a refusal) is asked again after this long, not on every title. It is noted
// for the server it was asked on, so signing in to another one starts afresh. A timeout or a lost connection is not noted,
// since it may be one slow title or a passing drop, and every other failure speaks for one title only.
const CANNOT_HELP_MS = 5 * 60 * 1000;

const notNoted = () => ({server: '', seq: 0, until: 0});
let unavailable = notNoted();
// Counts the requests, so which one was asked for after a note is exact
let asked = 0;

// Exported so tests can start from a plugin that answers
export const __resetTmdbProxy = () => {
	unavailable = notNoted();
};

// False while the plugin of the current server is known not to answer, which spares a caller the request and its wait
export const tmdbAvailable = () => !(unavailable.until && unavailable.server === (getServerUrl() || '') && Date.now() < unavailable.until);

const noteUnavailable = (baseUrl) => {
	unavailable = {server: baseUrl, seq: asked, until: Date.now() + CANNOT_HELP_MS};
};

// TMDB takes xx or xx-YY, and the app may hold a longer tag (zh-Hans-CN) or an underscore one (pt_BR)
const tmdbLanguage = (language) => {
	const parts = String(language || '').split(/[-_]/).filter(Boolean);
	if (!parts.length) return 'en-US';
	const region = parts.length > 1 && /^[A-Za-z]{2}$/.test(parts[parts.length - 1]) ? parts[parts.length - 1].toUpperCase() : '';
	return region ? `${parts[0].toLowerCase()}-${region}` : parts[0].toLowerCase();
};

const routeFor = (path, language) => {
	const season = path.match(/^\/tv\/([^/]+)\/season\/(\d+)$/);
	if (season) return {route: 'Season', query: {tmdbId: season[1], seasonNumber: season[2], language}};
	const recommendations = path.match(/^\/(movie|tv)\/([^/]+)\/recommendations$/);
	if (recommendations) return {route: 'Recommendations', query: {mediaType: recommendations[1], tmdbId: recommendations[2], language}};
	const details = path.match(/^\/(movie|tv)\/([^/]+)$/);
	if (details) return {route: 'Details', query: {mediaType: details[1], tmdbId: details[2], language}};
	return null;
};

// A TMDB path, such as /tv/1396/season/2, answered by the plugin in TMDB's shape. Throws when the plugin cannot.
export const tmdbGet = async (path, language) => {
	const baseUrl = getServerUrl();
	if (!baseUrl) throw new Error('No server');
	if (!tmdbAvailable()) throw new Error('The plugin has no TMDB routes');
	const target = routeFor(path, tmdbLanguage(language));
	if (!target) throw new Error(`No plugin route for ${path}`);

	const url = `${baseUrl}/Moonfin/Tmdb/${target.route}?${Object.entries(target.query).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&')}`;
	// Only an answer that was asked for after the last note can lift it, so a slow call from before does not undo it
	const mine = ++asked;
	// A timeout or a lost connection throws from here, and says nothing about the plugin
	const response = await mediaServerQueue.run(
		() => fetchWithTimeout(url, {headers: {Authorization: getAuthHeader()}}, TIMEOUT_MS)
	);
	const data = await response.json().catch(() => null);
	if (!response.ok) {
		// 503 is a plugin with no TMDB key, a 404 with no JSON body is a plugin without the routes, and 401 and 403 are a refusal.
		// Anything else, a 404 for a title TMDB does not know, TMDB failing (502), a server error, is about one title.
		const cannotHelp = response.status === 503 || response.status === 401 || response.status === 403
			|| (response.status === 404 && !(data && typeof data === 'object'));
		if (cannotHelp) noteUnavailable(baseUrl);
		throw new Error(`The plugin answered ${response.status}`);
	}
	if (unavailable.seq < mine) unavailable = notNoted();
	// A page that is not the plugin's, such as a network's sign in page, can answer 200 with something else
	if (!data || typeof data !== 'object' || data.success === false) throw new Error('The plugin gave no usable answer');
	return data;
};
