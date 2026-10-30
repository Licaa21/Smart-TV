import {SLIDE_MS, installSlideScroll, offsetOf, resetSlideScroll, shouldSlide, slidesAtLevel} from './slideScroll';

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
	let frames;

	beforeAll(() => installSlideScroll(document));

	beforeEach(() => {
		now = 1000000;
		mockLevel = 3;
		jest.spyOn(Date, 'now').mockImplementation(() => now);
		frames = [];
		jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => { frames.push(callback); return frames.length; });
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

	it('puts the content where it was, then lets it slide to where it is on the next frame', () => {
		const {container, first, second} = row('x');
		now += 1000;
		arrow(39);
		now += 20;
		scrolled(container, 'scrollLeft', 200);

		expect(first.style.transform).toBe('translate3d(200px, 0, 0)');
		expect(first.style.transition).toBe('none');
		// Only the first child, since the container did not ask for them all
		expect(second.style.transform).toBe('');

		frames.forEach((frame) => frame());
		expect(first.style.transform).toBe('');
		expect(first.style.transition).toBe(`transform ${SLIDE_MS.x}ms cubic-bezier(0.2, 0.7, 0.2, 1)`);
	});

	it('slides every child of a list that asks for it, along its own axis', () => {
		const {container, first, second} = row('y', 'children');
		now += 1000;
		arrow(40);
		now += 20;
		scrolled(container, 'scrollTop', 150);
		expect(first.style.transform).toBe('translate3d(0, 150px, 0)');
		expect(second.style.transform).toBe('translate3d(0, 150px, 0)');
	});

	it('leaves a scroll that no key made', () => {
		const {container, first} = row('x');
		now += 1000;
		scrolled(container, 'scrollLeft', 200);
		expect(first.style.transform).toBe('');
		expect(frames).toHaveLength(0);
	});

	it('leaves a held key alone', () => {
		const {container, first} = row('x');
		now += 1000;
		arrow(39);
		now += 100;
		arrow(39);
		now += 20;
		scrolled(container, 'scrollLeft', 200);
		expect(first.style.transform).toBe('');
	});

	it('leaves everything alone at the Low levels', () => {
		mockLevel = 5;
		const {container, first} = row('x');
		now += 1000;
		arrow(39);
		scrolled(container, 'scrollLeft', 200);
		expect(first.style.transform).toBe('');
	});

	it('leaves a container that did not ask for it', () => {
		const container = document.createElement('div');
		const child = document.createElement('div');
		container.appendChild(child);
		document.body.appendChild(container);
		now += 1000;
		arrow(39);
		scrolled(container, 'scrollLeft', 200);
		expect(child.style.transform).toBe('');
	});

	it('counts the move from where the last one left it', () => {
		const {container, first} = row('x');
		now += 1000;
		arrow(39);
		scrolled(container, 'scrollLeft', 200);
		frames.forEach((frame) => frame());
		now += 1000;
		arrow(39);
		scrolled(container, 'scrollLeft', 180);
		// 180 is 20 back from 200
		expect(first.style.transform).toBe('translate3d(-20px, 0, 0)');
	});
});
