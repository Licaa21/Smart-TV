import {useCallback, useLayoutEffect, useRef} from 'react';
import Spottable from '@enact/spotlight/Spottable';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';

import {pointerHover} from '../../utils/focusScroll';

import css from './DetailsTabBar.module.less';

const Pill = Spottable('div');
const TabContainer = SpotlightContainerDecorator({restrict: 'self-first'}, 'div');

// Moves only the bar, by the least amount that shows the whole tab, since letting the browser
// do it on focus would slide the page the bar sits in as well.
const revealTab = (bar, tab) => {
	if (!bar || !tab) return;
	const left = tab.offsetLeft;
	const right = left + tab.offsetWidth;
	if (left < bar.scrollLeft) bar.scrollLeft = left;
	else if (right > bar.scrollLeft + bar.clientWidth) bar.scrollLeft = right - bar.clientWidth;
};

// A d-pad focusable pill tab bar. The pill highlight and focus states are all in
// CSS, so navigating left and right only moves focus and reports the active id.
const DetailsTabBar = ({tabs, activeId, activeSpotlightId, onSelect, onActivate, expanded = true, spotlightId, className}) => {
	const barRef = useRef(null);

	// The picked tab stays in view when the bar opens or the pick changes without focus.
	useLayoutEffect(() => {
		const bar = barRef.current;
		const active = bar && Array.from(bar.querySelectorAll('[data-id]')).find((tab) => tab.dataset.id === String(activeId));
		revealTab(bar, active);
	}, [activeId, tabs]);

	const handleClick = useCallback((ev) => {
		const id = ev.currentTarget.dataset.id;
		if (id) onActivate?.(id);
	}, [onActivate]);

	const handleFocus = useCallback((ev) => {
		revealTab(barRef.current, ev.currentTarget);
		// With Expanded Tabs on, focus follows selection. Otherwise a tab only
		// opens when it's clicked. A pointer sweeping across the bar would flip
		// the content on every tab it crossed, so it has to click as well.
		if (!expanded || pointerHover()) return;
		const id = ev.currentTarget.dataset.id;
		if (id) onSelect?.(id);
	}, [expanded, onSelect]);

	if (!tabs || tabs.length === 0) return null;

	return (
		<div ref={barRef} className={`${css.tabBar} ${className || ''}`}>
			<TabContainer className={css.track} spotlightId={spotlightId}>
				{tabs.map((tab) => (
					<Pill
						key={tab.id}
						spotlightId={tab.id === activeId ? activeSpotlightId : undefined}
						data-id={tab.id}
						className={`${css.tab} ${tab.id === activeId ? css.tabActive : ''}`}
						onClick={handleClick}
						onFocus={handleFocus}
					>
						{tab.label}
					</Pill>
				))}
			</TabContainer>
		</div>
	);
};

export default DetailsTabBar;
