import {act, fireEvent, render} from '@testing-library/react';

import SeasonalTheme, {RESUME_AFTER_MS} from './SeasonalTheme';
import {BURST_COUNTS, COUNT_SHARE, FALL_COUNTS, FLYER_COUNTS, SPARKS_PER_BURST} from './seasonalParticles';

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

let mockTier = 'high';
jest.mock('../../utils/perfTier', () => ({getPerfTier: () => mockTier}));

const count = (selector) => document.querySelectorAll(selector).length;

beforeEach(() => {
	mockTier = 'high';
});

describe('SeasonalTheme', () => {
	test('draws nothing for none, a missing value or one it does not know', () => {
		for (const theme of ['none', undefined, 'aurora', 'harvest']) {
			const {container, unmount} = render(<SeasonalTheme theme={theme} density="normal" />);
			expect(container.firstChild).toBeNull();
			unmount();
		}
	});

	test('draws the falling effects at each density, one element per particle', () => {
		for (const theme of ['snow', 'leaves', 'confetti']) {
			for (const density of ['light', 'normal', 'heavy']) {
				const {unmount} = render(<SeasonalTheme theme={theme} density={density} />);
				expect(count('.overlay')).toBe(1);
				expect(count('.particle')).toBe(FALL_COUNTS.high[density]);
				expect(count('.overlay > *')).toBe(FALL_COUNTS.high[density]);
				unmount();
			}
		}
	});

	test('draws the newer effects with their own shapes', () => {
		for (const [theme, shape] of [['christmas', '.bauble'], ['petals', '.petal, .blossom'], ['fireflies', '.firefly'], ['halloween', '.candy, .leaf, .leafMirror']]) {
			const {unmount} = render(<SeasonalTheme theme={theme} density="heavy" />);
			const share = COUNT_SHARE[theme] || 1;
			expect(count('.particle')).toBe(Math.round(FALL_COUNTS.high.heavy * share));
			expect(count(shape)).toBeGreaterThan(0);
			unmount();
		}
	});

	test('draws each flyer as a flight with its sprite inside', () => {
		const {unmount} = render(<SeasonalTheme theme="halloween" density="heavy" />);
		expect(count('.flyer')).toBe(FLYER_COUNTS.halloween.heavy);
		expect(count('.flyer > .bat') + count('.flyer > .ghost')).toBe(FLYER_COUNTS.halloween.heavy);
		expect(count('.flyer > .ghost')).toBeGreaterThan(0);
		unmount();

		render(<SeasonalTheme theme="petals" density="heavy" />);
		expect(count('.flyer > .beeLeft') + count('.flyer > .beeRight')).toBe(FLYER_COUNTS.petals.heavy);
	});

	test('draws as many on the low tier as the density setting says', () => {
		mockTier = 'low';
		render(<SeasonalTheme theme="snow" density="heavy" />);
		expect(count('.particle')).toBe(FALL_COUNTS.high.heavy);
	});

	test('draws fireworks as bursts with every spark inside one ring', () => {
		render(<SeasonalTheme theme="fireworks" density="heavy" />);
		expect(count('.mover')).toBe(BURST_COUNTS.heavy);
		expect(count('.rocket')).toBe(BURST_COUNTS.heavy);
		expect(count('.ring')).toBe(BURST_COUNTS.heavy);
		expect(count('.ring > .spark')).toBe(BURST_COUNTS.heavy * SPARKS_PER_BURST);
		expect(count('.particle')).toBe(0);
	});

	describe('while the remote is in use', () => {
		beforeEach(() => jest.useFakeTimers());
		afterEach(() => jest.useRealTimers());

		test('holds the particles still on the low tier, then lets them carry on', () => {
			mockTier = 'low';
			render(<SeasonalTheme theme="snow" density="normal" />);
			expect(count('.overlay.paused')).toBe(0);

			fireEvent.keyDown(window, {keyCode: 39});
			expect(count('.overlay.paused')).toBe(1);

			act(() => { jest.advanceTimersByTime(RESUME_AFTER_MS - 100); });
			fireEvent.keyDown(window, {keyCode: 39});
			act(() => { jest.advanceTimersByTime(RESUME_AFTER_MS - 100); });
			expect(count('.overlay.paused')).toBe(1);

			act(() => { jest.advanceTimersByTime(200); });
			expect(count('.overlay.paused')).toBe(0);
		});

		test('leaves the particles running on the high tier', () => {
			render(<SeasonalTheme theme="snow" density="normal" />);
			fireEvent.keyDown(window, {keyCode: 39});
			expect(count('.overlay.paused')).toBe(0);
		});

		test('stops listening once it is gone', () => {
			mockTier = 'low';
			const spy = jest.spyOn(window, 'removeEventListener');
			const {unmount} = render(<SeasonalTheme theme="leaves" density="light" />);
			unmount();
			expect(spy.mock.calls.filter(([name]) => name === 'keydown')).toHaveLength(1);
			spy.mockRestore();
		});
	});

	test("draws this app's old winter as snow", () => {
		render(<SeasonalTheme theme="winter" />);
		expect(count('.particle')).toBe(FALL_COUNTS.high.normal);
		expect(count('.dot') + count('.flake')).toBe(FALL_COUNTS.high.normal);
	});
});
