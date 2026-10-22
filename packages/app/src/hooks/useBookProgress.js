import {useCallback, useEffect, useRef} from 'react';
import {getApiForItem} from '../services/connectionPool';
import {api as activeApi} from '../services/jellyfinApi';
import {TICKS_PER_PAGE} from '../utils/books';

// Saves a comic or PDF page a moment after the reader settles on it and again
// when the reader closes, and marks the book read on its last page. The page it
// opened on counts as already saved, so just opening a book writes nothing.
const useBookProgress = (item, page, count) => {
	const saved = useRef(null);
	const latest = useRef({page, count});
	latest.current = {page, count};

	const save = useCallback(() => {
		const {page: current, count: total} = latest.current;
		if (!item || total <= 0 || saved.current === null || current === saved.current) return;
		saved.current = current;
		const api = getApiForItem(item) || activeApi;
		api.setPlaybackPosition(item.Id, current * TICKS_PER_PAGE)
			.then(() => (current === total - 1 ? api.setWatched(item.Id, true) : null))
			.catch(() => {});
	}, [item]);

	useEffect(() => {
		if (count <= 0) return;
		if (saved.current === null) saved.current = page;
		const timer = setTimeout(save, 1500);
		return () => clearTimeout(timer);
	}, [page, count, save]);

	useEffect(() => save, [save]);
};

export default useBookProgress;
