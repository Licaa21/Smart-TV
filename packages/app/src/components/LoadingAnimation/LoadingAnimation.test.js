import {render, screen} from '@testing-library/react';

import {defaultSettings} from '../../context/defaultSettings';
import LoadingOverlay from './LoadingOverlay';
import PlacedLoadingOverlay from './PlacedLoadingOverlay';
import {POSITION_LAYOUT, SIZE_LAYOUT, SPEED_MULTIPLIER, facesLeft} from './loadingAnimationLayout';

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

let mockSettings;
jest.mock('../../context/SettingsContext', () => ({useSettings: () => ({settings: mockSettings})}));

// jsdom has no canvas to draw on, and the animations only ever check for one.
beforeAll(() => {
	jest.spyOn(window.HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

// The animations are drawn shapes with no text or role to find them by.
const count = (selector) => document.querySelectorAll(selector).length;
const find = (selector) => document.querySelector(selector);

beforeEach(() => {
	mockSettings = {
		loadingAnimationImage: 'moonfinLogo',
		loadingAnimationSize: 'medium',
		loadingAnimationPosition: 'middle',
		loadingAnimationSpeed: 'fast',
		showLoadingAnimationText: true
	};
});

describe('loading animation layout', () => {
	test('sizes the animation and its label for each size', () => {
		expect(SIZE_LAYOUT.thumbnail).toEqual({pixelSize: 36, labelSpacing: 8, labelFontSize: 10, labelLetterSpacing: 1.5});
		expect(SIZE_LAYOUT.small).toEqual({pixelSize: 64, labelSpacing: 14, labelFontSize: 12, labelLetterSpacing: 2.5});
		expect(SIZE_LAYOUT.medium).toEqual({pixelSize: 110, labelSpacing: 24, labelFontSize: 14, labelLetterSpacing: 3.5});
		expect(SIZE_LAYOUT.large).toEqual({pixelSize: 170, labelSpacing: 40, labelFontSize: 16, labelLetterSpacing: 4});
	});

	test('runs each speed at its multiple of full speed', () => {
		expect(SPEED_MULTIPLIER).toEqual({slow: 0.45, moderate: 0.70, fast: 1.0, ultra: 1.60});
	});

	test('anchors each position against its edges, with bouncing starting from the middle', () => {
		const anchors = Object.keys(POSITION_LAYOUT).map((key) => [key, POSITION_LAYOUT[key].x, POSITION_LAYOUT[key].y]);

		expect(anchors).toEqual([
			['topLeft', -1, -1], ['topCenter', 0, -1], ['topRight', 1, -1],
			['middleLeft', -1, 0], ['middle', 0, 0], ['middleRight', 1, 0],
			['bottomLeft', -1, 1], ['bottomCenter', 0, 1], ['bottomRight', 1, 1],
			['bouncing', 0, 0]
		]);
	});

	test('turns the runner toward the middle only on the right hand side', () => {
		expect(Object.keys(POSITION_LAYOUT).filter(facesLeft)).toEqual(['topRight', 'middleRight', 'bottomRight']);
	});

	test('starts as the spinning logo, medium, in the middle, at full speed, with its text', () => {
		expect(defaultSettings.loadingAnimationImage).toBe('moonfinLogo');
		expect(defaultSettings.loadingAnimationSize).toBe('medium');
		expect(defaultSettings.loadingAnimationPosition).toBe('middle');
		expect(defaultSettings.loadingAnimationSpeed).toBe('fast');
		expect(defaultSettings.showLoadingAnimationText).toBe(true);
	});
});

describe('loading overlay', () => {
	test('draws the image that was picked', () => {
		const drawn = (image) => {
			mockSettings.loadingAnimationImage = image;
			const {unmount} = render(<LoadingOverlay />);
			const found = {
				logo: count('.logoSpin svg'),
				spinner: count('.spinner canvas'),
				moon: count('.moon canvas'),
				canvases: count('canvas')
			};
			unmount();
			return found;
		};

		expect(drawn('moonfinLogo')).toEqual({logo: 1, spinner: 0, moon: 0, canvases: 0});
		expect(drawn('spinner')).toEqual({logo: 0, spinner: 1, moon: 0, canvases: 1});
		expect(drawn('runner')).toEqual({logo: 0, spinner: 0, moon: 0, canvases: 1});
		expect(drawn('moonPhases')).toEqual({logo: 0, spinner: 0, moon: 2, canvases: 2});
		expect(drawn('moonfinPhases')).toEqual({logo: 0, spinner: 0, moon: 2, canvases: 2});
		expect(drawn('neonfinPhases')).toEqual({logo: 0, spinner: 0, moon: 2, canvases: 2});
	});

	test('draws the image at the size picked, or the one the preview hands in', () => {
		mockSettings.loadingAnimationSize = 'large';
		const {unmount} = render(<LoadingOverlay />);
		expect(find('.logoSpin').style.width).toBe('170px');
		unmount();

		render(<LoadingOverlay pixelSize={104} />);
		expect(find('.logoSpin').style.width).toBe('104px');
	});

	test('writes the label in capitals under the image', () => {
		render(<LoadingOverlay label="  Loading Stream...  " />);
		const label = screen.getByText('LOADING STREAM...');

		expect(label.style.marginTop).toBe('24px');
		expect(label.style.fontSize).toBe('14px');
		expect(label.style.letterSpacing).toBe('3.5px');
	});

	test('leaves the label out when text is turned off or there is none', () => {
		mockSettings.showLoadingAnimationText = false;
		const {unmount} = render(<LoadingOverlay label="Loading Stream..." />);
		expect(screen.queryByText('LOADING STREAM...')).toBeNull();
		unmount();

		mockSettings.showLoadingAnimationText = true;
		render(<LoadingOverlay label="   " />);
		expect(find('.label')).toBeNull();
	});

	test('shows only the label with no image, and nothing at all without either', () => {
		mockSettings.loadingAnimationImage = 'none';
		const {unmount} = render(<LoadingOverlay label="Loading Stream..." />);
		expect(screen.getByText('LOADING STREAM...').style.marginTop).toBe('0px');
		expect(find('svg, canvas')).toBeNull();
		unmount();

		mockSettings.showLoadingAnimationText = false;
		render(<LoadingOverlay label="Loading Stream..." />);
		expect(find('.overlay')).toBeNull();
	});
});

describe('placed loading overlay', () => {
	test('anchors to the picked spot and keeps its margins there', () => {
		mockSettings.loadingAnimationPosition = 'topCenter';
		render(<PlacedLoadingOverlay />);
		const anchor = find('.anchor');

		expect(anchor.className).toBe('anchor anchorCenter anchorTop');
		expect(anchor.firstChild.style.padding).toBe('40px 24px 0px');
	});

	test('takes one even margin from the preview', () => {
		mockSettings.loadingAnimationPosition = 'bottomRight';
		render(<PlacedLoadingOverlay padding={16} />);

		expect(find('.anchor').firstChild.style.padding).toBe('16px');
	});

	test('bounces inside the margin when bouncing is picked', () => {
		mockSettings.loadingAnimationPosition = 'bouncing';
		const {unmount} = render(<PlacedLoadingOverlay />);
		expect(find('.anchor')).toBeNull();
		expect(find('.bounceArea').style.top).toBe('40px');
		unmount();

		render(<PlacedLoadingOverlay padding={16} />);
		expect(find('.bounceArea').style.left).toBe('16px');
	});
});
