import {act, render} from '@testing-library/react';

import TVKeyboard from './TVKeyboard';
import {openTvKeyboard} from './keyboardBus';

// The CLI ships a second copy of React, so the components' JSX goes through the copy under test.
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

jest.mock('../../context/SettingsContext', () => ({
	useSettings: () => ({settings: require('../../context/defaultSettings').defaultSettings, activeTheme: require('../../theme/themeRegistry').resolveThemeById('moonfin')})
}));

const press = (keyCode) => act(() => window.dispatchEvent(new window.KeyboardEvent('keydown', {keyCode, which: keyCode, bubbles: true, cancelable: true})));

describe('the TV keyboard on a controller', () => {
	const open = () => {
		const session = {value: 'ab', onChange: jest.fn(), onClose: jest.fn()};
		render(<TVKeyboard />);
		act(() => {
			expect(openTvKeyboard(session)).toBe(true);
		});
		return session;
	};

	test('Backspace takes the last character off', () => {
		const {onChange} = open();
		press(8);
		expect(onChange).toHaveBeenLastCalledWith('a', 1);
	});

	test('the Menu button finishes typing as the done key does', () => {
		const {onChange, onClose} = open();
		press(93);
		expect(onClose).toHaveBeenCalledWith({submitted: true, reason: undefined});
		expect(onChange).not.toHaveBeenCalled();
	});
});
