import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import $L from '@enact/i18n/$L';
import Spotlight from '@enact/spotlight';
import {SpottableButton} from './PlayerConstants';
import {CountdownRing, SkipGlyph, formatRemaining, useOverlayFocus} from './overlayParts';

import css from './SkipSegmentOverlay.module.less';

const RING_SIZE = 52;
const RING_STROKE = 4;

const SEGMENT_LABELS = {
	intro: 'Intro',
	outro: 'Outro',
	preview: 'Preview',
	recap: 'Recap',
	commercial: 'Commercial'
};

// Where the prompt rests along the bottom edge, as the stylesheet has it, the bar of controls it has to clear, which the
// player marks, and the room kept between them.
const RESTING_BOTTOM = 174;
const CONTROLS_SELECTOR = '[data-player-controls-bottom]';
const CONTROLS_GAP = 24;

// How far from the bottom edge the prompt sits while the controls are up: above them, the way the subtitles are lifted.
// Null leaves it where the stylesheet puts it.
export const promptBottomFor = (restingBottom, controlsTop, innerHeight) => {
	if (restingBottom == null || !Number.isFinite(controlsTop)) return null;
	const clear = Math.round(innerHeight - controlsTop + CONTROLS_GAP);
	return clear > restingBottom ? clear : null;
};

const ringClasses = {ring: css.ring, svg: css.ringSvg, track: css.ringTrack, value: css.ringValue, center: css.ringCenter};

/**
 * Offers to jump past a segment the server marked up. The ring drains for as long
 * as the segment has left to run, so the prompt going away is never a surprise.
 */
const SkipSegmentOverlay = ({type, remainingSeconds, progress, countdownStyle, onSkip, spotlightId, controlsVisible = false, measureKey}) => {
	// The prompt takes the remote while the controls are away. With them up it leaves focus to them, and is reached with
	// Up from the playback bar.
	useOverlayFocus(controlsVisible ? null : spotlightId);

	// Lifted above the bar of controls while it is up, and eased back down when it goes, as the subtitles are.
	const [lifted, setLifted] = useState(null);
	useLayoutEffect(() => {
		if (!controlsVisible) {
			setLifted(null);
			return;
		}
		const bar = document.querySelector(CONTROLS_SELECTOR);
		setLifted(promptBottomFor(RESTING_BOTTOM, bar ? bar.getBoundingClientRect().top : null, window.innerHeight));
	}, [controlsVisible, measureKey]);

	// Holding focus when it ends with the controls up would leave the remote on nothing, so it goes back to them.
	const heldFocusRef = useRef(false);
	const controlsUpRef = useRef(controlsVisible);
	controlsUpRef.current = controlsVisible;
	useEffect(() => () => {
		if (!heldFocusRef.current || !controlsUpRef.current) return;
		window.requestAnimationFrame(() => {
			if (!Spotlight.getCurrent() && !Spotlight.focus('progress-bar')) Spotlight.focus('play-pause-btn');
		});
	}, []);

	const handleFocus = useCallback(() => {
		heldFocusRef.current = true;
	}, []);
	const handleBlur = useCallback(() => {
		heldFocusRef.current = false;
	}, []);

	const showRing = countdownStyle === 'progressBar' || countdownStyle === 'both';
	const showTimer = countdownStyle === 'timer' || countdownStyle === 'both';
	const numberInRing = showTimer && showRing && remainingSeconds < 60;

	return (
		<div className={css.overlay} style={lifted == null ? undefined : {bottom: `${lifted}px`}}>
			<SpottableButton
				className={css.button}
				onClick={onSkip}
				spotlightId={spotlightId}
				onFocus={handleFocus}
				onBlur={handleBlur}
			>
				<SkipGlyph className={css.icon} />
				<span className={css.label}>
					{$L('Skip {segment}').replace('{segment}', $L(SEGMENT_LABELS[type] || SEGMENT_LABELS.intro))}
				</span>
				{showTimer && !numberInRing && (
					<span className={css.timer}>
						{$L('Ends in {time}').replace('{time}', formatRemaining(remainingSeconds))}
					</span>
				)}
				{showRing && (
					<CountdownRing size={RING_SIZE} stroke={RING_STROKE} progress={progress} classes={ringClasses}>
						{numberInRing
							? <span className={css.ringNumber}>{Math.max(0, remainingSeconds)}</span>
							: <SkipGlyph className={css.ringIcon} />}
					</CountdownRing>
				)}
			</SpottableButton>
		</div>
	);
};

export default SkipSegmentOverlay;
