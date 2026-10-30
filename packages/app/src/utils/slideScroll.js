import {getPerfLevelIndex} from './perfTier';

// A key press that moves a row or a list scrolls its container in one jump. Here the jump is kept, since all the
// code that scrolls and measures counts on it, and the content is slid from where it was to where it is with a
// transform, which the GPU does without drawing the page again. A container asks for it with
// data-slide-scroll="x" or "y". Its first child slides, or every child when it also says data-slide-content="children".

const ARROW_KEYS = {37: true, 38: true, 39: true, 40: true};
// A scroll this soon after an arrow key is that key's. Anything else, a restore on the way back to a screen or a
// pointer, is left to jump.
const KEY_WINDOW_MS = 350;
// Arrow keys closer than this are a held key or a flurry of presses, which go as fast as they can
const HELD_GAP_MS = 200;
// A move shorter than this is not worth drawing
const MIN_DISTANCE = 6;
// A short move is quick, and a long one, a row that scrolled several cards at once, takes longer so it can be followed
export const SLIDE_MS = {x: 130, y: 180};
const MAX_SLIDE_MS = {x: 260, y: 320};
const MS_PER_PX = 0.1;
export const slideMsFor = (axis, distance) => Math.round(Math.min(MAX_SLIDE_MS[axis], SLIDE_MS[axis] + Math.abs(distance) * MS_PER_PX));
const EASE = 'cubic-bezier(0.2, 0.7, 0.2, 1)';
// Low and Performance have nothing to spare
const LEAN_FROM_LEVEL = 4;

export const slidesAtLevel = (levelIndex) => levelIndex < LEAN_FROM_LEVEL;

// extent is the size of the container along the axis: a jump past it is a long one, a Back to the first row or a
// letter, which flies past more than it shows.
export const shouldSlide = ({distance, extent, sinceKey, held: keyHeld, levelIndex}) => (
	slidesAtLevel(levelIndex) &&
	!keyHeld &&
	sinceKey >= 0 && sinceKey <= KEY_WINDOW_MS &&
	Math.abs(distance) >= MIN_DISTANCE &&
	(!(extent > 0) || Math.abs(distance) <= extent)
);

const translate = (axis, offset) => (axis === 'x' ? `translate3d(${offset}px, 0, 0)` : `translate3d(0, ${offset}px, 0)`);

// How far a slide still on its way has the content from its place, read from the matrix it is drawn with, so a press
// in the middle of one carries on from where it stands
export const offsetOf = (transform, axis) => {
	const match = /^matrix(3d)?\(([^)]+)\)$/.exec(transform || '');
	if (!match) return 0;
	const values = match[2].split(',').map(parseFloat);
	const at = match[1] ? (axis === 'x' ? 12 : 13) : (axis === 'x' ? 4 : 5);
	return Number.isFinite(values[at]) ? values[at] : 0;
};

const contentOf = (container) => (
	container.getAttribute('data-slide-content') === 'children'
		? Array.prototype.slice.call(container.children)
		: (container.firstElementChild ? [container.firstElementChild] : [])
);

let lastKeyAt = 0;
let held = false;
const positions = typeof WeakMap === 'function' ? new WeakMap() : null;
let installed = false;

const onKeyDown = (e) => {
	if (!ARROW_KEYS[e.keyCode]) return;
	const now = Date.now();
	held = now - lastKeyAt < HELD_GAP_MS;
	lastKeyAt = now;
};

// The content is put where it was, the page is told to take that in, and it is let go at once with a transition, so
// the first frame drawn is where it was. A transition only starts from a style the page has worked out, and a scroll
// set from a key press or a timer is not followed by that before the next frame, so the page is asked for it here.
const slide = (container, axis, distance) => {
	const ok = shouldSlide({
		distance,
		extent: axis === 'x' ? container.clientWidth : container.clientHeight,
		sinceKey: Date.now() - lastKeyAt,
		held,
		levelIndex: getPerfLevelIndex()
	});
	if (!ok) return;
	// A container that scrolls smoothly by itself is not slid on top of that
	if (window.getComputedStyle(container).scrollBehavior === 'smooth') return;
	const nodes = contentOf(container);
	if (!nodes.length) return;
	nodes.forEach((node) => {
		const start = offsetOf(window.getComputedStyle(node).transform, axis) + distance;
		node.style.transition = 'none';
		node.style.transform = translate(axis, start);
	});
	// Takes the starts in
	window.getComputedStyle(nodes[0]).transform; // eslint-disable-line @babel/no-unused-expressions
	const ms = slideMsFor(axis, distance);
	nodes.forEach((node) => {
		node.style.transition = `transform ${ms}ms ${EASE}`;
		node.style.transform = '';
	});
};

// Where a node is without the slide that is moving it, for code that measures with getBoundingClientRect. The slide
// is on the child of the marked container that the node is in, along the axis the container slides on.
export const slideShiftOf = (node) => {
	let child = node;
	while (child && child.parentNode && !(child.parentNode.getAttribute && child.parentNode.getAttribute('data-slide-scroll'))) {
		child = child.parentNode;
	}
	const parent = child && child.parentNode;
	const axis = parent && parent.getAttribute ? parent.getAttribute('data-slide-scroll') : null;
	if (axis !== 'x' && axis !== 'y') return {x: 0, y: 0};
	const offset = offsetOf(window.getComputedStyle(child).transform, axis);
	return axis === 'x' ? {x: offset, y: 0} : {x: 0, y: offset};
};

// getBoundingClientRect without the slide, so a card or a row is measured where it stands and not where it is drawn
export const layoutRectOf = (node) => {
	const rect = node.getBoundingClientRect();
	const shift = slideShiftOf(node);
	return {
		left: rect.left - shift.x,
		right: rect.right - shift.x,
		top: rect.top - shift.y,
		bottom: rect.bottom - shift.y,
		width: rect.width,
		height: rect.height
	};
};

// The position a container was last seen at. Nothing is known of one before its first scroll, and it starts at its edge.
const moved = (container, axis, position) => {
	const previous = positions.has(container) ? positions.get(container) : 0;
	positions.set(container, position);
	return position - previous;
};

const slideAxisOf = (container) => {
	const axis = container && container.getAttribute ? container.getAttribute('data-slide-scroll') : null;
	return axis === 'x' || axis === 'y' ? axis : null;
};

const onScroll = (e) => {
	const container = e.target;
	if (!container || container.nodeType !== 1) return;
	const axis = slideAxisOf(container);
	if (!axis) return;
	// A move the setter below has seen already is no distance now
	const distance = moved(container, axis, axis === 'x' ? container.scrollLeft : container.scrollTop);
	if (distance) slide(container, axis, distance);
};

// Code that sets a scroll position does it from wherever it likes, often inside an animation frame, and the scroll
// event for it comes a frame later, which would leave one frame drawn at the new place before the slide began. So the
// slide starts when the position is set. The event that follows finds nothing left to move.
const watchSetter = (name, axis) => {
	const proto = typeof window !== 'undefined' && window.Element ? window.Element.prototype : null;
	const descriptor = proto && Object.getOwnPropertyDescriptor(proto, name);
	if (!descriptor || !descriptor.get || !descriptor.set) return;
	Object.defineProperty(proto, name, {
		configurable: true,
		enumerable: descriptor.enumerable,
		get: descriptor.get,
		set(value) {
			if (slideAxisOf(this) !== axis) {
				descriptor.set.call(this, value);
				return;
			}
			const before = descriptor.get.call(this);
			// A baseline for a container the setter is the first to see
			if (!positions.has(this)) positions.set(this, before);
			descriptor.set.call(this, value);
			const distance = moved(this, axis, descriptor.get.call(this));
			if (distance) slide(this, axis, distance);
		}
	});
};

// Once, from the entry point. The scroll event does not bubble, so it is caught on its way down.
export const installSlideScroll = (target = typeof document !== 'undefined' ? document : null) => {
	if (installed || !target || !positions) return;
	installed = true;
	target.addEventListener('keydown', onKeyDown, true);
	target.addEventListener('scroll', onScroll, true);
	watchSetter('scrollLeft', 'x');
	watchSetter('scrollTop', 'y');
};

// For the tests
export const resetSlideScroll = () => {
	lastKeyAt = 0;
	held = false;
};
