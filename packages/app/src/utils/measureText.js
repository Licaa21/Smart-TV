// Text width without laying anything out, for deciding what fits on a line before it's drawn.
// One canvas serves every caller, and widths are remembered since the same labels recur.

let context = null;
let family = null;
const widths = new Map();
const WIDTH_CAP = 2000;

const fontFamily = () => {
	if (family === null) {
		family = (typeof document !== 'undefined' && document.body && window.getComputedStyle)
			? window.getComputedStyle(document.body).fontFamily || 'sans-serif'
			: 'sans-serif';
	}
	return family;
};

export const measureTextWidth = (text, fontSize) => {
	const key = `${fontSize}|${text}`;
	if (widths.has(key)) return widths.get(key);
	if (!context && typeof document !== 'undefined') {
		const canvas = document.createElement('canvas');
		context = canvas.getContext ? canvas.getContext('2d') : null;
	}
	// Without a canvas the estimate errs wide, so less is kept rather than something clipped.
	let width = text.length * fontSize * 0.6;
	if (context) {
		context.font = `${fontSize}px ${fontFamily()}`;
		width = context.measureText(text).width;
	}
	if (widths.size >= WIDTH_CAP) widths.clear();
	widths.set(key, width);
	return width;
};

// The items that fit the width in order, dropping from the end once the line is full.
export const fittingItems = (items, width, fontSize, separator) => {
	const fitted = [];
	let used = 0;
	for (const item of items) {
		const piece = fitted.length ? `${separator}${item}` : item;
		const pieceWidth = measureTextWidth(piece, fontSize);
		if (used + pieceWidth > width) break;
		used += pieceWidth;
		fitted.push(item);
	}
	return fitted;
};
