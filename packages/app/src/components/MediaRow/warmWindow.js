import {useCallback, useEffect, useRef, useState} from 'react';

// Which cards of the Modern rows fetch their wide art ahead, so a card opens the moment focus lands on it.
//
// The focused row fetches the cards ahead in the direction focus is moving, and one behind. The rows above
// and below fetch their first cards, and the card they will be entered on with the ones ahead of it. A row
// focus has left keeps that window, so what it was still fetching is not dropped.

export const WARM_AHEAD = 5;

// restIndex is the card the row was left on, -1 when it has none or the row always starts at its first card.
export const warmsWideArt = (index, {focusedIndex, direction, neighbour, restIndex}) => {
	if (focusedIndex >= 0) {
		const ahead = (index - focusedIndex) * direction;
		return ahead >= -1 && ahead <= WARM_AHEAD;
	}
	if (!neighbour) return false;
	return index < WARM_AHEAD || (restIndex >= 0 && index >= restIndex - 1 && index <= restIndex + WARM_AHEAD);
};

// Where a card stands among its row's cards. Some cards come with a hidden helper node beside them, so the
// position among all the children would count them twice.
export const cardPosition = (card) => (card && card.parentNode
	? Array.prototype.filter.call(card.parentNode.children, (el) => el.classList.contains('spottable')).indexOf(card)
	: -1);

// The row focus is in, told to every row so those near it can fetch. Rows that don't change
// side don't render again. Before any row has focus it is -1, the media bar's place above the first row.
// Home tells it for every kind of row (tile and button rows too), Seerr Discover and Search through their rows.
// ponytail: shared by every screen, so another screen's rows can mislead Home's, which only costs them some fetches.
let focusedRow = -1;
const listeners = new Set();

export const announceFocusedRow = (rowIndex) => {
	if (typeof rowIndex !== 'number' || rowIndex === focusedRow) return;
	focusedRow = rowIndex;
	listeners.forEach((listener) => listener(rowIndex));
};

// The focused row counts too, so one that focus has left keeps what it was fetching.
export const isNearFocusedRow = (rowIndex) => Math.abs(focusedRow - rowIndex) <= 1;

export const watchFocusedRow = (listener) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};

// What a row needs to fetch its cards' wide art ahead. noteFocus is told the index of the card that took focus
// (-1 when it is not known), noteBlur that focus left the row, and warms says whether a card is to fetch.
export const useWarmRow = (rowIndex, rememberRowCard) => {
	const lastIndexRef = useRef(-1);
	const directionRef = useRef(1);
	const inRowRef = useRef(false);
	const [near, setNear] = useState(() => isNearFocusedRow(rowIndex));
	useEffect(() => {
		const sync = () => setNear(isNearFocusedRow(rowIndex));
		sync();
		return watchFocusedRow(sync);
	}, [rowIndex]);

	const noteFocus = useCallback((index) => {
		announceFocusedRow(rowIndex);
		if (index < 0) return;
		// Entering the row says nothing about the way focus is moving in it
		if (inRowRef.current && index !== lastIndexRef.current) directionRef.current = index > lastIndexRef.current ? 1 : -1;
		inRowRef.current = true;
		lastIndexRef.current = index;
	}, [rowIndex]);

	const noteBlur = useCallback(() => {
		inRowRef.current = false;
		directionRef.current = 1;
	}, []);

	const warms = useCallback((index, focusedIndex) => warmsWideArt(index, {
		focusedIndex,
		direction: directionRef.current,
		neighbour: near,
		restIndex: rememberRowCard === false ? -1 : lastIndexRef.current
	}), [near, rememberRowCard]);

	return {noteFocus, noteBlur, warms};
};
