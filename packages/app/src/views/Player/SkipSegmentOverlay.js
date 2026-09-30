import {useCallback, useState} from 'react';
import $L from '@enact/i18n/$L';
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

const ringClasses = {ring: css.ring, svg: css.ringSvg, track: css.ringTrack, value: css.ringValue, center: css.ringCenter};

/**
 * Offers to jump past a segment the server marked up. The ring drains for as long
 * as the segment has left to run, so the prompt going away is never a surprise.
 *
 * Where it sits, how big it is and what colors it wears come from the Skip Intro/Recap/Credits
 * page in settings. With those left alone it is the prompt it has always been. `preview` draws
 * the same thing inert, inside the settings screen, in place of over the video.
 */
const SkipSegmentOverlay = ({type, remainingSeconds, progress, countdownStyle, onSkip, spotlightId, preview = false}) => {
	const {settings} = useSettings();
	const look = resolveSkipOverlayLook(settings);
	const [focused, setFocused] = useState(false);
	const handleFocus = useCallback(() => setFocused(true), []);
	const handleBlur = useCallback(() => setFocused(false), []);
	useOverlayFocus(preview ? null : spotlightId);

	const showRing = countdownStyle === 'progressBar' || countdownStyle === 'both';
	const showTimer = countdownStyle === 'timer' || countdownStyle === 'both';
	const numberInRing = showTimer && showRing && remainingSeconds < 60;

	// The border only shows while the button holds focus, and a preview always looks focused.
	const button = look.accent && (focused || preview)
		? {...look.button, borderColor: look.accent}
		: look.button;
	const Button = preview ? 'div' : SpottableButton;
	const buttonProps = preview
		? {}
		: {onClick: onSkip, spotlightId, onFocus: handleFocus, onBlur: handleBlur};

	return (
		<div className={preview ? css.overlayPreview : css.overlay} style={look.overlay}>
			<Button className={preview ? `${css.button} ${css.buttonPreview}` : css.button} style={button} {...buttonProps}>
				<SkipGlyph className={css.icon} style={look.icon} />
				<span className={css.label}>
					{$L('Skip {segment}').replace('{segment}', $L(SEGMENT_LABELS[type] || SEGMENT_LABELS.intro))}
				</span>
				{showTimer && !numberInRing && (
					<span className={css.timer} style={look.timer}>
						{$L('Ends in {time}').replace('{time}', formatRemaining(remainingSeconds))}
					</span>
				)}
				{showRing && (
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
			</Button>
		</div>
	);
};

export default SkipSegmentOverlay;
