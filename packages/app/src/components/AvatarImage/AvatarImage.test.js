import {render, waitFor} from '@testing-library/react';

import AvatarImage from './AvatarImage';

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

const imageOf = (container) => container.querySelector('img');

describe('AvatarImage', () => {
	afterEach(() => {
		delete global.CSS;
		delete global.fetch;
	});

	test('shows a picture as it is where the browser turns pictures itself', () => {
		global.CSS = {supports: (property, value) => property === 'image-orientation' && value === 'from-image'};
		global.fetch = jest.fn();
		const {container} = render(<AvatarImage src="http://server/UserImage?userId=a" alt="" className="avatar" />);
		expect(imageOf(container).getAttribute('src')).toBe('http://server/UserImage?userId=a');
		expect(global.fetch).not.toHaveBeenCalled();
	});

	test('keeps its place and shows nothing while the picture is being made, then the original if that fails', async () => {
		global.CSS = {supports: () => false};
		global.fetch = jest.fn(() => Promise.reject(new Error('offline')));
		const url = 'http://server/UserImage?userId=b';
		const {container} = render(<AvatarImage src={url} alt="" className="avatar" />);
		expect(imageOf(container).getAttribute('src')).toBeNull();
		expect(imageOf(container).style.visibility).toBe('hidden');
		await waitFor(() => expect(imageOf(container).getAttribute('src')).toBe(url));
		expect(imageOf(container).style.visibility).toBe('');
	});

	test('shows the original too when the server answers with an error', async () => {
		global.CSS = {supports: () => false};
		global.fetch = jest.fn(() => Promise.resolve({ok: false, status: 404}));
		const url = 'http://server/UserImage?userId=c';
		const {container} = render(<AvatarImage src={url} alt="" />);
		await waitFor(() => expect(imageOf(container).getAttribute('src')).toBe(url));
	});
});
