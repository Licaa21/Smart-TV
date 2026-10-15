import {promptBottomFor} from './SkipSegmentOverlay';

jest.mock('@enact/i18n/$L', () => ({__esModule: true, default: (str) => str}));
// The CLI ships a second copy of React, so the components' JSX goes through the copy under test.
// Children written side by side arrive as an array, and are spread so React doesn't ask for keys.
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

// Spottable needs the framework's own React, so a plain button stands in for it.
jest.mock('./PlayerConstants', () => ({SpottableButton: 'button'}));
jest.mock('@enact/spotlight', () => ({__esModule: true, default: {focus: jest.fn(), getCurrent: jest.fn()}}));

describe('promptBottomFor', () => {
	test('lifts the prompt above the controls and leaves it alone when it already clears them', () => {
		// Controls whose top edge is 240px up from a 1080px screen, so the prompt rests 24px above that.
		expect(promptBottomFor(174, 840, 1080)).toBe(264);
		expect(promptBottomFor(174, 1000, 1080)).toBeNull();
	});

	test('does nothing without the controls to measure', () => {
		expect(promptBottomFor(null, 840, 1080)).toBeNull();
		expect(promptBottomFor(174, null, 1080)).toBeNull();
	});
});
