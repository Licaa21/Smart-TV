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
jest.mock('react-dom', () => ({flushSync: (fn) => fn()}));
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
	return ({item, spotlightId, onFocused, warmRank, isFocused}) => React.createElement('div', {
		className: 'spottable',
		tabIndex: -1,
		'data-spotlight-id': spotlightId,
		'data-warm': warmRank >= 0 ? 'yes' : 'no',
		'data-focused': isFocused ? 'yes' : 'no',
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

	describe('moving between rows with Up and Down', () => {
		const opened = () => document.querySelectorAll('[data-focused="yes"]').length;
		const cards = () => document.querySelectorAll('.spottable');
		const leave = () => fireEvent.blur(cards()[1], {relatedTarget: document.body});
		const press = (keyCode) => fireEvent.keyDown(cards()[1], {keyCode});
		let clock = 0;

		beforeEach(() => {
			jest.useFakeTimers();
			// Each test starts well after the key of the one before
			clock += 100000;
			jest.setSystemTime(clock);
		});
		afterEach(() => jest.useRealTimers());

		it('closes at once when focus leaves any other way', () => {
			draw();
			focusCard(1);
			expect(opened()).toBe(1);
			leave();
			expect(opened()).toBe(0);
		});

		it('opens the card at once when focus comes any other way', () => {
			draw();
			focusCard(1);
			expect(opened()).toBe(1);
		});

		it('opens the card moved to a little way into the slide, not before it', () => {
			draw({onNavigateDown: jest.fn()});
			press(40);
			focusCard(1);
			expect(opened()).toBe(0);
			act(() => { jest.advanceTimersByTime(99); });
			expect(opened()).toBe(0);
			act(() => { jest.advanceTimersByTime(2); });
			expect(opened()).toBe(1);
		});

		it('does not open a card that focus has left again', () => {
			draw({onNavigateDown: jest.fn()});
			press(40);
			focusCard(1);
			leave();
			act(() => { jest.advanceTimersByTime(500); });
			expect(opened()).toBe(0);
		});

		it('keeps the row left open until the slide is over when it stays in sight, and then closes it', () => {
			draw({onNavigateDown: jest.fn()});
			focusCard(1);
			press(40);
			leave();
			expect(opened()).toBe(1);
			act(() => { jest.advanceTimersByTime(400); });
			expect(opened()).toBe(1);
			act(() => { jest.advanceTimersByTime(100); });
			expect(opened()).toBe(0);
		});

		it('closes the row left at once on Up, where it stays in sight', () => {
			draw({onNavigateUp: jest.fn()});
			focusCard(1);
			press(38);
			leave();
			expect(opened()).toBe(0);
		});

		it('closes the row left once it is out of screen', () => {
			const list = document.createElement('div');
			list.setAttribute('data-slide-scroll', 'y');
			document.body.appendChild(list);
			render(<ModernMediaRow rowId="trending" title="Trending" items={items} rowIndex={2} onNavigateDown={jest.fn()} />, {container: list});
			let rowRect = {top: 100, bottom: 400};
			jest.spyOn(list, 'getBoundingClientRect').mockReturnValue({top: 0, bottom: 1000});
			jest.spyOn(find('[data-row-index="2"]'), 'getBoundingClientRect').mockImplementation(() => rowRect);
			// Focus moves to another row of the list
			const next = document.createElement('div');
			list.appendChild(next);
			focusCard(1);
			press(40);
			fireEvent.blur(cards()[1], {relatedTarget: next});
			act(() => { jest.advanceTimersByTime(200); });
			expect(opened()).toBe(1);
			rowRect = {top: -500, bottom: -100};
			act(() => { jest.advanceTimersByTime(50); });
			expect(opened()).toBe(0);
		});

		it('closes at once when focus leaves the list, to the media bar or the tabs above it', () => {
			const list = document.createElement('div');
			list.setAttribute('data-slide-scroll', 'y');
			document.body.appendChild(list);
			render(<ModernMediaRow rowId="trending" title="Trending" items={items} rowIndex={2} onNavigateDown={jest.fn()} />, {container: list});
			focusCard(1);
			press(40);
			leave();
			expect(opened()).toBe(0);
		});

		it('stays open when focus comes back before it closes', () => {
			draw({onNavigateDown: jest.fn()});
			focusCard(1);
			press(40);
			leave();
			act(() => { jest.advanceTimersByTime(60); });
			fireEvent.focus(cards()[1]);
			act(() => { jest.advanceTimersByTime(1000); });
			expect(opened()).toBe(1);
		});
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
});
