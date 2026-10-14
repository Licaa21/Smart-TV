import seerrApi from '../services/seerrApi';
import {isEnglish} from './metadataLanguage';

// A few at a time, since a row has twenty and the proxy in front of Seerr does better with a handful in flight.
const PARALLEL = 4;

// What Seerr said of a title in a language this session, '' for none, so a row built again does not ask again.
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

// The suggestions of a seasonal row, in the viewer's language. The plugin builds them from TMDB in English, so each
// is asked of Seerr again in the language, and what comes back (the title, the overview and the poster) replaces
// what it had. One that cannot be had keeps its English, and English itself is left alone.
export const localizeExternalItems = async (items, language) => {
	const list = Array.isArray(items) ? items : [];
	if (!language || isEnglish(language) || list.length === 0) return list;

	const result = list.slice();
	const queue = list.map((item, index) => ({item, index})).filter(({item}) => tmdbIdOf(item));

	const work = async () => {
		while (queue.length) {
			const {item, index} = queue.shift();
			const series = isSeries(item);
			const key = `${series ? 'tv' : 'movie'}:${tmdbIdOf(item)}:${language}`;
			let fields = held.get(key);
			if (fields === undefined) {
				try {
					fields = localizedFields(await (series ? seerrApi.getTv(tmdbIdOf(item), language) : seerrApi.getMovie(tmdbIdOf(item), language)));
				} catch (err) {
					fields = null;
				}
				held.set(key, fields);
			}
			if (fields) {
				const kept = {};
				Object.keys(fields).forEach((name) => { if (fields[name]) kept[name] = fields[name]; });
				result[index] = {...item, ...kept};
			}
		}
	};
	await Promise.all(Array.from({length: Math.min(PARALLEL, queue.length)}, work));
	return result;
};
