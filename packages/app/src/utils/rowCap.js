import {getPerfLevelIndex} from './perfTier';

// A row draws every card it has, and on the older sets that is hundreds of cards laid out at once.
// From Medium down only the first of them are drawn, and more as focus nears the end, which is far
// enough ahead that the viewer never sees the edge. Above that nothing is cut. How the cards look
// is not touched.
export const ROW_CAP = 40;
const ROW_STEP = 20;
const NEAR_END = 8;

export const initialRowCount = (total) => (getPerfLevelIndex() >= 3 ? Math.min(total, ROW_CAP) : total);

export const grownRowCount = (count, focusedIndex, total) => (
	focusedIndex >= count - NEAR_END ? Math.min(total, count + ROW_STEP) : count
);
