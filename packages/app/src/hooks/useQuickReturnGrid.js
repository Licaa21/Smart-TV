// Back on a scrolled grid returns it to its first item instead of leaving.
// Hands out the cbScrollTo receiver for the grid, a handler that consumes
// the press only once the grid has actually been scrolled, and a way to put
// the grid on any item.

import {useCallback, useRef} from 'react';
import {isListScrolledAway} from '../utils/quickReturn';

const useQuickReturnGrid = (spotlightId) => {
	const scrollToRef = useRef(null);
	const getScrollTo = useCallback((fn) => {
		scrollToRef.current = fn;
	}, []);

	const quickReturn = useCallback(() => {
		if (isListScrolledAway(spotlightId) && scrollToRef.current) {
			scrollToRef.current({index: 0, animate: false, focus: true});
			return true;
		}
		return false;
	}, [spotlightId]);

	const scrollTo = useCallback((options) => {
		if (scrollToRef.current) scrollToRef.current(options);
	}, []);

	return {getScrollTo, quickReturn, scrollTo};
};

export default useQuickReturnGrid;
