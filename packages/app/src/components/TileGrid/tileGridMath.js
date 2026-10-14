// Columns that fit and the width each tile gets, sized the way Sandstone's grid list sizes them, so
// a library looks the same whichever grid draws it.
export const gridLayout = (width, height, minWidth, minHeight) => {
	const columns = Math.max(1, Math.floor(width / minWidth));
	return {
		columns,
		tileWidth: Math.floor(width / columns),
		rowHeight: minHeight,
		visibleRows: Math.max(1, Math.ceil(height / minHeight)),
		fullRows: Math.max(1, Math.floor(height / minHeight))
	};
};

// The tile a direction key lands on, or null when the press should leave the grid. Down into a
// short last row lands on its last tile.
export const moveIndex = (index, direction, columns, dataSize) => {
	const column = index % columns;
	const row = Math.floor(index / columns);
	const lastRow = Math.floor((dataSize - 1) / columns);
	switch (direction) {
		case 'left': return column === 0 ? null : index - 1;
		case 'right': return column === columns - 1 || index === dataSize - 1 ? null : index + 1;
		case 'up': return row === 0 ? null : index - columns;
		case 'down': return row === lastRow ? null : Math.min(index + columns, dataSize - 1);
		default: return null;
	}
};

// The first row on screen once the focused row is fully in view, moving no further than it has to.
export const scrollRowFor = (focusRow, firstRow, fullRows) => {
	if (focusRow < firstRow) return focusRow;
	if (focusRow >= firstRow + fullRows) return focusRow - fullRows + 1;
	return firstRow;
};
