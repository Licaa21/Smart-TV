import {backdropUrlFor} from './ScreenBackdrop';

// The CLI ships a second copy of React, so the component's JSX goes through the copy under test.
jest.mock('react/jsx-dev-runtime', () => {
	const React = require('react');
	return {
		Fragment: React.Fragment,
		jsxDEV: (type, {children, ...props}, key, isStaticChildren) => {
			const config = key === undefined ? props : {...props, key};
			if (children === undefined) return React.createElement(type, config);
			return isStaticChildren ? React.createElement(type, config, ...children) : React.createElement(type, config, children);
		}
	};
});
jest.mock('../BackdropLayer', () => () => null);
jest.mock('../../context/SettingsContext', () => ({useSettings: () => ({settings: {}})}));

describe('backdropUrlFor', () => {
	const title = {_seerrType: 'item', _externalBackdropUrl: 'https://image.tmdb.org/t/p/w1280/b1.jpg'};

	it('draws the picture of a title', () => {
		expect(backdropUrlFor(title)).toBe('https://image.tmdb.org/t/p/w1280/b1.jpg');
	});

	it('draws nothing behind a studio, network, genre or shortcut tile', () => {
		['shortcut', 'genre', 'studio', 'network'].forEach((type) => {
			expect(backdropUrlFor({...title, _seerrType: type})).toBe('');
		});
	});

	it('draws nothing when there is no card in focus', () => {
		expect(backdropUrlFor(null)).toBe('');
	});
});
