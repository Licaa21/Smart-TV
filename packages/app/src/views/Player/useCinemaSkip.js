import {useCallback, useEffect, useRef, useState} from 'react';
import Spotlight from '@enact/spotlight';
import {KEYS, isBackKey} from '../../utils/keys';
import {isPreroll, nextInQueue} from '../../utils/cinemaMode';
import {isSeekbarFocused, isSkipPromptFocused} from './useSegmentPopups';

// The button stays up for this much of the pre-roll, so only one longer than that gets it.
const SHOW_FOR_SECONDS = 10;
const TICKS_PER_SECOND = 10000000;
// Back right after Back put the button away is the same press, so it isn't passed on to the player.
const BACK_AFTER_HIDE_MS = 500;

/**
 * The Skip button on Cinema Mode pre-rolls. It comes up as each one starts and goes away
 * after ten seconds of it playing, so a pause holds it up. Right brings it back, Back puts
 * it away and Fast Forward skips whether it shows or not.
 */
const useCinemaSkip = ({item, videoQueue, enabled, duration, controlsVisible, activeModal, onSkip}) => {
	const next = enabled && isPreroll(item) ? nextInQueue(videoQueue, item) : null;
	const eligible = Boolean(next) && duration > SHOW_FOR_SECONDS;
	const [wanted, setWanted] = useState(true);
	// Where the pre-roll was when the button came up, set by the first position after that.
	const shownFromRef = useRef(null);
	// Read by the time update, which the players keep stable.
	const showingRef = useRef(false);
	showingRef.current = eligible && wanted;
	const backHeldUntilRef = useRef(0);

	useEffect(() => {
		shownFromRef.current = null;
		setWanted(true);
	}, [item?.Id]);

	const update = useCallback((ticks) => {
		if (!showingRef.current) return;
		if (shownFromRef.current == null) shownFromRef.current = ticks;
		else if (ticks - shownFromRef.current >= SHOW_FOR_SECONDS * TICKS_PER_SECOND) setWanted(false);
	}, []);

	const skip = () => {
		setWanted(false);
		onSkip(next);
	};

	const handleKeyDown = (e) => {
		if (!eligible || activeModal) return false;
		const consume = () => {
			e.preventDefault();
			e.stopPropagation();
			return true;
		};
		if (e.keyCode === KEYS.FAST_FORWARD) {
			skip();
			return consume();
		}
		if (isBackKey(e) && (wanted || Date.now() < backHeldUntilRef.current)) {
			if (wanted) backHeldUntilRef.current = Date.now() + BACK_AFTER_HIDE_MS;
			setWanted(false);
			return consume();
		}
		if (!wanted && !controlsVisible && e.keyCode === KEYS.RIGHT) {
			shownFromRef.current = null;
			setWanted(true);
			return consume();
		}
		// With the controls up the button sits just above the seek bar, and Up and Down move between them.
		if (wanted && controlsVisible && e.keyCode === KEYS.UP && isSeekbarFocused()) {
			Spotlight.focus('skip-segment-btn');
			return consume();
		}
		if (wanted && controlsVisible && e.keyCode === KEYS.DOWN && isSkipPromptFocused()) {
			Spotlight.focus('progress-bar');
			return consume();
		}
		return false;
	};

	return {active: eligible, shown: eligible && wanted, skip, update, handleKeyDown};
};

export default useCinemaSkip;
