// A file with dozens of subtitle tracks is too long to scroll, so a long list gets language chips and a search
// field. A short one is left as it was.
export const TRACK_FILTER_MIN = 12;

// Entries are {language, text}: the track's language code as the server names it, and what the row says.
export const needsTrackFilter = (count) => count > TRACK_FILTER_MIN;

const codeOf = (language) => {
	const code = (language || '').trim().toLowerCase();
	return code && code !== 'und' && code !== 'unknown' ? code : '';
};

// The languages the list has, most tracks first, so the one with 40 files comes before the one with two. Tracks that
// name no language are counted under an empty code, which the bar shows as Other.
export const trackLanguages = (entries) => {
	const counts = new Map();
	entries.forEach((entry) => {
		const code = codeOf(entry.language);
		counts.set(code, (counts.get(code) || 0) + 1);
	});
	return [...counts.entries()]
		.map(([code, count]) => ({code, count}))
		.sort((a, b) => ((a.code === '') - (b.code === '')) || (b.count - a.count) || a.code.localeCompare(b.code));
};

// The positions that stay: the chosen language ('' for all of them, OTHER_LANGUAGE for the nameless) and every word
// of the query somewhere in the row's text. Positions, since a row is picked by its place in the full list.
export const OTHER_LANGUAGE = '*';

export const filterTracks = (entries, {language = '', query = ''} = {}) => {
	const words = query.toLowerCase().split(/\s+/).filter(Boolean);
	const kept = [];
	entries.forEach((entry, position) => {
		if (language) {
			const code = codeOf(entry.language);
			if (language === OTHER_LANGUAGE ? code !== '' : code !== language) return;
		}
		const text = (entry.text || '').toLowerCase();
		if (words.every((word) => text.includes(word))) kept.push(position);
	});
	return kept;
};
