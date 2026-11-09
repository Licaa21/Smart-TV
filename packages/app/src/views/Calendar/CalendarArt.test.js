import {fireEvent, render} from '@testing-library/react';

import {CalendarArt} from './calendarParts';

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

jest.mock('@enact/spotlight', () => ({__esModule: true, default: {}}));
jest.mock('@enact/spotlight/Spottable', () => (type) => type);
jest.mock('../../context/SettingsContext', () => ({useSettings: () => ({settings: {}})}));
jest.mock('../../context/SeerrContext', () => ({useSeerr: () => ({})}));
jest.mock('../../services/seerrApi', () => ({__esModule: true, default: {getImageUrl: (url) => url}}));

const imageOf = (container) => container.querySelector('img');

describe('CalendarArt', () => {
	test('shows the first picture of a list', () => {
		const {container} = render(<CalendarArt url={['http://server/a.jpg', 'http://sonarr/b.jpg']} icon="tv_rounded" />);
		expect(imageOf(container).getAttribute('src')).toBe('http://server/a.jpg');
	});

	test('moves to the next picture when one fails, and to the icon when none is left', () => {
		const {container} = render(<CalendarArt url={['http://server/a.jpg', 'http://sonarr/b.jpg']} icon="tv_rounded" />);
		fireEvent.error(imageOf(container));
		expect(imageOf(container).getAttribute('src')).toBe('http://sonarr/b.jpg');
		fireEvent.error(imageOf(container));
		expect(imageOf(container)).toBeNull();
	});

	test('starts again from the first picture when the list changes', () => {
		const {container, rerender} = render(<CalendarArt url={['http://server/a.jpg', 'http://sonarr/b.jpg']} icon="tv_rounded" />);
		fireEvent.error(imageOf(container));
		rerender(<CalendarArt url={['http://server/c.jpg']} icon="tv_rounded" />);
		expect(imageOf(container).getAttribute('src')).toBe('http://server/c.jpg');
	});

	test('does not resume where a list failed once it comes back after another', () => {
		const a = ['http://server/a.jpg', 'http://sonarr/a.jpg'];
		const {container, rerender} = render(<CalendarArt url={a} icon="tv_rounded" />);
		fireEvent.error(imageOf(container));
		rerender(<CalendarArt url={['http://server/b.jpg']} icon="tv_rounded" />);
		rerender(<CalendarArt url={a} icon="tv_rounded" />);
		expect(imageOf(container).getAttribute('src')).toBe('http://server/a.jpg');
	});

	test('asks the server for a smaller picture in a thumbnail, and leaves a big one alone', () => {
		const url = 'http://server/Items/x/Images/Backdrop?maxWidth=1280';
		const {container, rerender} = render(<CalendarArt url={url} icon="tv_rounded" thumb />);
		expect(imageOf(container).getAttribute('src')).toBe('http://server/Items/x/Images/Backdrop?maxWidth=480');
		rerender(<CalendarArt url={url} icon="tv_rounded" />);
		expect(imageOf(container).getAttribute('src')).toBe(url);
	});

	test('still takes a single address', () => {
		const {container} = render(<CalendarArt url="http://server/a.jpg" icon="tv_rounded" />);
		expect(imageOf(container).getAttribute('src')).toBe('http://server/a.jpg');
	});

	test('shows the icon for no picture', () => {
		const {container} = render(<CalendarArt url={[]} icon="tv_rounded" />);
		expect(imageOf(container)).toBeNull();
	});
});
