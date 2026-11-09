import {endPendingSlide, isWritingGlide, notePendingSlide, noteSlide, resetGlideState, smoothScrollingOn} from './glideState';
import {getPerfLevelChoice, getPerfLevelIndex} from './perfTier';

// A key press that moves a row or a list scrolls its container in one jump. Here the jump is kept, since all the
// code that scrolls and measures counts on it, and the content is slid from where it was to where it is with a
// transform, which the GPU does without drawing the page again. A container asks for it with
// data-slide-scroll="x" or "y". Its first child slides, or every child when it also says data-slide-content="children".

// The axis each arrow key moves along. A key slides only that axis: going down into a row makes the row scroll sideways
// to put its card in place, and that is not a second move to draw.
const KEY_AXIS = {37: 'x', 38: 'y', 39: 'x', 40: 'y'};
// A scroll this soon after an arrow key is that key's. Anything else, a restore on the way back to a screen or a
// pointer, is left to jump. The Q67A takes about 85 ms to draw a frame, and up and down the scroll comes after the focus has
// been handled and a frame or two behind it, which was over the 350 ms this was and left the slide out (2.0.6, the video).
// Not longer, or the corrections and reflows that come later would each be drawn as a move of their own. Only the up and
// down list waits out its corrections; a row that scrolls sideways has no wait, so its window stays short.
const KEY_WINDOW_MS = {x: 350, y: 700};
const windowOf = (axis) => KEY_WINDOW_MS[axis] || KEY_WINDOW_MS.x;
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
// a second move, so the slide waits for the scrolling to be over and is drawn once, from the place the content was. It
// waits a time and not frames: two frames were 170 ms on the TV, and the card had swapped long before the list moved.
const QUIET_MS = {x: 0, y: 50};
// ...and never more than this many frames, so a clock that jumped back cannot leave a list drawn where it is not
const QUIET_MAX_FRAMES = 4;
// What a pending slide is guessed to last beyond the slide and the wait: a frame or two of the TV
const PENDING_MARGIN_MS = 140;
// A scroll later than this after the key is not a key's move to count, but a restore or a pointer
const COUNTED_MS = 3000;
// Low and Performance have nothing to spare
const LEAN_FROM_LEVEL = 4;

export const slidesAtLevel = (levelIndex) => levelIndex < LEAN_FROM_LEVEL;

// extent is the size of the container along the axis: a jump past it is a long one, a Back to the first row or a
// letter, which flies past more than it shows. auto is the viewer leaving the level to the app, which is not held back
// by what a user agent makes of it. keyAxis is the axis of the key pressed, when that is known. Up and down follow the
// Smooth Scrolling switch, since the slide is what draws that move (the sideways slide has no switch).
export const shouldSlide = ({distance, extent, sinceKey, held: keyHeld, levelIndex, auto = false, axis, keyAxis, smooth = true}) => (
	(auto || slidesAtLevel(levelIndex)) &&
	(axis !== 'y' || smooth) &&
	!keyHeld &&
	(!keyAxis || axis === keyAxis) &&
	sinceKey >= 0 && sinceKey <= windowOf(axis) &&
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
// The lists with an up or down slide waiting, so one that drops its slide does not end what another is still doing
const slidingLists = new Set();
let installed = false;

const onKeyDown = (e) => {
	const axis = KEY_AXIS[e.keyCode];
	if (!axis) return;
	const now = Date.now();
	held = now - lastKeyAt < HELD_GAP_MS;
	lastKeyAt = now;
	lastKeyAxis = axis;
};

const slideAxisOf = (container) => {
	const axis = container && container.getAttribute ? container.getAttribute('data-slide-scroll') : null;
	return axis === 'x' || axis === 'y' ? axis : null;
};

// Puts the content where it stands, with whatever slide it has on the way dropped
const settle = (container) => {
	const pending = waiting.get(container);
	if (!pending) return;
	waiting.delete(container);
	if (pending.axis === 'y') {
		slidingLists.delete(container);
		if (slidingLists.size === 0) endPendingSlide();
	}
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
	// Whatever waits for a glide to be still waits for the slide as long as it really takes, which is known only now
	if (axis === 'y') noteSlide(ms + 40);
	nodes.forEach((node) => {
		node.style.transition = `transform ${ms}ms ${EASE}`;
		node.style.transform = '';
	});
};

const slideArgs = (container, axis, distance, pending) => {
	// A scroll that comes while the slide waits is part of it, however small: the code that puts the row back at its resting
	// place moves it a few pixels, which is a correction and not a move of its own. It has to be the key's, and the same
	// press: a key pressed since is a held key or a flurry, which jump as fast as they can.
	const continuing = Boolean(pending) && pending.keyAt === lastKeyAt;
	return {
		distance: continuing ? MIN_DISTANCE : distance,
		extent: continuing ? 0 : (axis === 'x' ? container.clientWidth : container.clientHeight),
		sinceKey: Date.now() - lastKeyAt,
		held,
		levelIndex: getPerfLevelIndex(),
		auto: getPerfLevelChoice() === null,
		axis,
		keyAxis: lastKeyAxis,
		smooth: smoothScrollingOn()
	};
};

// Up and down, what became of each move that was big enough to draw, for the report: slid, or why not. The Q67A did not
// slide in the video of 2.0.6 and nothing said why.
const moves = {};
// Counted once for each list and each key press, since a move is scrolled more than once (the focus, then the correction)
let counted = positions ? new WeakMap() : null;
const countMove = (container, axis, distance, args, pending, key) => {
	// Only a move that a key plausibly made, not a correction in a slide that waits, a restore or a pointer
	if (!counted || axis !== 'y' || pending || Math.abs(distance) < MIN_DISTANCE || args.sinceKey < 0 || args.sinceKey > COUNTED_MS) return;
	if (counted.get(container) === lastKeyAt) return;
	counted.set(container, lastKeyAt);
	moves[key] = (moves[key] || 0) + 1;
};
export const takeSlideMoves = () => {
	const taken = {...moves};
	Object.keys(moves).forEach((key) => delete moves[key]);
	return taken;
};
const whyNot = (a) => {
	if (!(a.auto || slidesAtLevel(a.levelIndex))) return 'level';
	if (!a.smooth) return 'off';
	if (a.held && a.sinceKey <= windowOf(a.axis)) return 'held';
	if (a.keyAxis && a.axis !== a.keyAxis) return 'otherKey';
	if (!(a.sinceKey >= 0 && a.sinceKey <= windowOf(a.axis))) return 'late';
	return a.extent > 0 && Math.abs(a.distance) > a.extent ? 'long' : 'other';
};

// A held key of this axis, still held: its scrolls jump, and what eases under them is taken to where it ends
// (a held key is held for the short window whatever the axis: after the release, a correction glides)
const HELD_JUMP_MS = 350;
const jumpsNow = (axis) => held && lastKeyAxis === axis && Date.now() - lastKeyAt <= HELD_JUMP_MS;

// What a list that asks for the slide is to do with a scroll about to be made: slide it, jump it (a held key or a flurry
// goes as fast as it can), or leave it to the glide, which draws what the slide does not take, such as a Low level.
export const slideDecision = (container, axis, distance) => {
	if (!waiting) return 'glide';
	const args = slideArgs(container, axis, distance, waiting.get(container));
	if (shouldSlide(args)) return 'slide';
	// A key held a while ago is not held now, and a held key of the other axis is not what moves this list
	if (jumpsNow(axis)) return 'jump';
	// The glide writes the scroll without the slide seeing it, so the refusal is counted here
	countMove(container, axis, distance, args, waiting.get(container), whyNot(args));
	return 'glide';
};

const slide = (container, axis, distance) => {
	let pending = waiting.get(container);
	const args = slideArgs(container, axis, distance, pending);
	if (!shouldSlide(args)) {
		countMove(container, axis, distance, args, pending, whyNot(args));
		// A scroll that is not to be drawn takes the content to where it stands, and does not leave it part way
		// through a slide that was for an earlier one. One already let go and easing is taken to where it ends only for a
		// held key, which jumps; a correction of a few pixels leaves it to ease.
		settle(container);
		if (jumpsNow(axis) && slideAxisOf(container) === axis) {
			contentOf(container).forEach((node) => {
				if (node.style.transition || node.style.transform) {
					node.style.transition = '';
					node.style.transform = '';
				}
			});
		}
		return;
	}
	// A container that scrolls smoothly by itself is not slid on top of that
	if (window.getComputedStyle(container).scrollBehavior === 'smooth') return;
	const nodes = contentOf(container);
	if (!nodes.length) return;

	const quiet = QUIET_MS[axis];
	if (axis === 'y') slidingLists.add(container);
	if (!pending) {
		if (axis === 'y') countMove(container, axis, distance, args, null, 'slide');
		// The content shows where it was, before the page is drawn
		pending = {nodes, offset: offsetOf(window.getComputedStyle(nodes[0]).transform, axis), frame: 0, at: 0, frames: 0, keyAt: lastKeyAt, axis};
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
	pending.at = Date.now();
	pending.frames = 0;
	// What waits for a glide to be still waits for this slide too: the frames it waits for the scrolling, and the slide as far as
	// it is known now
	if (axis === 'y') notePendingSlide(slideMsFor(axis, pending.offset) + quiet + PENDING_MARGIN_MS);
	nodes.forEach((node) => { node.style.transform = translate(axis, pending.offset); });

	if (!quiet) {
		waiting.delete(container);
		slidingLists.delete(container);
		if (axis === 'y' && slidingLists.size === 0) endPendingSlide();
		release(nodes, axis, pending.offset);
		return;
	}
	waiting.set(container, pending);
	// Scrolled again before the time is up, and the wait starts over
	window.cancelAnimationFrame(pending.frame);
	const step = () => {
		const now = waiting.get(container);
		if (!now) return;
		now.frames += 1;
		const waited = Date.now() - now.at;
		if (waited >= 0 && waited < quiet && now.frames < QUIET_MAX_FRAMES) {
			now.frame = window.requestAnimationFrame(step);
			return;
		}
		waiting.delete(container);
		slidingLists.delete(container);
		if (axis === 'y' && slidingLists.size === 0) endPendingSlide();
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
			// A glide that draws what the slide does not take writes every frame, and none of it is for the slide
			if (isWritingGlide()) {
				descriptor.set.call(this, value);
				positions.set(this, descriptor.get.call(this));
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
	takeSlideMoves();
	if (counted) counted = new WeakMap();
	slidingLists.clear();
	resetGlideState();
	lastKeyAt = 0;
	lastKeyAxis = null;
	held = false;
};
