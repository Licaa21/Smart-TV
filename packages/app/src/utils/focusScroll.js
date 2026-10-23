import Spotlight from '@enact/spotlight';

// Spotlight focuses without scrolling, so anything taller than its box has to
// bring the focused row into view itself. scrollIntoView options are ignored on
// older Tizen and webOS WebKit, which would leave the row parked off screen, so
// the scroller is nudged by hand instead.
const SCROLL_PADDING = 24;

// True while a pointer is driving focus. A hovered element already sits under
// the cursor, so scrolling it into place would slide it away from the pointer
// and land the hover on whatever came in behind it. Anything that scrolls or
// acts on focus alone should answer key driven focus only.
export const pointerHover = () => Spotlight.getPointerMode();

// One animation per scroller, since a held key would otherwise stack loops that fight over the offset.
const scrollFrames = new WeakMap();

export const stopScrollAnimation = (node) => {
	window.cancelAnimationFrame(scrollFrames.get(node));
	scrollFrames.delete(node);
};

export const animateScrollTop = (node, target, duration) => {
	stopScrollAnimation(node);
	const from = node.scrollTop;
	const distance = target - from;
	if (!distance) return;
	const started = Date.now();
	const step = () => {
		const t = Math.min(1, (Date.now() - started) / duration);
		node.scrollTop = from + distance * (1 - Math.pow(1 - t, 3));
		if (t < 1) scrollFrames.set(node, window.requestAnimationFrame(step));
		else scrollFrames.delete(node);
	};
	scrollFrames.set(node, window.requestAnimationFrame(step));
};

/**
 * Scrolls the focused element into view inside its container, on whichever axis
 * it has run past the edge. Goes straight on the scrolling element as its
 * onFocus handler. A container that only scrolls one way ignores the other,
 * since setting the offset it has no room for does nothing.
 *
 * @param {Object} e - the focus event, whose currentTarget is the scroller
 */
export const keepFocusInView = (e) => {
	if (pointerHover()) return;
	const container = e.currentTarget;
	const el = e.target;
	if (!container || !el || !el.getBoundingClientRect) return;
	const view = container.getBoundingClientRect();
	const row = el.getBoundingClientRect();
	if (row.top < view.top) {
		container.scrollTop -= (view.top - row.top) + SCROLL_PADDING;
	} else if (row.bottom > view.bottom) {
		container.scrollTop += (row.bottom - view.bottom) + SCROLL_PADDING;
	}
	if (row.left < view.left) {
		container.scrollLeft -= (view.left - row.left) + SCROLL_PADDING;
	} else if (row.right > view.right) {
		container.scrollLeft += (row.right - view.right) + SCROLL_PADDING;
	}
};
