// Seasons and episodes come back in whatever order the server chose, which puts
// Specials first on some setups, so anything that means "the one after this" goes
// by IndexNumber rather than position in the list.

const toNumber = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const indexOf = (entry) => toNumber(entry?.IndexNumber);

// Missing and unaired episodes are listed alongside real ones but have no file
// behind them, so they can never be the thing that plays next.
export const isPlayableEpisode = (episode) => Boolean(episode) && episode.LocationType !== 'Virtual';

export const findNextInSeason = (episodes, currentId) => {
	const list = episodes || [];
	// Ids are coerced because Emby returns them as numbers where Jellyfin uses strings.
	const current = list.findIndex((ep) => String(ep?.Id) === String(currentId));
	if (current < 0) return null;
	return list.slice(current + 1).find(isPlayableEpisode) || null;
};

export const findNextSeason = (seasons, currentSeasonId, currentSeasonNumber) => {
	const list = seasons || [];
	const currentEntry = list.find((s) => String(s.Id) === String(currentSeasonId));
	const current = toNumber(currentSeasonNumber) ?? indexOf(currentEntry);

	if (current == null) {
		// No numbering to compare, so the order the server gave is all there is.
		const position = list.findIndex((s) => String(s.Id) === String(currentSeasonId));
		return position >= 0 && position < list.length - 1 ? list[position + 1] : null;
	}

	return list.reduce((best, season) => {
		const number = indexOf(season);
		if (number == null || number <= current) return best;
		return best == null || number < indexOf(best) ? season : best;
	}, null);
};

export const firstPlayableEpisode = (episodes) => (episodes || []).find(isPlayableEpisode) || null;

// The mirror of the lookups above, for going back. A show's Specials sit in season 0, and stepping
// back out of season 1 into them would be a surprise, so only numbered seasons are walked.
export const findPreviousInSeason = (episodes, currentId) => {
	const list = episodes || [];
	const current = list.findIndex((ep) => String(ep?.Id) === String(currentId));
	if (current < 0) return null;
	return list.slice(0, current).reverse().find(isPlayableEpisode) || null;
};

export const findPreviousSeason = (seasons, currentSeasonId, currentSeasonNumber) => {
	const list = seasons || [];
	const currentEntry = list.find((s) => String(s.Id) === String(currentSeasonId));
	const current = toNumber(currentSeasonNumber) ?? indexOf(currentEntry);
	if (current == null) return null;
	return list.reduce((best, season) => {
		const number = indexOf(season);
		if (number == null || number < 1 || number >= current) return best;
		return best == null || number > indexOf(best) ? season : best;
	}, null);
};

export const lastPlayableEpisode = (episodes) => [...(episodes || [])].reverse().find(isPlayableEpisode) || null;
