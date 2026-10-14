import {gridLayout, moveIndex, scrollRowFor} from './tileGridMath';

describe('gridLayout', () => {
	test('fits whole columns and shares the width out between them', () => {
		expect(gridLayout(1000, 650, 190, 300)).toEqual({columns: 5, tileWidth: 200, rowHeight: 300, visibleRows: 3, fullRows: 2});
	});

	test('always keeps one column and one row', () => {
		expect(gridLayout(0, 0, 190, 300)).toEqual({columns: 1, tileWidth: 0, rowHeight: 300, visibleRows: 1, fullRows: 1});
	});
});

describe('moveIndex', () => {
	test('moves one tile across and one row down or up', () => {
		expect(moveIndex(6, 'left', 5, 20)).toBe(5);
		expect(moveIndex(6, 'right', 5, 20)).toBe(7);
		expect(moveIndex(6, 'up', 5, 20)).toBe(1);
		expect(moveIndex(6, 'down', 5, 20)).toBe(11);
	});

	test('hands the press back at every edge', () => {
		expect(moveIndex(5, 'left', 5, 20)).toBeNull();
		expect(moveIndex(9, 'right', 5, 20)).toBeNull();
		expect(moveIndex(3, 'up', 5, 20)).toBeNull();
		expect(moveIndex(17, 'down', 5, 20)).toBeNull();
		expect(moveIndex(11, 'right', 5, 12)).toBeNull();
	});

	test('lands on the last tile when the row below is short', () => {
		expect(moveIndex(8, 'down', 5, 12)).toBe(11);
	});
});

describe('scrollRowFor', () => {
	test('only scrolls as far as it takes to show the focused row whole', () => {
		expect(scrollRowFor(1, 0, 2)).toBe(0);
		expect(scrollRowFor(2, 0, 2)).toBe(1);
		expect(scrollRowFor(0, 3, 2)).toBe(0);
	});
});
