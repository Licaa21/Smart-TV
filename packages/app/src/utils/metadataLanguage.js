import {appLocale} from './appLocale';

// The language Seerr titles are asked for, so a title it only knows by an English text reads the way
// the library's own do.
//
// Jellyfin keeps its metadata language in the server's settings, which only an administrator can
// read, so for anyone else the app's own language stands in. A language is not fixed to a server
// for good, but the app is restarted to change either one, so the answer is held for the session.

// The server stores a language and, apart from it, a country that is the region for release dates and
// ratings, not for translations, so only the language is sent: "ro" and not "ro-US".
export const tmdbLanguage = (language) => String(language || '').trim() || null;

export const isEnglish = (language) => /^en(-|$)/i.test(String(language || ''));

const held = new Map();

// Seerr titles never needed the media server before, so a slow one must not hold them up.
const LOOKUP_TIMEOUT_MS = 4000;

const withTimeout = (promise, ms) => new Promise((resolve, reject) => {
	const timer = setTimeout(() => reject(new Error('Timed out')), ms);
	promise.then(
		(value) => { clearTimeout(timer); resolve(value); },
		(err) => { clearTimeout(timer); reject(err); }
	);
});

// `api` is a Jellyfin api, and `key` tells a server and the viewer on it apart.
export const resolveMetadataLanguage = (api, key = '') => {
	if (!held.has(key)) {
		held.set(key, Promise.resolve()
			.then(() => withTimeout(api.getServerConfiguration(), LOOKUP_TIMEOUT_MS))
			// A server left on no language means English, so only a settings page that can't be read falls through.
			.then((config) => tmdbLanguage(config?.PreferredMetadataLanguage) || 'en-US')
			.catch((err) => {
				// A refusal is the answer for a viewer who is not an administrator and is kept. Anything else,
				// a server that could not be reached or that had a bad moment, says nothing, so the next ask
				// tries again.
				if (err?.status !== 403) held.delete(key);
				return null;
			})
			.then((language) => language || appLocale() || 'en-US'));
	}
	return held.get(key);
};

// For tests.
export const forgetMetadataLanguage = () => held.clear();
