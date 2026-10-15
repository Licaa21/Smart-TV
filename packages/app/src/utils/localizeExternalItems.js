import seerrApi from '../services/seerrApi';
import {isEnglish} from './metadataLanguage';

// A few at a time, since a row has twenty and the proxy in front of Seerr does better with a handful in flight.
const PARALLEL = 4;

// What Seerr said of a title in a language this session, null for nothing, so a row built again does not ask again.
const held = new Map();

const tmdbIdOf = (item) => item?.providerIds?.tmdb || item?.providerIds?.Tmdb || item?.ProviderIds?.Tmdb || null;
const isSeries = (item) => /series|tv/i.test(String(item?.type || item?.Type || ''));

const localizedFields = (details) => {
	if (!details) return null;
	const name = details.title || details.name;
	return {
		name: name || undefined,
		overview: details.overview || undefined,
		posterUrl: details.posterPath ? seerrApi.getImageUrl(details.posterPath, 'w342') : undefined,
		backdropUrl: details.backdropPath ? seerrApi.getImageUrl(details.backdropPath, 'w1280') : undefined
	};
};

// What Seerr holds of one title in the language, or null.
const fieldsFor = async (item, language) => {
	const id = tmdbIdOf(item);
	const series = isSeries(item);
	const key = `${series ? 'tv' : 'movie'}:${id}:${language}`;
	let fields = held.get(key);
	if (fields === undefined) {
		try {
			fields = localizedFields(await (series ? seerrApi.getTv(id, language) : seerrApi.getMovie(id, language)));
		} catch (err) {
			fields = null;
		}
		held.set(key, fields);
	}
	return fields;
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
