import {SLIDE_MS, installSlideScroll, slideMsFor, layoutRectOf, offsetOf, resetSlideScroll, shouldSlide, slideShiftOf, slidesAtLevel} from './slideScroll';

let mockLevel = 3;
// What the viewer picked, or null for Auto
let mockChoice = 'mid';
jest.mock('./perfTier', () => ({getPerfLevelIndex: () => mockLevel, getPerfLevelChoice: () => mockChoice}));

describe('what slides', () => {
	const press = {distance: 120, extent: 600, sinceKey: 30, held: false, levelIndex: 3};

	it('slides a move a key press made', () => {
		expect(shouldSlide(press)).toBe(true);
		expect(shouldSlide({...press, distance: -120})).toBe(true);
	});

	it('leaves a scroll no key made, such as a restore, a pointer or an old press', () => {
		expect(shouldSlide({...press, sinceKey: 5000})).toBe(false);
		expect(shouldSlide({...press, sinceKey: -1})).toBe(false);
	});

	it('leaves a held key and a long jump to go as fast as they can', () => {
		expect(shouldSlide({...press, held: true})).toBe(false);
		expect(shouldSlide({...press, distance: 900})).toBe(false);
	});

	it('leaves a move too small to see', () => {
		expect(shouldSlide({...press, distance: 3})).toBe(false);
	});

	it('is off from Medium-low down, where there is nothing to spare, unless the level was left to Auto', () => {
		expect(slidesAtLevel(3)).toBe(true);
		expect(slidesAtLevel(4)).toBe(false);
		expect(slidesAtLevel(5)).toBe(false);
		expect(shouldSlide({...press, levelIndex: 4})).toBe(false);
		// A Samsung set reads as the lowest level on Auto, which is its user agent and not the set
		expect(shouldSlide({...press, levelIndex: 5, auto: true})).toBe(true);
	});

	it('slides only the axis of the key', () => {
		expect(shouldSlide({...press, axis: 'y', keyAxis: 'y'})).toBe(true);
		expect(shouldSlide({...press, axis: 'x', keyAxis: 'y'})).toBe(false);
		expect(shouldSlide({...press, axis: 'y', keyAxis: 'x'})).toBe(false);
	});
});

describe('how long a slide takes', () => {
	it('is quick for a short move and longer for a long one, up to a limit', () => {
		expect(slideMsFor('x', 20)).toBeCloseTo(SLIDE_MS.x + 2, 0);
		expect(slideMsFor('x', 288)).toBeGreaterThan(slideMsFor('x', 20));
		expect(slideMsFor('x', 5000)).toBe(260);
		expect(slideMsFor('y', 5000)).toBe(320);
		expect(slideMsFor('y', -400)).toBe(slideMsFor('y', 400));
	});
});

describe('the offset of a slide on its way', () => {
	it('reads it off the matrix, along the axis asked for', () => {
		expect(offsetOf('matrix(1, 0, 0, 1, 40, 70)', 'x')).toBe(40);
		expect(offsetOf('matrix(1, 0, 0, 1, 40, 70)', 'y')).toBe(70);
		expect(offsetOf('matrix3d(1,0,0,0, 0,1,0,0, 0,0,1,0, 40,70,0,1)', 'x')).toBe(40);
		expect(offsetOf('matrix3d(1,0,0,0, 0,1,0,0, 0,0,1,0, 40,70,0,1)', 'y')).toBe(70);
	});

	it('is none for a content that is not on its way', () => {
		expect(offsetOf('none', 'x')).toBe(0);
		expect(offsetOf('', 'y')).toBe(0);
	});
});

describe('on the page', () => {
	let now;
	let seen;
	let behavior;
	let frames;

	beforeAll(() => installSlideScroll(document));

	beforeEach(() => {
		now = 1000000;
		mockLevel = 3;
		mockChoice = 'mid';
		behavior = 'auto';
		jest.spyOn(Date, 'now').mockImplementation(() => now);
		// What the style of a node said, and what its inline transform was when the page was asked
		seen = [];
		jest.spyOn(window, 'getComputedStyle').mockImplementation((node) => {
			seen.push({node, transform: node.style.transform});
			return {transform: '', scrollBehavior: behavior};
		});
		// Animation frames run when the test says so
		frames = [];
		jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => { frames.push(callback); return frames.length; });
		jest.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => { frames[id - 1] = null; });
		resetSlideScroll();
		document.body.innerHTML = '';
	});
	afterEach(() => jest.restoreAllMocks());

	const nextFrame = () => {
		const due = frames;
		frames = [];
		due.forEach((callback) => callback && callback());
	};

	const row = (axis, content) => {
		const container = document.createElement('div');
		container.setAttribute('data-slide-scroll', axis);
		if (content) container.setAttribute('data-slide-content', content);
		const first = document.createElement('div');
		const second = document.createElement('div');
		container.appendChild(first);
		container.appendChild(second);
		document.body.appendChild(container);
		return {container, first, second};
	};
	const arrow = (keyCode) => document.dispatchEvent(Object.assign(new window.Event('keydown', {bubbles: true}), {keyCode}));
	const scrolled = (container, key, value) => {
		container[key] = value;
		container.dispatchEvent(new Event('scroll'));
	};
	const startsOf = (node) => seen.filter((entry) => entry.node === node && entry.transform).map((entry) => entry.transform);

	it('puts a row where it was, has the page take that in, and lets it go with a transition', () => {
		const {container, first, second} = row('x');
		now += 1000;
		arrow(39);
		now += 20;
		scrolled(container, 'scrollLeft', 200);

		// The page was asked about the start while it was set, which is what lets the transition begin from it
		expect(startsOf(first)).toEqual(['translate3d(200px, 0, 0)']);
		expect(first.style.transform).toBe('');
		expect(first.style.transition).toBe(`transform ${slideMsFor('x', 200)}ms cubic-bezier(0.2, 0.7, 0.2, 1)`);
		// Only the first child, since the container did not ask for them all
		expect(second.style.transition).toBe('');
	});

	it('holds a list where it was until its scrolling is over, then slides every child of it', () => {
		const {container, first, second} = row('y', 'children');
		now += 1000;
		arrow(40);
		now += 20;
		scrolled(container, 'scrollTop', 150);
		// Shown where it was, and not let go yet
		expect(first.style.transform).toBe('translate3d(0, 150px, 0)');
		expect(second.style.transform).toBe('translate3d(0, 150px, 0)');
		expect(first.style.transition).toBe('none');
		nextFrame();
		expect(first.style.transition).toBe('none');
		nextFrame();
		expect(startsOf(first)).toContain('translate3d(0, 150px, 0)');
		expect(first.style.transform).toBe('');
		expect(first.style.transition).toContain(`${slideMsFor('y', 150)}ms`);
		expect(second.style.transition).toContain(`${slideMsFor('y', 150)}ms`);
	});

	it('draws one slide for a list that is scrolled twice in a row, from where it was to where it ends', () => {
		const {container, first} = row('y', 'children');
		now += 1000;
		arrow(40);
		now += 20;
		// The focus lands too far, and the row is put back on the frame behind it
		scrolled(container, 'scrollTop', 300);
		nextFrame();
		scrolled(container, 'scrollTop', 200);
		expect(first.style.transform).toBe('translate3d(0, 200px, 0)');
		nextFrame();
		expect(first.style.transition).toBe('none');
		nextFrame();
		expect(first.style.transform).toBe('');
		expect(first.style.transition).toContain(`${slideMsFor('y', 200)}ms`);
	});

	it('takes a few pixels of correction into the slide that waits, and does not cancel it', () => {
		const {container, first} = row('y', 'children');
		now += 1000;
		arrow(40);
		now += 20;
		scrolled(container, 'scrollTop', 300);
		nextFrame();
		// The row is put back at its resting place, a few pixels off, which is under what a move of its own needs
		scrolled(container, 'scrollTop', 297);
		expect(first.style.transform).toBe('translate3d(0, 297px, 0)');
		nextFrame();
		nextFrame();
		expect(first.style.transform).toBe('');
		expect(first.style.transition).toContain(`${slideMsFor('y', 297)}ms`);
	});

	it('does not take the scrolls of a held key into a slide that waits, which jump as they always did', () => {
		const {container, first} = row('y', 'children');
		now += 1000;
		arrow(40);
		now += 20;
		scrolled(container, 'scrollTop', 300);
		expect(first.style.transform).toBe('translate3d(0, 300px, 0)');
		// The key repeats before the wait is up
		now += 100;
		arrow(40);
		scrolled(container, 'scrollTop', 320);
		expect(first.style.transform).toBe('');
		expect(first.style.transition).toBe('');
	});

	it('puts a first child that has gone from the list where it stands', () => {
		const {container, first} = row('y');
		now += 1000;
		arrow(40);
		now += 20;
		scrolled(container, 'scrollTop', 300);
		expect(first.style.transform).toBe('translate3d(0, 300px, 0)');
		const before = document.createElement('div');
		container.insertBefore(before, first);
		nextFrame();
		scrolled(container, 'scrollTop', 250);
		expect(first.style.transform).toBe('');
		expect(first.style.transition).toBe('');
		expect(before.style.transform).toBe('translate3d(0, 250px, 0)');
	});

	it('lets go a row that was mounted while the slide waited, with the others', () => {
		const {container, first} = row('y', 'children');
		now += 1000;
		arrow(40);
		now += 20;
		scrolled(container, 'scrollTop', 300);
		const mounted = document.createElement('div');
		container.appendChild(mounted);
		nextFrame();
		scrolled(container, 'scrollTop', 200);
		expect(mounted.style.transform).toBe('translate3d(0, 200px, 0)');
		nextFrame();
		nextFrame();
		expect(first.style.transform).toBe('');
		expect(mounted.style.transform).toBe('');
		expect(mounted.style.transition).toContain('transform');
	});

	it('slides the axis of the key and leaves the other, so a row that scrolls to its card on the way is not drawn twice', () => {
		const sideways = row('x');
		now += 1000;
		arrow(40);
		scrolled(sideways.container, 'scrollLeft', 200);
		expect(sideways.first.style.transition).toBe('');

		const down = row('y', 'children');
		now += 1000;
		arrow(39);
		scrolled(down.container, 'scrollTop', 200);
		expect(down.first.style.transition).toBe('');
	});

	it('leaves a scroll that no key made, and takes a waiting slide to where it stands', () => {
		const {container, first} = row('y', 'children');
		now += 1000;
		scrolled(container, 'scrollTop', 200);
		expect(first.style.transition).toBe('');

		arrow(40);
		scrolled(container, 'scrollTop', 400);
		expect(first.style.transform).toBe('translate3d(0, 200px, 0)');
		// Later, something scrolls it that is not a key, and the content is where it is
		now += 5000;
		scrolled(container, 'scrollTop', 0);
		expect(first.style.transform).toBe('');
		expect(first.style.transition).toBe('');
	});

	it('leaves a held key alone', () => {
		const {container, first} = row('x');
		now += 1000;
		arrow(39);
		now += 100;
		arrow(39);
		now += 20;
		scrolled(container, 'scrollLeft', 200);
		expect(first.style.transition).toBe('');
	});

	it('leaves everything alone at the Low levels when one was picked, and slides on Auto', () => {
		mockLevel = 5;
		mockChoice = 'low';
		const picked = row('x');
		now += 1000;
		arrow(39);
		scrolled(picked.container, 'scrollLeft', 200);
		expect(picked.first.style.transition).toBe('');

		// The level left to Auto reads as the lowest on a Samsung set
		mockChoice = null;
		const auto = row('x');
		now += 1000;
		arrow(39);
		scrolled(auto.container, 'scrollLeft', 200);
		expect(auto.first.style.transition).toContain('transform');
	});

	it('leaves a container that did not ask for it, and one that scrolls smoothly by itself', () => {
		const plain = document.createElement('div');
		const child = document.createElement('div');
		plain.appendChild(child);
		document.body.appendChild(plain);
		now += 1000;
		arrow(39);
		scrolled(plain, 'scrollLeft', 200);
		expect(child.style.transition).toBe('');

		behavior = 'smooth';
		const {container, first} = row('x');
		now += 1000;
		arrow(39);
		scrolled(container, 'scrollLeft', 200);
		expect(first.style.transition).toBe('');
	});

	it('counts the move from where the last one left it', () => {
		const {container, first} = row('x');
		now += 1000;
		arrow(39);
		scrolled(container, 'scrollLeft', 200);
		now += 1000;
		arrow(39);
		scrolled(container, 'scrollLeft', 180);
		// 180 is 20 back from 200
		expect(startsOf(first)).toEqual(['translate3d(200px, 0, 0)', 'translate3d(-20px, 0, 0)']);
	});
});

describe('measuring a node that a slide is moving', () => {
	const slideOf = (matrix) => {
		const container = document.createElement('div');
		container.setAttribute('data-slide-scroll', 'y');
		container.setAttribute('data-slide-content', 'children');
		const child = document.createElement('div');
		const inner = document.createElement('div');
		child.appendChild(inner);
		container.appendChild(child);
		document.body.appendChild(container);
		jest.spyOn(window, 'getComputedStyle').mockImplementation((node) => ({transform: node === child ? matrix : 'none'}));
		inner.getBoundingClientRect = () => ({left: 10, right: 110, top: 300, bottom: 400, width: 100, height: 100});
		return {inner};
	};
	afterEach(() => jest.restoreAllMocks());

	it('takes the slide off what it reads, so a row is where it stands and not where it is drawn', () => {
		const {inner} = slideOf('matrix(1, 0, 0, 1, 0, 120)');
		expect(slideShiftOf(inner)).toEqual({x: 0, y: 120});
		expect(layoutRectOf(inner)).toEqual({left: 10, right: 110, top: 180, bottom: 280, width: 100, height: 100});
	});

	it('reads as it is for a node that is not in a slide', () => {
		const lone = document.createElement('div');
		document.body.appendChild(lone);
		lone.getBoundingClientRect = () => ({left: 1, right: 2, top: 3, bottom: 4, width: 1, height: 1});
		expect(slideShiftOf(lone)).toEqual({x: 0, y: 0});
		expect(layoutRectOf(lone).top).toBe(3);
	});
});
