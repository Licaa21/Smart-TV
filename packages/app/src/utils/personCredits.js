import $L from '@enact/i18n/$L';

import {SHOWS_EVERYTHING} from './detailSectionLayout';
import {appLocale} from './appLocale';

// A birthday is a calendar date, not a moment. Both servers send it anchored to
// UTC, so reading it back in the viewer's zone moves it a day earlier for
// anyone west of it. The parts are taken as written and rebuilt locally.
const parseDate = (value) => {
	if (!value) return null;
	const parsed = new Date(value);
	if (isNaN(parsed.getTime())) return null;
	return new Date(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
};

export const formatPersonDate = (value) => {
	const date = parseDate(value);
	if (!date) return null;
	return date.toLocaleDateString(appLocale(), {year: 'numeric', month: 'long', day: 'numeric'});
};

export const personAge = (birthValue, deathValue) => {
	const birth = parseDate(birthValue);
	if (!birth) return null;
	const end = parseDate(deathValue) || new Date();
	let age = end.getFullYear() - birth.getFullYear();
	const monthDiff = end.getMonth() - birth.getMonth();
	if (monthDiff < 0 || (monthDiff === 0 && end.getDate() < birth.getDate())) age -= 1;
	return age > 0 ? age : null;
};

// Born, then either the date they died or how old they are now. Someone with
// neither date on file gets no lines at all rather than an empty row.
export const personDateLines = (birthValue, deathValue) => {
	const lines = [];
	const born = formatPersonDate(birthValue);
	if (born) lines.push($L('Born {date}').replace('{date}', born));

	const died = formatPersonDate(deathValue);
	if (died) {
		lines.push($L('Died {date}').replace('{date}', died));
	} else if (born) {
		const age = personAge(birthValue);
		if (age) lines.push($L('Age {age}').replace('{age}', age));
	}

	return lines;
};

// The filmography comes back as one list, and each kind of work gets its own
// row. An episode of a series the person is billed on is already covered by
// that series, so only the rest count as a guest appearance. Guest appearances
// and music videos each have a switch in the detail sections setting, and a
// hidden one comes back empty.
export const splitFilmography = (items, showsSection = SHOWS_EVERYTHING) => {
	const all = Array.isArray(items) ? items : [];
	// The same title held twice, in two libraries or as two copies, is one card. The first is kept,
	// which is the most recent since the list comes newest first.
	const distinct = (list, keyOf) => {
		const seen = new Set();
		return list.filter((item) => {
			const key = keyOf(item).toLowerCase();
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
	};
	const titled = (item) => `${item.Type}|${item.Name || item.Id}|${item.ProductionYear || ''}`;
	const movies = distinct(all.filter((item) => item.Type === 'Movie'), titled);
	const series = distinct(all.filter((item) => item.Type === 'Series'), titled);
	const musicVideos = showsSection('musicVideos') ? distinct(all.filter((item) => item.Type === 'MusicVideo'), titled) : [];
	const seriesIds = new Set(series.map((item) => item.Id));
	// A talk show can hold dozens of episodes with the same person, so a show gets one card.
	const guestAppearances = showsSection('guestAppearances') ? distinct(
		all.filter((item) => item.Type === 'Episode' && (!item.SeriesId || !seriesIds.has(item.SeriesId))),
		(item) => (item.SeriesName || item.SeriesId ? `show|${item.SeriesName || item.SeriesId}` : `episode|${item.Id}`)
	) : [];

	return {movies, series, guestAppearances, musicVideos};
};

const creditTitle = (credit) => credit.title || credit.name || credit.originalTitle || credit.originalName || '';

const creditDate = (credit) => credit.releaseDate || credit.release_date || credit.firstAirDate || credit.first_air_date || null;

const creditPosterPath = (credit) => credit.posterPath || credit.poster_path || null;

// Only what can be drawn as a poster, and never a job that amounts to a credit
// list mention rather than work on the title.
const EXCLUDED_JOBS = ['thanks', 'special thanks'];

export const usableCredits = (credits, isCrew = false) => (Array.isArray(credits) ? credits : []).filter((credit) => {
	if (!creditPosterPath(credit)) return false;
	if (!isCrew) return true;
	const job = (credit.job || '').toLowerCase();
	return !EXCLUDED_JOBS.includes(job);
});

// The same title turns up once per role, so the roles are joined onto a single
// entry rather than repeating the poster down the row.
export const groupCredits = (credits, isCrew = false) => {
	const list = Array.isArray(credits) ? credits : [];
	const byId = new Map();

	for (const credit of list) {
		// A movie and a show can share an id, so the kind is part of the key.
		const key = `${credit.mediaType || credit.media_type || ''}:${credit.id}`;
		const existing = byId.get(key);
		if (existing) existing.push(credit);
		else byId.set(key, [credit]);
	}

	const grouped = [];
	for (const entries of byId.values()) {
		const first = entries[0];
		if (entries.length === 1) {
			grouped.push(first);
			continue;
		}

		const roles = [];
		for (const entry of entries) {
			const role = isCrew ? (entry.job || entry.department) : entry.character;
			if (role && roles.indexOf(role) === -1) roles.push(role);
		}

		const joined = roles.join(', ');
		grouped.push(isCrew
			? {...first, job: joined || first.job}
			: {...first, character: joined || first.character});
	}

	return grouped;
};

// TMDB's genre ids for talk shows and news, which a person turns up on as themselves and which
// say little about what they are known for.
const SELF_GENRES = [10767, 10763];

// Billing below this is a walk-on, and a guest spot of a few episodes is a cameo too. Such a credit can carry the
// most votes of anyone's work and still say nothing about the person.
const LEAD_BILLING = 10;
const MIN_EPISODES = 5;
// TMDB bills the movies of a cast list and leaves the series without a place in it, so a series credit with no
// billing has only its episode count to show it was a main part
const MIN_EPISODES_UNBILLED = 10;
// A series this long is what its cast is known for, ahead of any film
const LONG_RUN = 20;
const CAMEO_CHARACTER = /uncredited|cameo/i;
const SELF_CHARACTER = /^(self|himself|herself|themselves)\b/i;

// The credits that are a main or supporting part, with a backdrop to show for them. Walk-ons, cameos, guest spots and
// appearances as themselves are left out, and so is any title twice. A credit with no billing is judged by its
// episodes, and a movie with neither is taken to be leading, since nothing tells it apart.
const leadingCredits = (cast) => {
	const seen = new Set();
	const leading = [];
	(Array.isArray(cast) ? cast : []).forEach((credit) => {
		const path = credit.backdropPath || credit.backdrop_path;
		if (!path || seen.has(path)) return;
		const genres = credit.genreIds || credit.genre_ids || [];
		if (genres.some((id) => SELF_GENRES.includes(id))) return;
		const character = credit.character || '';
		if (SELF_CHARACTER.test(character)) return;
		seen.add(path);
		const order = Number.isFinite(credit.order) ? credit.order : null;
		const episodes = credit.episodeCount ?? credit.episode_count;
		const longEnough = !Number.isFinite(episodes) || episodes >= (order === null ? MIN_EPISODES_UNBILLED : MIN_EPISODES);
		if ((order !== null && order >= LEAD_BILLING) || !longEnough || CAMEO_CHARACTER.test(character)) return;
		leading.push({
			path,
			order,
			episodes: Number.isFinite(episodes) ? episodes : null,
			votes: credit.voteCount || credit.vote_count || 0
		});
	});
	return leading;
};

// The backdrop of the one title this person is known for: the series they were in for the most episodes, when one
// ran long, and otherwise the film or series where they were billed highest, the most voted of those on a tie.
// Null when they have no leading part with a backdrop.
export const knownForBackdropPath = (cast) => {
	const leading = leadingCredits(cast);
	const longest = leading
		.filter((entry) => entry.episodes !== null && entry.episodes >= LONG_RUN)
		.sort((a, b) => b.episodes - a.episodes)[0];
	if (longest) return longest.path;
	const billed = (entry) => (entry.order === null ? Infinity : entry.order);
	const best = leading.sort((a, b) => (billed(a) - billed(b)) || (b.votes - a.votes))[0];
	return best ? best.path : null;
};

export const sortCredits = (credits, sortOption = 'alphabetical') => {
	const sorted = (Array.isArray(credits) ? credits : []).slice();
	const byTitle = (a, b) => creditTitle(a).toLowerCase().localeCompare(creditTitle(b).toLowerCase());

	if (sortOption === 'alphabetical') {
		sorted.sort(byTitle);
		return sorted;
	}

	// A title with no date on file sorts to the end either way, so the row never
	// opens on something that cant be placed.
	const ascending = sortOption === 'releaseDateAsc';
	sorted.sort((a, b) => {
		const dateA = parseDate(creditDate(a));
		const dateB = parseDate(creditDate(b));
		if (!dateA && !dateB) return byTitle(a, b);
		if (!dateA) return 1;
		if (!dateB) return -1;
		return ascending ? dateA - dateB : dateB - dateA;
	});
	return sorted;
};

export const prepareCredits = (credits, {isCrew = false, group = false, sortOption = 'alphabetical'} = {}) => {
	const usable = usableCredits(credits, isCrew);
	return sortCredits(group ? groupCredits(usable, isCrew) : usable, sortOption);
};
