import {useCallback, useEffect, useRef} from 'react';

import {useItemMenu} from '../components/ItemContextMenu';
import {LONG_PRESS_MS, isSelectKey} from '../utils/longPress';
import {isMenuKey} from '../utils/keys';

// How long after a pointer lets go of a hold its click can still arrive.
const RELEASE_CLICK_MS = 100;

// Where in its list the card a press landed on sits, for lists whose cards carry a data-index.
export const cardIndexOf = (target) => {
	const card = target.closest('[data-index]');
	return card ? parseInt(card.getAttribute('data-index'), 10) : -1;
};

// The one of `items` whose id the card a press landed on carries in `attribute`.
export const itemWithIdAt = (items, attribute, target) => {
	const card = target.closest(`[${attribute}]`);
	const id = card && card.getAttribute(attribute);
	return (id && items.find((entry) => entry.Id === id)) || null;
};

// A pointer clicks whatever it lets go over, the card or the menu that opened on top of it, so the
// click after a hold is stopped before anything below the window sees it. Spotlight hands a key's
// click straight to the card rather than through the page, so only a pointer's is ever caught.
const swallowReleaseClick = () => {
	const swallow = (e) => {
		e.stopPropagation();
		e.preventDefault();
		window.removeEventListener('click', swallow, true);
	};
	window.addEventListener('click', swallow, true);
	setTimeout(() => window.removeEventListener('click', swallow, true), RELEASE_CLICK_MS);
};

// Holding OK on a card opens its menu rather than the card. Spread the returned props on the card,
// or on the list around a run of cards with `itemAt` finding the card's item from the element the
// press landed on.
//
// A remote may repeat its keydown while OK is held, and the menu takes focus before it's let go, so
// the release can land on the menu as easily as the card. A press is followed from its first
// keydown to its release on the window, the repeats in between are ignored, and a release that
// ends a hold is marked handled so Spotlight doesn't turn it into a click. The handlers run in the
// capture phase, so a list around the cards sees the press before a card acts on it.
const useItemMenuHold = (itemAt, options) => {
	const menu = useItemMenu();
	const pressRef = useRef(null);

	const cancel = useCallback(() => {
		pressRef.current?.end();
	}, []);

	useEffect(() => cancel, [cancel]);

	const start = useCallback((target) => {
		if (pressRef.current || !menu) return;
		const item = itemAt(target);
		if (!item || !menu.canOpen(item, options)) return;

		const press = {held: false};
		press.end = () => {
			clearTimeout(press.timer);
			window.removeEventListener('keyup', press.onRelease, true);
			window.removeEventListener('mouseup', press.onRelease, true);
			pressRef.current = null;
		};
		press.onRelease = (e) => {
			if (e.type === 'keyup' && !isSelectKey(e)) return;
			press.end();
			if (!press.held) return;
			e.preventDefault();
			swallowReleaseClick();
		};
		press.timer = setTimeout(() => {
			press.held = true;
			menu.open(item, options);
		}, LONG_PRESS_MS);

		window.addEventListener('keyup', press.onRelease, true);
		window.addEventListener('mouseup', press.onRelease, true);
		pressRef.current = press;
	}, [menu, itemAt, options]);

	const handleKeyDownCapture = useCallback((e) => {
		if (isMenuKey(e)) {
			const item = itemAt(e.target);
			if (!item || !menu?.canOpen(item, options)) return;
			e.preventDefault();
			e.stopPropagation();
			menu.open(item, options);
			return;
		}
		if (isSelectKey(e)) start(e.target);
	}, [start, menu, itemAt, options]);

	const handleMouseDownCapture = useCallback((e) => start(e.target), [start]);

	// Leaving the card calls off a hold still counting down. Once the menu is up it sits under the
	// pointer, so leaving then is only the menu arriving.
	const handleMouseLeave = useCallback(() => {
		if (pressRef.current && !pressRef.current.held) cancel();
	}, [cancel]);

	return {
		onKeyDownCapture: handleKeyDownCapture,
		onMouseDownCapture: handleMouseDownCapture,
		onMouseLeave: handleMouseLeave
	};
};

export default useItemMenuHold;
