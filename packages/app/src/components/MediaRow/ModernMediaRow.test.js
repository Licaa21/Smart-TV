import {act, fireEvent, render} from '@testing-library/react';

import ModernMediaRow from './ModernMediaRow';
import {announceFocusedRow, isNearFocusedRow as isNear} from './warmWindow';

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
// Pointer mode keeps the row from reaching for layout that jsdom doesn't have.
jest.mock('@enact/spotlight', () => ({focus: jest.fn(() => true), getPointerMode: () => true}));
jest.mock('@enact/spotlight/SpotlightContainerDecorator', () => (config, type) => {
	const React = require('react');
	return React.forwardRef(({spotlightId, ...props}, ref) => React.createElement(type, {...props, ref, 'data-spotlight-id': spotlightId}));
});
jest.mock('../../context/SettingsContext', () => ({useSettings: () => ({settings: {}})}));
jest.mock('../../platform', () => ({getPlatform: () => 'webos'}));
jest.mock('../Skeleton', () => ({SkeletonHomeRow: () => null, SkeletonRowTitle: () => null}));
jest.mock('../MediaCard/ModernMediaCard', () => {
	const React = require('react');
	return ({item, spotlightId, onFocused, warmFocusArt}) => React.createElement('div', {
		className: 'spottable',
		tabIndex: -1,
		'data-spotlight-id': spotlightId,
		'data-warm': warmFocusArt ? 'yes' : 'no',
		onFocus: () => onFocused?.(item.Id)
	}, item.Name);
});

const items = Array.from({length: 6}, (_, i) => ({Id: `item${i}`, Name: `Title ${i}`}));

const draw = (props) => render(<ModernMediaRow rowId="trending" title="Trending" items={items} rowIndex={2} {...props} />);
const find = (selector) => document.querySelector(selector);
const focusCard = (index) => fireEvent.focus(document.querySelectorAll('.spottable')[index]);

describe('ModernMediaRow', () => {
	it('keeps the row spotlight id Home uses unless it is handed one', () => {
		const {unmount} = draw();
		expect(find('[data-row-index="2"]').getAttribute('data-spotlight-id')).toBe('row-2');
		unmount();
		draw({spotlightId: 'discover-row-2'});
		expect(find('[data-row-index="2"]').getAttribute('data-spotlight-id')).toBe('discover-row-2');
	});

	it('asks for more once focus reaches the last few cards', () => {
		const onLoadMore = jest.fn();
		draw({onLoadMore});
		focusCard(2);
		expect(onLoadMore).not.toHaveBeenCalled();
		focusCard(3);
		expect(onLoadMore).toHaveBeenCalledWith('trending');
	});

	it('still tells the screen which row took focus', () => {
		const onFocus = jest.fn();
		draw({onFocus});
		focusCard(0);
		expect(onFocus).toHaveBeenCalledWith(2);
	});

	describe('fetching wide art ahead', () => {
		const many = Array.from({length: 14}, (_, i) => ({Id: `many${i}`, Name: `Many ${i}`}));
		const warmCards = () => [...document.querySelectorAll('.spottable')].map((el, i) => (el.getAttribute('data-warm') === 'yes' ? i : -1)).filter((i) => i >= 0);
		const leaveRow = () => fireEvent.blur(document.querySelectorAll('.spottable')[0], {relatedTarget: document.body});

		beforeEach(() => announceFocusedRow(-1));

		it('asks for the cards ahead of the focused one, and flips when focus turns back', () => {
			draw({items: many});
			expect(warmCards()).toEqual([]);
			focusCard(3);
			expect(warmCards()).toEqual([2, 3, 4, 5, 6, 7, 8]);
			focusCard(2);
			expect(warmCards()).toEqual([0, 1, 2, 3]);
		});

		it('asks for the first cards of a row beside the focused one', () => {
			draw({items: many});
			act(() => announceFocusedRow(1));
			expect(warmCards()).toEqual([0, 1, 2, 3, 4]);
			act(() => announceFocusedRow(3));
			expect(warmCards()).toEqual([0, 1, 2, 3, 4]);
			act(() => announceFocusedRow(6));
			expect(warmCards()).toEqual([]);
		});

		it('also asks for the card the row was left on, and the ones after it', () => {
			draw({items: many});
			focusCard(9);
			leaveRow();
			act(() => announceFocusedRow(1));
			expect(warmCards()).toEqual([0, 1, 2, 3, 4, 8, 9, 10, 11, 12, 13]);
		});

		it('tells the other rows which row took focus', () => {
			draw({items: many});
			focusCard(0);
			expect(isNear(1)).toBe(true);
			expect(isNear(3)).toBe(true);
			expect(isNear(2)).toBe(true);
			expect(isNear(0)).toBe(false);
			expect(isNear(4)).toBe(false);
		});
	});
});
