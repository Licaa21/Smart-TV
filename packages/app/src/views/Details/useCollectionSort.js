import {useCallback, useEffect, useMemo, useState} from 'react';

import {DEFAULT_SORT, SORT_CUSTOM, applyCollectionSort, collectionSortOptions} from './nouveau/nouveauCollectionSort';

// The order a collection's playable run is shown in. The plugin keeps a hand-arranged order, and
// without the plugin or a saved one the custom option isn't offered. A saved order means somebody
// arranged this collection, so it opens the way they left it.
const useCollectionSort = (api, collectionId, items) => {
	const [sortOption, setSortOption] = useState(DEFAULT_SORT);
	const [customOrder, setCustomOrder] = useState([]);
	const [sortOpen, setSortOpen] = useState(false);

	useEffect(() => {
		let cancelled = false;
		setCustomOrder([]);
		setSortOption(DEFAULT_SORT);
		if (!api?.getCollectionOrder || !collectionId) return undefined;

		api.getCollectionOrder(collectionId)
			.then((order) => {
				if (cancelled || !Array.isArray(order) || !order.length) return;
				setCustomOrder(order);
				setSortOption(SORT_CUSTOM);
			})
			.catch(() => {});

		return () => {
			cancelled = true;
		};
	}, [api, collectionId]);

	const sorted = useMemo(() => applyCollectionSort(items, sortOption, customOrder), [items, sortOption, customOrder]);
	const sortOptions = useMemo(() => collectionSortOptions(customOrder.length > 0), [customOrder.length]);

	const openSort = useCallback(() => setSortOpen(true), []);
	const closeSort = useCallback(() => setSortOpen(false), []);
	const chooseSort = useCallback((id) => {
		setSortOption(id);
		setSortOpen(false);
	}, []);

	return {sorted, sortOption, sortOptions, sortOpen, openSort, closeSort, chooseSort};
};

export default useCollectionSort;
