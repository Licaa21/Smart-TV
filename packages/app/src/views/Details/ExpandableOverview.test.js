import {fireEvent, render, screen} from '@testing-library/react';

import ExpandableOverview from './ExpandableOverview';

jest.mock('@enact/i18n/$L', () => ({__esModule: true, default: (str) => str}));
// Spottable adds props a plain div would complain about, so they are taken off here.
jest.mock('@enact/spotlight/Spottable', () => () => {
	const React = require('react');
	return ({spotlightId, spotlightDisabled, ...props}) => React.createElement('div', props); // eslint-disable-line no-unused-vars
});

// The CLI ships a second copy of React, so the component's JSX goes through the copy under test.
jest.mock('react/jsx-dev-runtime', () => {
	const React = require('react');
	return {
		jsxDEV: (type, {children, ...props}, key, isStaticChildren) => {
			const config = key === undefined ? props : {...props, key};
			if (children === undefined) return React.createElement(type, config);
			return isStaticChildren ? React.createElement(type, config, ...children) : React.createElement(type, config, children);
		}
	};
});

// jsdom does no layout, so the box and its text are given the heights a browser would report.
const heights = (scroll, client) => {
	jest.spyOn(window.Element.prototype, 'scrollHeight', 'get').mockReturnValue(scroll);
	jest.spyOn(window.Element.prototype, 'clientHeight', 'get').mockReturnValue(client);
};

afterEach(() => jest.restoreAllMocks());

describe('ExpandableOverview', () => {
	it('offers Read More when the text runs past its clamp', () => {
		heights(180, 112);
		render(<ExpandableOverview text="A long description." itemId="a" />);
		expect(screen.getByText('Read More')).toBeTruthy();
	});

	it('toggles to Read Less when pressed', () => {
		heights(180, 112);
		const {container} = render(<ExpandableOverview text="A long description." itemId="a" />);
		fireEvent.click(container.firstChild);
		expect(screen.getByText('Read Less')).toBeTruthy();
	});

	it('shows no Read More for text that fits', () => {
		heights(112, 112);
		render(<ExpandableOverview text="Short." itemId="a" />);
		expect(screen.queryByText('Read More')).toBeNull();
	});

	it('shows no Read More when rounding makes the text a pixel or two taller than its box', () => {
		heights(114, 112);
		render(<ExpandableOverview text="Fits on three lines." itemId="a" />);
		expect(screen.queryByText('Read More')).toBeNull();
	});

	describe('judged against the clamp when the browser reports it', () => {
		// 28px lines clamped to four, the classic header.
		const clamp = (scroll, client) => {
			heights(scroll, client);
			jest.spyOn(window, 'getComputedStyle').mockReturnValue({lineHeight: '28px', webkitLineClamp: '4'});
		};

		it('shows no Read More for a short description in a box squeezed below its clamp', () => {
			clamp(56, 20);
			render(<ExpandableOverview text="Two short lines." itemId="a" />);
			expect(screen.queryByText('Read More')).toBeNull();
		});

		it('shows no Read More for text that exactly fills the clamp', () => {
			clamp(113, 112);
			render(<ExpandableOverview text="Four full lines." itemId="a" />);
			expect(screen.queryByText('Read More')).toBeNull();
		});

		it('shows Read More once there is a fifth line', () => {
			clamp(140, 112);
			render(<ExpandableOverview text="Five lines of text." itemId="a" />);
			expect(screen.getByText('Read More')).toBeTruthy();
		});
	});
});
