import mapBounded from '../../utils/mapBounded';
import {shuffleArray} from '../Details/detailsMedia';

const SOURCE_CONCURRENCY = 6;

// Reads the media bar's libraries or collections six at a time in a shuffled order, and skips a
// source still waiting for a slot once there are twice as many usable titles as the bar shows.
// The shuffle changes which ones get skipped from one load to the next.
export const readFeaturedSources = async (sourceIds, fetchSource, isUsable, count) => {
	const items = [];
	const seen = new Set();
	let usable = 0;
	await mapBounded(shuffleArray(sourceIds), SOURCE_CONCURRENCY, async (sourceId) => {
		if (usable >= count * 2) return;
		const result = await fetchSource(sourceId).catch(() => null);
		(result?.Items || []).forEach((item) => {
			if (seen.has(item.Id)) return;
			seen.add(item.Id);
			items.push(item);
			if (isUsable(item)) usable++;
		});
	});
	return items;
};
