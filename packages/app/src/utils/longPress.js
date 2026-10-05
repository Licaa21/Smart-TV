import {useCallback, useEffect, useRef} from 'react';

import {KEYS, isMenuKey} from './keys';

// Long enough that a normal press never trips it, short enough that the menu still
// feels like a response to holding the button rather than a delay.
export const LONG_PRESS_MS = 600;

// The same pair Spotlight treats as select, because it only raises a click for these
// and a hold has to watch exactly the keys the click will arrive from. LG remotes send
// the second one rather than Enter.
const REMOTE_OK_KEY = 16777221;
export const isSelectKey = (e) => {
	const code = e.which || e.keyCode;
	return code === KEYS.ENTER || code === REMOTE_OK_KEY;
};

/**
 * Adds a hold gesture to a Spottable control.
 *
 * Spotlight raises onClick from inside its own keyup handler, so a hold cant be
 * called off on the way out. The hold leaves a mark instead and the click handler
 * reads it, which also covers the pointer that webOS sets have.
 *
 * Returns the props to spread onto the control. Pass no onLongPress and it behaves
 * as a plain button.
 */
const useLongPress = (onLongPress, onClick) => {
	const timerRef = useRef(null);
	const heldRef = useRef(false);
	// Held down rather than timing, because the browsers on the oldest sets dont report
	// KeyboardEvent.repeat and every repeat would otherwise read as a fresh press.
	const pressedRef = useRef(false);

	const release = useCallback(() => {
		pressedRef.current = false;
		if (timerRef.current) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
	}, []);

	useEffect(() => release, [release]);

	// Spotlight raises a mousedown of its own from the keydown handler, so this runs
	// twice for one press and the flag is what settles it.
	const start = useCallback(() => {
		if (pressedRef.current || !onLongPress) return;
		pressedRef.current = true;
		heldRef.current = false;
		timerRef.current = setTimeout(() => {
			timerRef.current = null;
			heldRef.current = true;
			onLongPress();
		}, LONG_PRESS_MS);
	}, [onLongPress]);

	const handleKeyDown = useCallback((e) => {
		if (isMenuKey(e)) {
			if (!onLongPress) return;
			e.preventDefault();
			onLongPress();
			return;
		}
		if (!isSelectKey(e)) return;
		start();
	}, [start, onLongPress]);

	const handleKeyUp = useCallback((e) => {
		if (!isSelectKey(e)) return;
		release();
	}, [release]);

	const handleClick = useCallback((e) => {
		release();
		// A hold has already done its work, so the release must not also play.
		if (heldRef.current) {
			heldRef.current = false;
			return;
		}
		onClick?.(e);
	}, [release, onClick]);

	return {
		onKeyDown: handleKeyDown,
		onKeyUp: handleKeyUp,
		onClick: handleClick,
		onMouseDown: start,
		onMouseUp: release,
		onMouseLeave: release
	};
};

export default useLongPress;
