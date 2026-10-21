import {useCallback} from 'react';
import Spotlight from '@enact/spotlight';

import {channelKeyStep} from '../utils/channelKeys';

// Channel Up goes to the header controls from anywhere in a grid and Channel Down goes back to the cards, as in the
// audio and subtitle menus, so a long grid does not have to be scrolled all the way back up to reach the sort and
// filters. The header and the grid are spotlight ids (or a function that names one, for a header that depends on the
// style). A screen that knows the card to return to gives `focusGrid`, and `enabled` is off while a panel is open.
// The handler goes on the screen's root, where the keys bubble to from the header and from the cards.
const useHeaderGridKeys = (header, grid, enabled = true, focusGrid) => useCallback((e) => {
	if (!enabled) return;
	const step = channelKeyStep(e);
	if (!step) return;
	e.preventDefault();
	e.stopPropagation();
	if (step > 0) {
		Spotlight.focus(typeof header === 'function' ? header() : header);
	} else if (focusGrid) {
		focusGrid();
	} else {
		Spotlight.focus(typeof grid === 'function' ? grid() : grid);
	}
}, [header, grid, enabled, focusGrid]);

export default useHeaderGridKeys;
