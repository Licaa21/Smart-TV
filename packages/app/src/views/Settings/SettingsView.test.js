import {fireEvent, render, screen} from '@testing-library/react';

import SettingsView from './SettingsView';

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
jest.mock('./settingsSpottables', () => {
	const React = require('react');
	return {ViewContainer: ({spotlightId, ...props}) => React.createElement('div', props)}; // eslint-disable-line no-unused-vars
});
jest.mock('@enact/spotlight', () => ({__esModule: true, default: {getPointerMode: () => false}}));

const scroller = () => screen.getByText('First').closest('[class*="listContent"]');

describe('SettingsView', () => {
	it('scrolls back to the top when the first row takes focus, so the heading above it can be read', () => {
		render(
			<SettingsView spotlightId="x">
				<h2>Heading</h2>
				<div className="spottable">First</div>
				<div className="spottable">Second</div>
			</SettingsView>
		);
		scroller().scrollTop = 300;
		fireEvent.focus(screen.getByText('First'));
		expect(scroller().scrollTop).toBe(0);
	});

	it('leaves the scroll alone for a row further down', () => {
		render(
			<SettingsView spotlightId="x">
				<h2>Heading</h2>
				<div className="spottable">First</div>
				<div className="spottable">Second</div>
			</SettingsView>
		);
		scroller().scrollTop = 300;
		fireEvent.focus(screen.getByText('Second'));
		expect(scroller().scrollTop).toBe(300);
	});
});
