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
