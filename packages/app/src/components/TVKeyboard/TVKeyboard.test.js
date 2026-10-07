import {act, render} from '@testing-library/react';

import {defaultSettings} from '../../context/defaultSettings';
import {resolveThemeById} from '../../theme/themeRegistry';
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
	let onChange;
	let onClose;

	beforeEach(() => {
		onChange = jest.fn();
		onClose = jest.fn();
		render(<TVKeyboard />);
		act(() => {
			expect(openTvKeyboard({value: 'ab', onChange, onClose})).toBe(true);
		});
	});

	test('Backspace takes the last character off', () => {
		press(8);
		expect(onChange).toHaveBeenLastCalledWith('a', 1);
	});

	test('the Menu button finishes typing as the done key does', () => {
		press(93);
		expect(onClose).toHaveBeenCalledWith({submitted: true, reason: undefined});
		expect(onChange).not.toHaveBeenCalled();
	});
});
