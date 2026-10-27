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
