import seerrApi from '../services/seerrApi';
import {isEnglish} from './metadataLanguage';

// A few at a time, since a row has twenty and the proxy in front of Seerr does better with a handful in flight.
const PARALLEL = 4;

// What Seerr said of a title in a language this session, null for nothing, so a row built again does not ask again.
const held = new Map();

// What it said is also kept on the device for a week, so a start does not ask again for the titles it already knows
// (a row of twenty is twenty requests, and the TV answers some of them late). Only an answer is kept, never a failure.
const STORE_KEY = 'moonfin_title_language';
const KEEP_MS = 7 * 24 * 60 * 60 * 1000;
const KEEP_MAX = 400;
const SAVE_DELAY_MS = 2000;
let saved = null;
let saveTimer = null;

const hasWords = (raw) => Boolean(raw && (raw.name || raw.overview || raw.posterPath || raw.backdropPath));

const savedTitles = () => {
	if (saved) return saved;
	saved = {};
	try {
		const parsed = JSON.parse(window.localStorage.getItem(STORE_KEY) || '{}');
		const now = Date.now();
		Object.keys(parsed).forEach((key) => {
			const entry = parsed[key];
			// A time in the future is a clock that was wrong when it was written
			if (Array.isArray(entry) && hasWords(entry[0]) && entry[1] <= now && now - entry[1] < KEEP_MS) saved[key] = entry;
		});
	} catch (err) {
		// storage that cannot be read is the same as nothing kept
	}
	return saved;
};

const keepTitle = (key, raw) => {
	savedTitles()[key] = [raw, Date.now()];
	if (saveTimer) return;
	saveTimer = setTimeout(() => {
		saveTimer = null;
		try {
			const newest = Object.keys(saved).sort((a, b) => saved[b][1] - saved[a][1]).slice(0, KEEP_MAX);
			const kept = {};
			newest.forEach((name) => { kept[name] = saved[name]; });
			saved = kept;
			window.localStorage.setItem(STORE_KEY, JSON.stringify(kept));
		} catch (err) {
			// not kept this time
		}
	}, SAVE_DELAY_MS);
};

const tmdbIdOf = (item) => item?.providerIds?.tmdb || item?.providerIds?.Tmdb || item?.ProviderIds?.Tmdb || null;
const isSeries = (item) => /series|tv/i.test(String(item?.type || item?.Type || ''));

// What is kept of Seerr's answer: the words and the picture paths, not the addresses, which depend on how Seerr is reached.
const rawFields = (details) => (details ? {
	name: details.title || details.name || undefined,
	overview: details.overview || undefined,
	posterPath: details.posterPath || undefined,
	backdropPath: details.backdropPath || undefined
} : null);

const localizedFields = (raw) => (raw ? {
	name: raw.name,
	overview: raw.overview,
	posterUrl: raw.posterPath ? seerrApi.getImageUrl(raw.posterPath, 'w342') : undefined,
	backdropUrl: raw.backdropPath ? seerrApi.getImageUrl(raw.backdropPath, 'w1280') : undefined
} : null);

// What Seerr holds of one title in the language, or null.
const fieldsFor = async (item, language) => {
	const id = tmdbIdOf(item);
	const series = isSeries(item);
	const key = `${series ? 'tv' : 'movie'}:${id}:${language}`;
	let raw = held.get(key);
	if (raw === undefined) {
		const kept = savedTitles()[key];
		if (kept) {
			raw = kept[0];
		} else {
			try {
				raw = rawFields(await (series ? seerrApi.getTv(id, language) : seerrApi.getMovie(id, language)));
			} catch (err) {
				raw = null;
			}
			// An answer with nothing in it (a page where the data should be) is not kept for a week
			if (hasWords(raw)) keepTitle(key, raw);
		}
		held.set(key, raw);
	}
	return localizedFields(raw);
};

const present = (fields) => {
	const kept = {};
	Object.keys(fields).forEach((name) => { if (fields[name]) kept[name] = fields[name]; });
	return kept;
};

// Runs through the list a few at a time, handing what Seerr says of each title to `merge`, which returns the title
// as it should now read.
const localize = async (items, language, merge, eligible = () => true) => {
	const list = Array.isArray(items) ? items : [];
	if (!language || isEnglish(language) || list.length === 0) return list;

	const result = list.slice();
	const queue = list.map((item, index) => ({item, index})).filter(({item}) => tmdbIdOf(item) && eligible(item));

	const work = async () => {
		while (queue.length) {
			const {item, index} = queue.shift();
			const fields = await fieldsFor(item, language);
			if (fields) result[index] = merge(item, present(fields));
		}
	};
	await Promise.all(Array.from({length: Math.min(PARALLEL, queue.length)}, work));
	return result;
};

// The suggestions of a seasonal row, in the viewer's language. The plugin builds them from TMDB in English, so each
// is asked of Seerr again in the language, and what comes back (the title, the overview and the poster) replaces
// what it had. One that cannot be had keeps its English, and English itself is left alone.
export const localizeExternalItems = (items, language) => localize(items, language, (item, fields) => ({...item, ...fields}));

// The same for cards a row already drew from the plugin's answer: the titles of it that the library does not hold. The
// plugin is asked for the language too, but an older one ignores it, and a copy it kept before the viewer's language
// was known still comes back in English, so the cards are put right here whatever it did.
export const localizeSeerrCards = (cards, language) => localize(
	cards,
	language,
	(card, fields) => ({
		...card,
		Name: fields.name || card.Name,
		Overview: fields.overview || card.Overview,
		_externalPosterUrl: fields.posterUrl || card._externalPosterUrl,
		_externalBackdropUrl: fields.backdropUrl || card._externalBackdropUrl
	}),
	// Only what came from outside the library. A card the library turned out to hold still carries the marks of the list it came from, and is never asked about
	(card) => card._seerr === true && card._external === true && !card._resolvedFromExternal
);

// Rows the plugin already answers in the language it is asked for: the TMDB charts (checked on the server with
// Moonbase 2.4.0.7, 2026-10-27). The IMDb lists and the viewer's own lists come back as the source names them, in
// English, so those still go through the pass above. Asking Seerr for a title of each of a dozen rows at every start
// was 190 requests in the first half minute, and the TV answered some of them seconds late.
export const pluginTranslatesRow = (rowId) => /^tmdb_/.test(String(rowId || ''));
