import {getPerfLevelChoice, getPerfLevelIndex} from './perfTier';

// A key press that moves a row or a list scrolls its container in one jump. Here the jump is kept, since all the
// code that scrolls and measures counts on it, and the content is slid from where it was to where it is with a
// transform, which the GPU does without drawing the page again. A container asks for it with
// data-slide-scroll="x" or "y". Its first child slides, or every child when it also says data-slide-content="children".

// The axis each arrow key moves along. A key slides only that axis: going down into a row makes the row scroll sideways
// to put its card in place, and that is not a second move to draw.
const KEY_AXIS = {37: 'x', 38: 'y', 39: 'x', 40: 'y'};
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
// Up and down, a row is often scrolled twice in a row: by the focus, which lands where it likes, and then by the code that
// puts the row back at its resting place on the frames behind it. Drawn as two slides the easing starts over and reads as
// a second move, so the slide waits for the scrolling to be over and is drawn once, from the place the content was.
const QUIET_FRAMES = {x: 0, y: 2};
// Low and Performance have nothing to spare
const LEAN_FROM_LEVEL = 4;

export const slidesAtLevel = (levelIndex) => levelIndex < LEAN_FROM_LEVEL;

// extent is the size of the container along the axis: a jump past it is a long one, a Back to the first row or a
// letter, which flies past more than it shows. auto is the viewer leaving the level to the app, which is not held back
// by what a set's user agent makes of it. keyAxis is the axis of the key pressed, when that is known.
export const shouldSlide = ({distance, extent, sinceKey, held: keyHeld, levelIndex, auto = false, axis, keyAxis}) => (
	(auto || slidesAtLevel(levelIndex)) &&
	!keyHeld &&
	(!keyAxis || axis === keyAxis) &&
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
let lastKeyAxis = null;
let held = false;
const positions = typeof WeakMap === 'function' ? new WeakMap() : null;
// The slides waiting for their scrolling to be over, by container
const waiting = positions ? new WeakMap() : null;
let installed = false;

const onKeyDown = (e) => {
	const axis = KEY_AXIS[e.keyCode];
	if (!axis) return;
	const now = Date.now();
	held = now - lastKeyAt < HELD_GAP_MS;
	lastKeyAt = now;
	lastKeyAxis = axis;
};

// Puts the content where it stands, with whatever slide it has on the way dropped
const settle = (container) => {
	const pending = waiting.get(container);
	if (!pending) return;
	waiting.delete(container);
	window.cancelAnimationFrame(pending.frame);
	pending.nodes.forEach((node) => {
		node.style.transition = '';
		node.style.transform = '';
	});
};

// Lets the content go from where it is shown to where it stands. The page is asked about the start first, since a
// transition only begins from a style it has worked out, and a scroll set from a key press or a timer is not followed
// by that before the next frame.
const release = (nodes, axis, distance) => {
	window.getComputedStyle(nodes[0]).transform; // eslint-disable-line @babel/no-unused-expressions
	const ms = slideMsFor(axis, distance);
	nodes.forEach((node) => {
		node.style.transition = `transform ${ms}ms ${EASE}`;
		node.style.transform = '';
	});
};

const slide = (container, axis, distance) => {
	let pending = waiting.get(container);
	// A scroll that comes while the slide waits is part of it, however small: the code that puts the row back at its resting
	// place moves it a few pixels, which is a correction and not a move of its own. It has to be the key's, and the same
	// press: a key pressed since is a held key or a flurry, which jump as fast as they can.
	const continuing = Boolean(pending) && pending.keyAt === lastKeyAt;
	const ok = shouldSlide({
		distance: continuing ? MIN_DISTANCE : distance,
		extent: continuing ? 0 : (axis === 'x' ? container.clientWidth : container.clientHeight),
		sinceKey: Date.now() - lastKeyAt,
		held,
		levelIndex: getPerfLevelIndex(),
		auto: getPerfLevelChoice() === null,
		axis,
		keyAxis: lastKeyAxis
	});
	if (!ok) {
		// A scroll that is not to be drawn takes the content to where it stands, and does not leave it part way
		// through a slide that was for an earlier one
		settle(container);
		return;
	}
	// A container that scrolls smoothly by itself is not slid on top of that
	if (window.getComputedStyle(container).scrollBehavior === 'smooth') return;
	const nodes = contentOf(container);
	if (!nodes.length) return;

	const quiet = QUIET_FRAMES[axis];
	if (!pending) {
		// The content shows where it was, before the page is drawn
		pending = {nodes, offset: offsetOf(window.getComputedStyle(nodes[0]).transform, axis), frame: 0, quiet: 0, keyAt: lastKeyAt};
	}
	// A row mounted while the slide waits is held with the others and let go with them, and one that has gone from the
	// list is put where it stands
	pending.nodes.forEach((node) => {
		if (nodes.indexOf(node) < 0) {
			node.style.transition = '';
			node.style.transform = '';
		}
	});
	pending.nodes = nodes;
	nodes.forEach((node) => { node.style.transition = 'none'; });
	pending.offset += distance;
	pending.quiet = 0;
	nodes.forEach((node) => { node.style.transform = translate(axis, pending.offset); });

	if (!quiet) {
		waiting.delete(container);
		release(nodes, axis, pending.offset);
		return;
	}
	waiting.set(container, pending);
	// Scrolled again before the frames are up, and the wait starts over
	window.cancelAnimationFrame(pending.frame);
	const step = () => {
		const now = waiting.get(container);
		if (!now) return;
		now.quiet += 1;
		if (now.quiet < quiet) {
			now.frame = window.requestAnimationFrame(step);
			return;
		}
		waiting.delete(container);
		release(now.nodes, axis, now.offset);
	};
	pending.frame = window.requestAnimationFrame(step);
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
	lastKeyAxis = null;
	held = false;
};
