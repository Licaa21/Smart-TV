import {edgeSpeed, scrollAtPointerEdges} from './pointerEdgeScroll';

// Frames run by hand, so a test decides how much time has passed.
let queued = [];
let clock = 0;
const runFor = (ms) => {
	const end = clock + ms;
	while (clock < end && queued.length) {
		clock += 16;
		const due = queued;
		queued = [];
		due.forEach((cb) => cb(clock));
	}
};

// jsdom lays nothing out, so each box is given the sizes a real one would have.
const box = ({width, height, scrollWidth = width, scrollHeight = height, style = {}, attrs = {}}) => {
	const el = document.createElement('div');
	Object.assign(el.style, style);
	Object.keys(attrs).forEach((name) => el.setAttribute(name, attrs[name]));
	Object.defineProperty(el, 'clientWidth', {value: width});
	Object.defineProperty(el, 'clientHeight', {value: height});
	Object.defineProperty(el, 'scrollWidth', {value: scrollWidth});
	Object.defineProperty(el, 'scrollHeight', {value: scrollHeight});
	Object.defineProperty(el, 'scrollLeft', {value: 0, writable: true});
	Object.defineProperty(el, 'scrollTop', {value: 0, writable: true});
	el.getBoundingClientRect = () => ({left: 0, right: width, top: 0, bottom: height, width, height});
	document.body.appendChild(el);
	return el;
};

const pointAt = (el, clientX, clientY) => {
	document.elementFromPoint = () => el;
	el.dispatchEvent(new window.MouseEvent('mousemove', {clientX, clientY, bubbles: true}));
};

beforeAll(() => {
	// The edges are clamped to the screen, so the test screen is a TV's.
	Object.defineProperty(window, 'innerWidth', {value: 1920, configurable: true});
	Object.defineProperty(window, 'innerHeight', {value: 1080, configurable: true});
	window.requestAnimationFrame = (cb) => {
		queued.push(cb);
		return queued.length;
	};
	window.cancelAnimationFrame = () => {};
	// jsdom never scrolls on focus, so this stands in for a browser bringing the element into view.
	window.HTMLElement.prototype.focus = function () {
		if (this.parentElement) this.parentElement.scrollTop += 200;
	};
	scrollAtPointerEdges();
});

afterEach(() => {
	document.body.dispatchEvent(new window.KeyboardEvent('keydown', {bubbles: true}));
	queued = [];
	document.body.innerHTML = '';
});

test('moves faster the nearer the edge, and not at all away from it', () => {
	expect(edgeSpeed(960, 0, 1920)).toBe(0);
	expect(edgeSpeed(1900, 0, 1920)).toBeGreaterThan(edgeSpeed(1830, 0, 1920));
	expect(edgeSpeed(1920, 0, 1920)).toBe(1400);
	expect(edgeSpeed(0, 0, 1920)).toBe(-1400);
	// A narrow box keeps a band a quarter of its size, so its middle still holds still.
	expect(edgeSpeed(100, 0, 200)).toBe(0);
});

test('a row slides once the pointer has rested by its edge, and stops at a key press', () => {
	const row = box({width: 1000, height: 300, scrollWidth: 3000, style: {overflowX: 'auto'}});
	const card = document.createElement('div');
	row.appendChild(card);
	pointAt(card, 990, 150);
	runFor(200);
	expect(row.scrollLeft).toBe(0);
	runFor(300);
	const moved = row.scrollLeft;
	expect(moved).toBeGreaterThan(0);
	document.body.dispatchEvent(new window.KeyboardEvent('keydown', {bubbles: true}));
	runFor(300);
	expect(row.scrollLeft).toBe(moved);
});

test('the middle of a page leaves it still and its bottom edge scrolls it', () => {
	const page = box({width: 1920, height: 1080, scrollHeight: 5000, style: {overflowY: 'auto'}});
	pointAt(page, 960, 540);
	runFor(600);
	expect(page.scrollTop).toBe(0);
	pointAt(page, 960, 1075);
	runFor(600);
	expect(page.scrollTop).toBeGreaterThan(0);
});

test('a grid that moves in steps is sent a wheel event per step', () => {
	const grid = box({width: 1600, height: 800, attrs: {'data-pointer-steps': 'true'}});
	const steps = [];
	grid.addEventListener('wheel', (ev) => steps.push(ev.deltaY));
	pointAt(grid, 800, 795);
	runFor(250 + 1000);
	expect(steps.length).toBeGreaterThanOrEqual(3);
	expect(steps.every((delta) => delta > 0)).toBe(true);
});

test('a status bar under the pointer at the bottom of the screen hands the edge to the page above it', () => {
	const page = box({width: 1920, height: 1000, scrollHeight: 5000, style: {overflowY: 'auto'}});
	const status = document.createElement('div');
	document.body.appendChild(status);
	document.elementFromPoint = (px, py) => (py > 1000 ? status : page);
	status.dispatchEvent(new window.MouseEvent('mousemove', {clientX: 960, clientY: 1070, bubbles: true}));
	runFor(600);
	expect(page.scrollTop).toBeGreaterThan(0);
});

test('a pointer pushed past the end of a row slides it, but not from anything that takes focus', () => {
	const row = box({width: 1800, height: 300, scrollWidth: 4000, style: {overflowX: 'auto'}});
	const margin = document.createElement('div');
	document.body.appendChild(margin);
	document.elementFromPoint = (px) => (px > 1800 ? margin : row);
	margin.dispatchEvent(new window.MouseEvent('mousemove', {clientX: 1910, clientY: 150, bubbles: true}));
	runFor(600);
	const moved = row.scrollLeft;
	expect(moved).toBeGreaterThan(0);
	document.body.dispatchEvent(new window.KeyboardEvent('keydown', {bubbles: true}));
	margin.className = 'spottable';
	margin.dispatchEvent(new window.MouseEvent('mousemove', {clientX: 1910, clientY: 150, bubbles: true}));
	runFor(600);
	expect(row.scrollLeft).toBe(moved);
});

test('the top of the screen over a header scrolls the list below it back up', () => {
	const list = box({width: 1920, height: 700, scrollHeight: 5000, style: {overflowY: 'auto'}});
	list.scrollTop = 2000;
	list.getBoundingClientRect = () => ({left: 0, right: 1920, top: 380, bottom: 1080, width: 1920, height: 700});
	const header = document.createElement('div');
	document.body.appendChild(header);
	document.elementFromPoint = (px, py) => (py < 380 ? header : list);
	header.dispatchEvent(new window.MouseEvent('mousemove', {clientX: 960, clientY: 10, bubbles: true}));
	runFor(600);
	expect(list.scrollTop).toBeLessThan(2000);
});

test('a list of rows steps a row at a time and stops with its last row on screen', () => {
	const list = box({width: 1920, height: 600, scrollHeight: 3000, style: {overflowY: 'auto'}, attrs: {'data-pointer-rows': 'true'}});
	[0, 400, 800, 1200, 1600].forEach((offset) => {
		const row = document.createElement('div');
		row.getBoundingClientRect = () => ({top: offset - list.scrollTop, bottom: offset + 400 - list.scrollTop, height: 400});
		list.appendChild(row);
	});
	const seen = [];
	pointAt(list, 960, 595);
	for (let i = 0; i < 12; i++) {
		runFor(200);
		if (seen[seen.length - 1] !== list.scrollTop) seen.push(list.scrollTop);
	}
	expect(seen).toEqual([0, 400, 800, 1200, 1400]);
});

test('focus from a hover leaves the page where it was, and focus from a key still scrolls', async () => {
	const page = box({width: 1920, height: 1080, scrollHeight: 5000, style: {overflowY: 'auto'}});
	const card = document.createElement('div');
	page.appendChild(card);
	card.dispatchEvent(new window.MouseEvent('mouseover', {bubbles: true}));
	card.focus();
	expect(page.scrollTop).toBe(0);
	await new Promise((resolve) => setTimeout(resolve, 0));
	card.focus();
	expect(page.scrollTop).toBe(200);
});
