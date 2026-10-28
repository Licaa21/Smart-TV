import {act, render} from '@testing-library/react';

import BackdropLayer from './BackdropLayer';
import {softBackdropUrl} from '../../utils/softBackdrop';

// The CLI ships a second copy of React, so the components' JSX goes through the copy under test.
jest.mock('react/jsx-dev-runtime', () => {
	const React = require('react');
	return {
		Fragment: React.Fragment,
		jsxDEV: (type, {children, ...rest}, key, isStaticChildren) => {
			const config = key === undefined ? rest : {...rest, key};
			if (children === undefined) return React.createElement(type, config);
			return isStaticChildren ? React.createElement(type, config, ...children) : React.createElement(type, config, children);
		}
	};
});
jest.mock('../../utils/perfTier', () => ({getPerfTier: () => 'low'}));
jest.mock('../../utils/softBackdrop', () => ({canSoften: () => true, softBackdropUrl: jest.fn()}));

const OUTSIDE = 'https://image.tmdb.org/t/p/w1280/a.jpg';
const OWN = 'http://server/Items/abc/Images/Backdrop?maxWidth=1280';

describe('BackdropLayer', () => {
	const RealImage = window.Image;
	let images;

	beforeEach(() => {
		jest.useFakeTimers();
		images = [];
		window.Image = function FakeImage () {
			const art = {};
			images.push(art);
			return art;
		};
		softBackdropUrl.mockReset();
	});
	afterEach(() => {
		window.Image = RealImage;
		jest.useRealTimers();
	});

	const layers = () => [...document.querySelectorAll('[class~="globalBackdropImage"]')];
	const drawn = () => layers().find((layer) => layer.style.opacity === '1');
	const settle = async () => {
		await act(async () => {
			jest.advanceTimersByTime(500);
			await Promise.resolve();
			await Promise.resolve();
		});
		await act(async () => {
			images.forEach((art) => art.onload?.());
		});
	};

	it('draws a title from outside the server soft by the screen, even at the Low performance level', async () => {
		softBackdropUrl.mockResolvedValue('blob:soft/1');
		render(<BackdropLayer targetUrl={OUTSIDE} blurAmount={20} />);
		await settle();
		expect(softBackdropUrl).toHaveBeenCalledWith(OUTSIDE, 20);
		const layer = drawn();
		expect(layer.style.backgroundImage).toContain('blob:soft/1');
		expect(layer.style.filter).toBe('none');
	});

	it('falls back to the picture itself, with the filter the performance level allows, when it cannot be made soft', async () => {
		softBackdropUrl.mockResolvedValue(null);
		render(<BackdropLayer targetUrl={OUTSIDE} blurAmount={20} />);
		await settle();
		const layer = drawn();
		expect(layer.style.backgroundImage).toContain(OUTSIDE);
		// Low allows no filter
		expect(layer.style.filter).toBe('none');
	});

	it('leaves a title of the server to the server, and asks for no soft copy', async () => {
		render(<BackdropLayer targetUrl={OWN} blurAmount={20} />);
		await settle();
		expect(softBackdropUrl).not.toHaveBeenCalled();
		expect(drawn().style.backgroundImage).toContain('blur=');
	});

	it('draws the same picture again when the blur is changed', async () => {
		softBackdropUrl.mockResolvedValue('blob:soft/1');
		const {rerender} = render(<BackdropLayer targetUrl={OUTSIDE} blurAmount={20} />);
		await settle();
		expect(softBackdropUrl).toHaveBeenCalledTimes(1);
		rerender(<BackdropLayer targetUrl={OUTSIDE} blurAmount={0} />);
		await settle();
		expect(drawn().style.backgroundImage).toContain(OUTSIDE);
	});

	it('draws nothing soft when the blur is off', async () => {
		render(<BackdropLayer targetUrl={OUTSIDE} blurAmount={0} />);
		await settle();
		expect(softBackdropUrl).not.toHaveBeenCalled();
		expect(drawn().style.backgroundImage).toContain(OUTSIDE);
	});
});

describe('BackdropLayer timing', () => {
	const RealImage = window.Image;
	let images;
	const own = (id) => `http://server/Items/${id}/Images/Backdrop?maxWidth=1280`;
	const layers = () => [...document.querySelectorAll('[class~="globalBackdropImage"]')];
	const drawn = () => layers().find((layer) => layer.style.opacity === '1');
	const advance = (ms) => act(async () => {
		jest.advanceTimersByTime(ms);
		await Promise.resolve();
	});
	const loadAll = () => act(async () => {
		images.forEach((art) => art.onload?.());
	});
	const props = {blurAmount: 20, settleMs: 150, fadeWhileMovingMs: 300};

	beforeEach(() => {
		jest.useFakeTimers();
		images = [];
		window.Image = function FakeImage () {
			const art = {};
			images.push(art);
			return art;
		};
	});
	afterEach(() => {
		window.Image = RealImage;
		jest.useRealTimers();
	});

	// the first picture is on screen
	const showFirst = async (id) => {
		const view = render(<BackdropLayer targetUrl={own(id)} {...props} />);
		await advance(150);
		await loadAll();
		expect(drawn()).toBeTruthy();
		images.length = 0;
		return view;
	};

	it('waits for the settle time it is given and no longer', async () => {
		render(<BackdropLayer targetUrl={own('a')} {...props} />);
		await advance(149);
		expect(images).toHaveLength(0);
		await advance(1);
		expect(images).toHaveLength(1);
	});

	it('keeps the old picture while one step is followed by a rest, even when the new one is slow to load', async () => {
		const {rerender} = await showFirst('a');
		rerender(<BackdropLayer targetUrl={own('b')} {...props} />);
		await advance(150);
		expect(images).toHaveLength(1);
		// the new picture takes its time, longer than the fade-out time
		await advance(600);
		expect(drawn().style.backgroundImage).toContain('/a/');
		await loadAll();
		expect(drawn().style.backgroundImage).toContain('/b/');
	});

	it('fades the old picture out when focus keeps moving without resting, and draws the new one once it rests', async () => {
		const {rerender} = await showFirst('a');
		rerender(<BackdropLayer targetUrl={own('b')} {...props} />);
		await advance(100);
		rerender(<BackdropLayer targetUrl={own('c')} {...props} />);
		await advance(100);
		expect(drawn()).toBeTruthy();
		rerender(<BackdropLayer targetUrl={own('d')} {...props} />);
		await advance(100);
		expect(drawn()).toBeUndefined();
		expect(images).toHaveLength(0);
		await advance(150);
		await loadAll();
		expect(drawn().style.backgroundImage).toContain('/d/');
	});

	it('never fades without a time to fade in, as before', async () => {
		const {rerender} = render(<BackdropLayer targetUrl={own('a')} blurAmount={20} settleMs={150} />);
		await advance(150);
		await loadAll();
		images.length = 0;
		for (const id of ['b', 'c', 'd', 'e', 'f']) {
			rerender(<BackdropLayer targetUrl={own(id)} blurAmount={20} settleMs={150} />);
			await advance(100);
		}
		expect(drawn()).toBeTruthy();
	});

	it('loads nothing for a card focus passed over on its way back to the picture on screen', async () => {
		const {rerender} = await showFirst('a');
		rerender(<BackdropLayer targetUrl={own('b')} {...props} />);
		await advance(100);
		rerender(<BackdropLayer targetUrl={own('a')} {...props} />);
		await advance(400);
		expect(images).toHaveLength(0);
	});

	it('does not fade when focus comes back to the picture on screen', async () => {
		const {rerender} = await showFirst('a');
		rerender(<BackdropLayer targetUrl={own('b')} {...props} />);
		await advance(100);
		rerender(<BackdropLayer targetUrl={own('a')} {...props} />);
		await advance(400);
		expect(drawn().style.backgroundImage).toContain('/a/');
	});
});
