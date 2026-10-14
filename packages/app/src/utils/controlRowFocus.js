// The button after or before this one in a row of buttons, which is where Left or Right goes. Spotlight
// finds that by measuring every candidate on the page for each press, and on the sets that need this a
// quick run of presses outpaced it. In a row the answer is only the neighbour in the document, so it is
// read from there. The ends, and anything this cannot place, are left to Spotlight.
export const neighbourButton = (row, current, direction) => {
	if (!row || !current || !row.contains(current)) return null;
	const buttons = Array.prototype.slice.call(row.querySelectorAll('.spottable')).filter((button) => !button.disabled);
	const at = buttons.indexOf(current);
	if (at === -1) return null;
	return buttons[at + direction] || null;
};

// How long the last focus move took, which the slow key log carries so it says where the time went.
export const focusTiming = {ms: 0};

// Moves focus straight to a button. Spotlight's own focus checks the button's size and place first, and each of
// those reads makes the browser lay the page out before the script can go on, which on a slow set is the press's
// whole cost. A plain focus lets the browser do that once, when it draws. Spotlight hears of the move from the
// focus event, as it does of a pointer's.
export const focusButton = (button) => {
	const started = performance.now();
	if (button.focus) button.focus({preventScroll: true});
	focusTiming.ms = Math.round(performance.now() - started);
	return document.activeElement === button;
};
