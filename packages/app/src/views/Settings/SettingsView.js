import {ViewContainer} from './settingsSpottables';

import {keepFocusInView, pointerHover} from '../../utils/focusScroll';

import css from './Settings.module.less';

// The frame every settings screen sits in. Each one is a single spotlight container, which
// is also what the focus fallback lands on when a screen has nothing better to offer.
// Reaching the first row brings the page back to its top. Nothing focusable sits above that row,
// so keeping only the row in view left the heading and the text over it past the edge of the
// screen, with no way to scroll up to them.
const handleFocus = (e) => {
	keepFocusInView(e);
	if (pointerHover()) return;
	const container = e.currentTarget;
	const first = container.querySelector('.spottable');
	if (first && first.contains(e.target)) container.scrollTop = 0;
};

const SettingsView = ({spotlightId, children}) => {
	return (
		<ViewContainer className={css.viewContainer} spotlightId={spotlightId}>
			<div className={css.listContent} onFocus={handleFocus}>
				<div className={css.listInner}>
					{children}
				</div>
			</div>
		</ViewContainer>
	);
};

export default SettingsView;
