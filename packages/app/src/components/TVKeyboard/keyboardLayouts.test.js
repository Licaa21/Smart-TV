import {
	lowerFor,
	upperFor,
	variantForLocale,
	alternatesFor,
	NUMBER_PAD_LAYOUT,
	NUMERIC_LAYOUT,
	DOCKED_NUMERIC_LAYOUT,
	dockedFor,
	keyBoxes,
	keyUnitSpan,
	maxRowSpan
} from './keyboardLayouts';

describe('keyboardLayouts', () => {
	test('shifting uppercases letters and leaves actions alone', () => {
		const upper = upperFor('qwerty');
		expect(upper[0][0]).toBe('Q');
		expect(upper[1][9]).toBe('"');
		expect(upper[2][0]).toBe('SHIFT');
		expect(upper[3][0]).toBe('123');
	});

	test('azerty rearranges the letters', () => {
		expect(lowerFor('azerty')[0][0]).toBe('a');
		expect(upperFor('azerty')[0][0]).toBe('A');
		expect(upperFor('azerty')[1][9]).toBe('M');
	});

	test('qwertz swaps y and z', () => {
		expect(lowerFor('qwertz')[0][5]).toBe('z');
		expect(lowerFor('qwertz')[2][1]).toBe('y');
	});

	test('locale picks the layout variant', () => {
		expect(variantForLocale('fr-FR')).toBe('azerty');
		expect(variantForLocale('de')).toBe('qwertz');
		expect(variantForLocale('cs-CZ')).toBe('qwertz');
		expect(variantForLocale('en-US')).toBe('qwerty');
		expect(variantForLocale(undefined)).toBe('qwerty');
	});

	test('alternates exist for accented letters but not plain ones', () => {
		expect(alternatesFor('a')).toContain('à');
		expect(alternatesFor('A')).toContain('À');
		expect(alternatesFor('q')).toBeNull();
		expect(alternatesFor('SPACE')).toBeNull();
	});

	test('the number pad is a dialer with done on the last row', () => {
		expect(NUMBER_PAD_LAYOUT[0]).toEqual(['1', '2', '3']);
		expect(NUMBER_PAD_LAYOUT[4]).toEqual(['CURSORL', 'CURSORR', 'DONE']);
	});

	test('the numeric page keeps the shared bottom row shape', () => {
		expect(NUMERIC_LAYOUT[3][0]).toBe('ABC');
		expect(NUMERIC_LAYOUT[3]).toContain('SPACE');
		expect(NUMERIC_LAYOUT[3]).toContain('IME');
	});

	test('key spans stretch space and the labelled actions', () => {
		expect(keyUnitSpan('SPACE', false)).toBeCloseTo(2.4);
		expect(keyUnitSpan('DONE', false)).toBeCloseTo(1.22);
		expect(keyUnitSpan('a', false)).toBe(1);
		expect(keyUnitSpan('SPACE', true)).toBe(1);
	});

	test('the widest row drives the grid width', () => {
		const span = maxRowSpan(NUMBER_PAD_LAYOUT, true);
		expect(span).toBeCloseTo(3.2);
	});

	test('every docked row is twelve cells, the rail, ten characters and an action', () => {
		['qwerty', 'azerty', 'qwertz'].forEach((variant) => {
			[dockedFor(variant, false), dockedFor(variant, true), DOCKED_NUMERIC_LAYOUT].forEach((layout) => {
				expect(layout).toHaveLength(4);
				layout.forEach((row) => expect(row).toHaveLength(12));
				expect(layout.map((row) => row[0])).toEqual(['MODE_LOWER', 'MODE_UPPER', 'MODE_NUM', 'IME']);
				expect(layout.map((row) => row[11])).toEqual(['BACKSPACE', 'BACKSPACE', 'DONE', 'DONE']);
				expect(layout[3]).toEqual(['IME', 'SPACE', 'SPACE', 'SPACE', 'SPACE', 'SPACE', 'SPACE', 'SPACE', 'CURSORL', 'CURSORR', 'PASTE', 'DONE']);
			});
		});
	});

	test('the docked letters come from the classic rows without shift and backspace', () => {
		expect(dockedFor('qwerty', false)[0].slice(1, 11)).toEqual(lowerFor('qwerty')[0]);
		expect(dockedFor('qwerty', false)[2].slice(1, 11)).toEqual(['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '@']);
		expect(dockedFor('azerty', false)[1].slice(1, 11)).toEqual(lowerFor('azerty')[1]);
		expect(dockedFor('qwertz', false)[2][1]).toBe('y');
		expect(dockedFor('qwerty', true)[0][1]).toBe('Q');
		expect(dockedFor('qwerty', true)[1][10]).toBe('"');
		expect(dockedFor('azerty', true)[1][10]).toBe('M');
	});

	test('the docked symbols drop the semicolon to fit', () => {
		expect(DOCKED_NUMERIC_LAYOUT[0].slice(1, 11)).toEqual(NUMERIC_LAYOUT[0]);
		expect(DOCKED_NUMERIC_LAYOUT[1].slice(1, 11)).toEqual(NUMERIC_LAYOUT[1]);
		expect(DOCKED_NUMERIC_LAYOUT[2].slice(1, 11)).toEqual(['-', '_', '=', '+', ':', "'", '?', '/', ',', '.']);
		expect(DOCKED_NUMERIC_LAYOUT.some((row) => row.includes(';'))).toBe(false);
	});

	test('a repeated key becomes one box spanning its cells', () => {
		const boxes = keyBoxes(dockedFor('qwerty', false));
		// 48 cells, less the six extra cells of space and one each under Delete and Done
		expect(boxes).toHaveLength(48 - 6 - 1 - 1);
		expect(boxes.find((box) => box.key === 'SPACE')).toEqual({key: 'SPACE', row: 3, col: 1, lastRow: 3, lastCol: 7});
		expect(boxes.find((box) => box.key === 'BACKSPACE')).toEqual({key: 'BACKSPACE', row: 0, col: 11, lastRow: 1, lastCol: 11});
		expect(boxes.find((box) => box.key === 'DONE')).toEqual({key: 'DONE', row: 2, col: 11, lastRow: 3, lastCol: 11});
		expect(keyBoxes(NUMBER_PAD_LAYOUT)).toHaveLength(15);
	});
});
