import $L from '@enact/i18n/$L';

import {SHOWS_EVERYTHING} from './detailSectionLayout';

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
	return date.toLocaleDateString(undefined, {year: 'numeric', month: 'long', day: 'numeric'});
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
	const movies = all.filter((item) => item.Type === 'Movie');
	const series = all.filter((item) => item.Type === 'Series');
	const musicVideos = showsSection('musicVideos') ? all.filter((item) => item.Type === 'MusicVideo') : [];
	const seriesIds = new Set(series.map((item) => item.Id));
	const guestAppearances = showsSection('guestAppearances')
		? all.filter((item) => item.Type === 'Episode' && (!item.SeriesId || !seriesIds.has(item.SeriesId)))
		: [];

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
		const existing = byId.get(credit.id);
		if (existing) existing.push(credit);
		else byId.set(credit.id, [credit]);
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
