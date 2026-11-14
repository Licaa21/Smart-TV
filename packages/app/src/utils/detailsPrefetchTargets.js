// The titles whose details screens are worth filling in ahead of time: the first few cards of Continue Watching and Next Up
// (of the one row when the two are merged), which are the ones most often opened. Home says what it shows, and the
// prefetcher (views/Details/DetailsPrefetcher.js) listens.
import {isCacheableType} from '../views/Details/detailsCache';

export const PREFETCH_PER_ROW = 6;

// [rows] are the rows Home draws, in order.
export const pickPrefetchTargets = (rows) => {
	const firstOf = (id) => ((rows || []).find((row) => row.id === id)?.items || []).filter((item) => item?.Id && isCacheableType(item)).slice(0, PREFETCH_PER_ROW);
	const merged = firstOf('continue-nextup');
	const picked = merged.length ? merged : [...firstOf('resume'), ...firstOf('nextup')];
	const seen = new Set();
	return picked.filter((item) => {
		if (seen.has(item.Id)) return false;
		seen.add(item.Id);
		return true;
	});
};

let targets = [];
const listeners = new Set();

export const getPrefetchTargets = () => targets;

export const setPrefetchTargets = (next) => {
	const same = next.length === targets.length && next.every((item, index) => item.Id === targets[index].Id);
	if (same) return;
	targets = next;
	listeners.forEach((listener) => listener(targets));
};

export const onPrefetchTargets = (listener) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};
