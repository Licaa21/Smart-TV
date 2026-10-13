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

let mockOnXbox = false;
jest.mock('../../platform', () => ({
	...jest.requireActual('../../platform'),
	isXbox: () => mockOnXbox
}));

const press = (keyCode) => act(() => window.dispatchEvent(new window.KeyboardEvent('keydown', {keyCode, which: keyCode, bubbles: true, cancelable: true})));

const Y = 198;
const RIGHT_BUMPER = 199;
const LEFT_BUMPER = 200;
const LEFT_STICK_PRESS = 209;
const RIGHT_STICK_RIGHT = 217;
const RIGHT_STICK_LEFT = 218;
// The left trigger comes in as rewind
const LEFT_TRIGGER = 227;

const shownKey = (label) => document.querySelector(`[data-key="${label}"]`);

const open = (over = {}) => {
	const session = {value: 'ab', onChange: jest.fn(), onClose: jest.fn(), ...over};
	render(<TVKeyboard />);
	act(() => {
		expect(openTvKeyboard(session)).toBe(true);
	});
	return session;
};

describe('the TV keyboard on a controller', () => {
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

describe('the Xbox keyboard shortcuts', () => {
	beforeEach(() => {
		mockOnXbox = true;
	});

	afterEach(() => {
		mockOnXbox = false;
	});

	test('Y types a space', () => {
		const {onChange} = open();
		press(Y);
		expect(onChange).toHaveBeenLastCalledWith('ab ', 3);
	});

	test('the bumpers move the cursor', () => {
		const {onChange} = open();
		press(LEFT_BUMPER);
		expect(onChange).toHaveBeenLastCalledWith('ab', 1);
		press(RIGHT_BUMPER);
		expect(onChange).toHaveBeenLastCalledWith('ab', 2);
	});

	test('pressing the left stick shifts the letters', () => {
		open();
		expect(shownKey('q')).not.toBeNull();
		press(LEFT_STICK_PRESS);
		expect(shownKey('Q')).not.toBeNull();
		press(LEFT_STICK_PRESS);
		expect(shownKey('q')).not.toBeNull();
	});

	test('the left trigger flips between the letters and the symbols', () => {
		open();
		press(LEFT_TRIGGER);
		expect(shownKey('ABC')).not.toBeNull();
		press(LEFT_TRIGGER);
		expect(shownKey('123')).not.toBeNull();
	});

	test('the right stick walks the suggestions and A takes one', () => {
		const {onChange} = open({purpose: 'url'});
		press(RIGHT_STICK_RIGHT);
		press(RIGHT_STICK_RIGHT);
		press(13);
		expect(onChange).toHaveBeenLastCalledWith('abhttp://', 9);
	});

	test('the right stick to the left starts from the last suggestion', () => {
		const {onChange} = open({purpose: 'email'});
		press(RIGHT_STICK_LEFT);
		press(13);
		expect(onChange).toHaveBeenLastCalledWith('ab.', 3);
	});

	test('a shortcut does nothing on a layout without its key', () => {
		const {onChange} = open({value: '12', purpose: 'numeric'});
		press(Y);
		press(LEFT_TRIGGER);
		press(LEFT_STICK_PRESS);
		expect(onChange).not.toHaveBeenCalled();
		expect(shownKey('ABC')).toBeNull();
		press(LEFT_BUMPER);
		expect(onChange).toHaveBeenLastCalledWith('12', 1);
	});

	test('the shortcuts do nothing on other platforms', () => {
		mockOnXbox = false;
		const {onChange} = open();
		press(LEFT_TRIGGER);
		press(Y);
		expect(onChange).not.toHaveBeenCalled();
		expect(shownKey('123')).not.toBeNull();
	});
});
