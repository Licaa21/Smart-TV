import {useState, useCallback, useEffect, useRef} from 'react';
import Spotlight from '@enact/spotlight';

// The Sort & Filter panel each music style opens from its header. It takes focus as it opens,
// Back closes it before leaving the screen, and `onClosed` says where focus goes after.
const useMusicFilterPanel = (backHandlerRef, onClosed) => {
	const [showFilter, setShowFilter] = useState(false);
	const showFilterRef = useRef(false);
	showFilterRef.current = showFilter;

	const openFilter = useCallback(() => setShowFilter(true), []);

	const closeFilter = useCallback(() => {
		setShowFilter(false);
		onClosed();
	}, [onClosed]);

	useEffect(() => {
		if (!showFilter) return undefined;
		let attempts = 0;
		let raf = null;
		const tryFocus = () => {
			if (Spotlight.focus('music-sort-option-0')) return;
			attempts += 1;
			if (attempts < 6) raf = window.requestAnimationFrame(tryFocus);
		};
		raf = window.requestAnimationFrame(tryFocus);
		return () => { if (raf) window.cancelAnimationFrame(raf); };
	}, [showFilter]);

	useEffect(() => {
		if (!backHandlerRef) return undefined;
		const handler = () => {
			if (showFilterRef.current) {
				closeFilter();
				return true;
			}
			return false;
		};
		backHandlerRef.current = handler;
		// Only give the slot back if it's still ours, so a late unmount elsewhere
		// can't silently kill Back.
		return () => { if (backHandlerRef.current === handler) backHandlerRef.current = null; };
	}, [backHandlerRef, closeFilter]);

	return {showFilter, openFilter, closeFilter};
};

export default useMusicFilterPanel;
