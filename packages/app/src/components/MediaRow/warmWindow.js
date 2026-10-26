// Which cards of Home's Modern rows fetch their wide art ahead, so a card opens the moment focus lands on it.
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

// The row focus is in, told to every row so those near it can fetch. Rows that don't change
// side don't render again. Before any row has focus it is -1, the media bar's place above the first row.
// ponytail: shared by every screen and told only by Modern rows, so Search's rows and a tile row in between
// can mislead Home's, which only costs it some fetches.
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
