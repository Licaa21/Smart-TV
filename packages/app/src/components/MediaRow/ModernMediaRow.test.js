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
// Like the real card, each one leaves an element beside it in the lane.
jest.mock('../MediaCard/ModernMediaCard', () => {
	const React = require('react');
	return ({item, spotlightId, onFocused, warmRank, hideOverview}) => React.createElement(React.Fragment, null,
		React.createElement('div', {
			className: 'spottable',
			tabIndex: -1,
			'data-spotlight-id': spotlightId,
			'data-warm': warmRank >= 0 ? 'yes' : 'no',
			'data-hide-overview': String(hideOverview),
			onFocus: () => onFocused?.(item.Id)
		}, item.Name),
		React.createElement('div'));
});

jest.mock('./CalendarSeeAllCard', () => {
	const React = require('react');
	return ({spotlightId}) => React.createElement('div', {className: 'spottable', tabIndex: -1, 'data-spotlight-id': spotlightId});
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
		// Six cards, so the last five ask.
		focusCard(0);
		expect(onLoadMore).not.toHaveBeenCalled();
		focusCard(1);
		expect(onLoadMore).toHaveBeenCalledWith('trending');
	});

	it('counts only the cards when it finds how near the end focus is', () => {
		const onLoadMore = jest.fn();
		const longRow = Array.from({length: 16}, (_, i) => ({Id: `item${i}`, Name: `Title ${i}`}));
		draw({onLoadMore, items: longRow});
		focusCard(10);
		expect(onLoadMore).not.toHaveBeenCalled();
		focusCard(11);
		expect(onLoadMore).toHaveBeenCalledWith('trending');
	});

	it('ends the row with the calendar See all card only when asked to', () => {
		const ids = () => Array.from(document.querySelectorAll('.spottable')).map((card) => card.getAttribute('data-spotlight-id'));
		const {rerender} = draw();
		expect(ids()).not.toContain('media-trending-calendar-see-all');
		rerender(<ModernMediaRow rowId="trending" title="Trending" items={items} rowIndex={2} onCalendarSeeAll={() => {}} />);
		expect(ids()[ids().length - 1]).toBe('media-trending-calendar-see-all');
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
			expect(warmCards()).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
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

	it('hands its cards the choice to hide the description, which shows unless asked', () => {
		const hidden = () => Array.from(document.querySelectorAll('.spottable')).map((card) => card.getAttribute('data-hide-overview'));
		const {rerender} = draw();
		expect(hidden()).toEqual(Array(6).fill('false'));
		rerender(<ModernMediaRow rowId="trending" title="Trending" items={items} rowIndex={2} hideOverview />);
		expect(hidden()).toEqual(Array(6).fill('true'));
	});
});
