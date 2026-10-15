import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import $L from '@enact/i18n/$L';
import Spotlight from '@enact/spotlight';
import {useSettings} from '../../context/SettingsContext';
import {SpottableButton} from './PlayerConstants';
import {CountdownRing, SkipGlyph, formatRemaining, useOverlayFocus} from './overlayParts';
import {resolveSkipOverlayLook} from './skipOverlayLook';

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

// The bar of controls the prompt has to clear, marked by the player, and the room kept between them.
const CONTROLS_SELECTOR = '[data-player-controls-bottom]';
const CONTROLS_GAP = 24;

// How far from the bottom edge the prompt sits while the controls are up: above them, the way the subtitles are lifted,
// and where it always rests once they are gone. Null leaves it where the stylesheet puts it.
export const promptBottomFor = (restingBottom, controlsTop, innerHeight) => {
	if (restingBottom == null || !Number.isFinite(controlsTop)) return null;
	const clear = Math.round(innerHeight - controlsTop + CONTROLS_GAP);
	return clear > restingBottom ? clear : null;
};

const ringClasses = {ring: css.ring, svg: css.ringSvg, track: css.ringTrack, value: css.ringValue, center: css.ringCenter};

// What each layout adds to the base button. The capsule is the base and needs nothing.
const LAYOUT_CLASS = {
	capsule: '',
	rectangle: css.layoutRectangle,
	sweep: css.layoutSweep
};

/**
 * Offers to jump past a segment the server marked up. The ring drains for as long
 * as the segment has left to run, so the prompt going away is never a surprise.
 *
 * How it is built, where it sits, how big it is and what colors it wears come from the Skip
 * Intro/Recap/Credits page in settings. With those left alone it is the prompt it has always
 * been. The layouts differ in shape and in how the countdown is drawn: a ring in the capsule, a
 * bar along the bottom edge of the light rectangle, or a fill sweeping across. `preview` draws the same thing inert, inside the settings screen, in place
 * of over the video.
 */
const SkipSegmentOverlay = ({type, remainingSeconds, progress, countdownStyle, onSkip, spotlightId, preview = false, controlsVisible = false, measureKey}) => {
	const {settings} = useSettings();
	const look = resolveSkipOverlayLook(settings);
	const [focused, setFocused] = useState(false);
	const heldFocusRef = useRef(false);
	const controlsUpRef = useRef(controlsVisible);
	controlsUpRef.current = controlsVisible;
	const handleFocus = useCallback(() => {
		heldFocusRef.current = true;
		setFocused(true);
	}, []);
	const handleBlur = useCallback(() => {
		heldFocusRef.current = false;
		setFocused(false);
	}, []);
	// The prompt takes the remote while the controls are away. With them up it leaves focus to them, and is reached with
	// Up from the playback bar.
	useOverlayFocus(preview || controlsVisible ? null : spotlightId);

	// Lifted above the bar of controls while it is up, and eased back down when it goes, as the subtitles are.
	const [lifted, setLifted] = useState(null);
	useLayoutEffect(() => {
		if (preview || !controlsVisible || look.bottomEdge == null) {
			setLifted(null);
			return;
		}
		const bar = document.querySelector(CONTROLS_SELECTOR);
		setLifted(promptBottomFor(look.bottomEdge, bar ? bar.getBoundingClientRect().top : null, window.innerHeight));
	}, [preview, controlsVisible, look.bottomEdge, measureKey]);

	// Holding focus when it ends with the controls up would leave the remote on nothing, so it goes back to them.
	useEffect(() => () => {
		if (preview || !heldFocusRef.current || !controlsUpRef.current) return;
		window.requestAnimationFrame(() => {
			if (!Spotlight.getCurrent() && !Spotlight.focus('progress-bar')) Spotlight.focus('play-pause-btn');
		});
	}, [preview]);

	const layout = look.layout;
	const isCapsule = layout === 'capsule';
	const showRing = countdownStyle === 'progressBar' || countdownStyle === 'both';
	const showTimer = countdownStyle === 'timer' || countdownStyle === 'both';
	// Only the capsule has a ring to hold the number, so anywhere else the timer stays as text.
	const numberInRing = isCapsule && showTimer && showRing && remainingSeconds < 60;
	const percent = `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%`;

	// The border only shows while the button holds focus, and a preview always looks focused.
	const focusedLook = focused || preview;
	const button = focusedLook
		? {...look.button, borderColor: look.accent || undefined}
		: look.button;
	const Button = preview ? 'div' : SpottableButton;
	const buttonProps = preview
		? {}
		: {onClick: onSkip, spotlightId, onFocus: handleFocus, onBlur: handleBlur};
	const buttonClass = [css.button, LAYOUT_CLASS[layout], preview ? css.buttonPreview : ''].filter(Boolean).join(' ');

	return (
		<div className={preview ? css.overlayPreview : css.overlay} style={lifted == null ? look.overlay : {...look.overlay, bottom: `${lifted}px`}}>
			<Button className={buttonClass} style={button} {...buttonProps}>
				{layout === 'sweep' && showRing && (
					<span className={css.sweep} style={{...look.sweep, width: percent}} />
				)}
				{layout !== 'sweep' && <SkipGlyph className={css.icon} style={look.icon} />}
				<span className={css.label}>
					{$L('Skip {segment}').replace('{segment}', $L(SEGMENT_LABELS[type] || SEGMENT_LABELS.intro))}
				</span>
				{showTimer && !numberInRing && (
					<span className={css.timer} style={look.timer}>
						{$L('Ends in {time}').replace('{time}', formatRemaining(remainingSeconds))}
					</span>
				)}
				{isCapsule && showRing && (
					<CountdownRing
						size={RING_SIZE}
						stroke={RING_STROKE}
						progress={progress}
						classes={ringClasses}
						trackStyle={look.ringTrack}
						valueStyle={look.ringValue}
					>
						{numberInRing
							? <span className={css.ringNumber}>{Math.max(0, remainingSeconds)}</span>
							: <SkipGlyph className={css.ringIcon} style={look.icon} />}
					</CountdownRing>
				)}
				{layout === 'rectangle' && showRing && (
					<span className={css.bar}>
						<span className={css.barFill} style={{...look.bar, width: percent}} />
					</span>
				)}
			</Button>
		</div>
	);
};

export default SkipSegmentOverlay;
