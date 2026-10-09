import {useLayoutEffect, useState} from 'react';

import {subtitleBottomPercent} from '../../utils/subtitleConstants';

// What the subtitles have to clear: the bar of controls, and the description shown while paused. Each marks
// itself with an attribute, so the same hook serves both players.
const CONTROLS_SELECTOR = '[data-player-controls-bottom]';
const DESCRIPTION_SELECTOR = '[data-pause-description]';

const topOf = (selector) => {
	const node = document.querySelector(selector);
	return node ? node.getBoundingClientRect().top : null;
};

// How far up the subtitles have to go so that their bottom edge sits on the highest thing in the way. Zero
// when nothing is there or they already rest above it.
export const subtitleLiftFor = (restingBottom, obstacleTops) => {
	const tops = obstacleTops.filter((top) => Number.isFinite(top));
	if (!tops.length) return 0;
	return Math.max(0, Math.round(restingBottom - Math.min(...tops)));
};

export const useSubtitleLift = ({controlsVisible, descriptionShown, settings, measureKey}) => {
	const [lift, setLift] = useState(0);
	const bottomPercent = subtitleBottomPercent(settings);

	useLayoutEffect(() => {
		const tops = [];
		if (controlsVisible) tops.push(topOf(CONTROLS_SELECTOR));
		if (descriptionShown) tops.push(topOf(DESCRIPTION_SELECTOR));
		setLift(subtitleLiftFor(window.innerHeight * (1 - bottomPercent / 100), tops));
	// measureKey is whatever changes how tall the controls or the description are, such as the title playing
	}, [controlsVisible, descriptionShown, bottomPercent, measureKey]);

	return lift;
};
