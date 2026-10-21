import {render, screen} from '@testing-library/react';
import Spotlight from '@enact/spotlight';

import UpdateNotification from './UpdateNotification';

// The CLI ships a second copy of React, so the components' JSX goes through the copy under test.
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
jest.mock('@enact/spotlight', () => ({focus: jest.fn(), getCurrent: jest.fn(() => null)}));

jest.mock('@enact/sandstone/Popup', () => ({children}) => require('react').createElement('div', null, children));
jest.mock('@enact/sandstone/Button', () => ({children, onClick}) => require('react').createElement('button', {onClick}, children));
jest.mock('@enact/sandstone/Heading', () => ({children}) => require('react').createElement('h2', null, children));
jest.mock('@enact/sandstone/Scroller', () => ({children}) => require('react').createElement('div', null, children));

const info = {latestVersion: '1.2.0', currentVersion: '1.1.4'};

describe('UpdateNotification', () => {
	beforeEach(() => Spotlight.focus.mockClear());

	test('takes focus back when something behind it takes it later, as Home\'s media bar does', () => {
		render(<div><button>behind</button><UpdateNotification updateInfo={info} formattedNotes="notes" onDismiss={() => {}} /></div>);
		screen.getByText('behind').focus();
		expect(Spotlight.focus).toHaveBeenCalledWith('update-ok-btn');
	});

	test('leaves focus alone while it is inside the panel', () => {
		render(<UpdateNotification updateInfo={info} formattedNotes="notes" onDismiss={() => {}} />);
		Spotlight.focus.mockClear();
		screen.getByText('OK').focus();
		expect(Spotlight.focus).not.toHaveBeenCalled();
	});
});
