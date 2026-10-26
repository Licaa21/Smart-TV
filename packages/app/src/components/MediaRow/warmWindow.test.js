import {renderHook, act} from '@testing-library/react';

import {warmsWideArt, announceFocusedRow, isNearFocusedRow, watchFocusedRow, useWarmRow, cardPosition} from './warmWindow';

const warmed = (count, state) => Array.from({length: count}, (_, i) => i).filter((i) => warmsWideArt(i, state));

describe('warmsWideArt', () => {
	it('fetches five cards ahead of the focused one and one behind, going right', () => {
		expect(warmed(20, {focusedIndex: 6, direction: 1, neighbour: false, restIndex: -1})).toEqual([5, 6, 7, 8, 9, 10, 11]);
	});

	it('fetches the same the other way going left', () => {
		expect(warmed(20, {focusedIndex: 6, direction: -1, neighbour: false, restIndex: -1})).toEqual([1, 2, 3, 4, 5, 6, 7]);
	});

	it('stops at the ends of the row', () => {
		expect(warmed(8, {focusedIndex: 6, direction: 1, neighbour: false, restIndex: -1})).toEqual([5, 6, 7]);
		expect(warmed(8, {focusedIndex: 1, direction: -1, neighbour: false, restIndex: -1})).toEqual([0, 1, 2]);
	});

	it('fetches nothing for a row that is not beside the focused one', () => {
		expect(warmed(20, {focusedIndex: -1, direction: 1, neighbour: false, restIndex: 4})).toEqual([]);
	});

	it('fetches the first five of a neighbouring row', () => {
		expect(warmed(20, {focusedIndex: -1, direction: 1, neighbour: true, restIndex: -1})).toEqual([0, 1, 2, 3, 4]);
	});

	it('adds the card a neighbouring row will be entered on, with the five after it and one before', () => {
		expect(warmed(20, {focusedIndex: -1, direction: 1, neighbour: true, restIndex: 9})).toEqual([0, 1, 2, 3, 4, 8, 9, 10, 11, 12, 13, 14]);
		expect(warmed(20, {focusedIndex: -1, direction: 1, neighbour: true, restIndex: 3})).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
	});

	it('copes with a row shorter than the window', () => {
		expect(warmed(3, {focusedIndex: -1, direction: 1, neighbour: true, restIndex: 2})).toEqual([0, 1, 2]);
	});
});

describe('the focused row', () => {
	beforeEach(() => announceFocusedRow(-1));

	it('is near itself and the rows directly above and below it', () => {
		announceFocusedRow(4);
		expect([2, 3, 4, 5, 6].map(isNearFocusedRow)).toEqual([false, true, true, true, false]);
	});

	it('tells the rows watching only when it changes', () => {
		const heard = jest.fn();
		const stop = watchFocusedRow(heard);
		announceFocusedRow(2);
		announceFocusedRow(2);
		announceFocusedRow(undefined);
		announceFocusedRow(3);
		expect(heard.mock.calls).toEqual([[2], [3]]);
		stop();
		announceFocusedRow(5);
		expect(heard).toHaveBeenCalledTimes(2);
	});
});

describe('useWarmRow', () => {
	beforeEach(() => announceFocusedRow(-1));
	const warmedBy = (warms, focusedIndex) => Array.from({length: 14}, (_, i) => i).filter((i) => warms(i, focusedIndex));

	it('follows the way focus moves along the row', () => {
		const {result} = renderHook(() => useWarmRow(3, true));
		act(() => result.current.noteFocus(6));
		act(() => result.current.noteFocus(7));
		expect(warmedBy(result.current.warms, 7)).toEqual([6, 7, 8, 9, 10, 11, 12]);
		act(() => result.current.noteFocus(6));
		expect(warmedBy(result.current.warms, 6)).toEqual([1, 2, 3, 4, 5, 6, 7]);
	});

	it('does not take entering the row for a move', () => {
		const {result} = renderHook(() => useWarmRow(3, true));
		act(() => result.current.noteFocus(8));
		act(() => result.current.noteBlur());
		act(() => result.current.noteFocus(0));
		expect(warmedBy(result.current.warms, 0)).toEqual([0, 1, 2, 3, 4, 5]);
	});

	it('fetches the first cards when a row beside the focused one is asked', () => {
		const {result} = renderHook(() => useWarmRow(3, true));
		expect(warmedBy(result.current.warms, -1)).toEqual([]);
		act(() => announceFocusedRow(2));
		expect(warmedBy(result.current.warms, -1)).toEqual([0, 1, 2, 3, 4]);
	});

	it('forgets the card it was left on when the setting says to start at the first', () => {
		const {result} = renderHook(() => useWarmRow(3, false));
		act(() => result.current.noteFocus(9));
		act(() => result.current.noteBlur());
		act(() => announceFocusedRow(4));
		expect(warmedBy(result.current.warms, -1)).toEqual([0, 1, 2, 3, 4]);
	});
});

describe('cardPosition', () => {
	it('counts the cards only, not the helper nodes beside some of them', () => {
		document.body.innerHTML = '<div><div class="spottable"></div><div style="display: none"></div><div class="spottable"></div><div style="display: none"></div><div class="spottable"></div></div>';
		const cards = document.querySelectorAll('.spottable');
		expect([...cards].map(cardPosition)).toEqual([0, 1, 2]);
		expect(cardPosition(null)).toBe(-1);
	});
});
