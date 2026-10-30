import {SLIDE_MS, installSlideScroll, slideMsFor, layoutRectOf, offsetOf, resetSlideScroll, shouldSlide, slideShiftOf, slidesAtLevel} from './slideScroll';

let mockLevel = 3;
jest.mock('./perfTier', () => ({getPerfLevelIndex: () => mockLevel}));

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

	it('is off from Medium-low down, where there is nothing to spare', () => {
		expect(slidesAtLevel(3)).toBe(true);
		expect(slidesAtLevel(4)).toBe(false);
		expect(slidesAtLevel(5)).toBe(false);
		expect(shouldSlide({...press, levelIndex: 4})).toBe(false);
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

	beforeAll(() => installSlideScroll(document));

	beforeEach(() => {
		now = 1000000;
		mockLevel = 3;
		behavior = 'auto';
		jest.spyOn(Date, 'now').mockImplementation(() => now);
		// What the style of a node said, and what its inline transform was when the page was asked
		seen = [];
		jest.spyOn(window, 'getComputedStyle').mockImplementation((node) => {
			seen.push({node, transform: node.style.transform});
			return {transform: '', scrollBehavior: behavior};
		});
		resetSlideScroll();
		document.body.innerHTML = '';
	});
	afterEach(() => jest.restoreAllMocks());

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

	it('puts the content where it was, has the page take that in, and lets it go with a transition', () => {
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

	it('slides every child of a list that asks for it, along its own axis', () => {
		const {container, first, second} = row('y', 'children');
		now += 1000;
		arrow(40);
		now += 20;
		scrolled(container, 'scrollTop', 150);
		expect(startsOf(first)).toEqual(['translate3d(0, 150px, 0)']);
		expect(first.style.transition).toContain(`${slideMsFor('y', 150)}ms`);
		expect(second.style.transition).toContain(`${slideMsFor('y', 150)}ms`);
	});

	it('leaves a scroll that no key made', () => {
		const {container, first} = row('x');
		now += 1000;
		scrolled(container, 'scrollLeft', 200);
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

	it('leaves everything alone at the Low levels', () => {
		mockLevel = 5;
		const {container, first} = row('x');
		now += 1000;
		arrow(39);
		scrolled(container, 'scrollLeft', 200);
		expect(first.style.transition).toBe('');
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
