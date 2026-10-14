import {renderHook, act, fireEvent} from '@testing-library/react';

import useHeldSeekStep, {holdSeekSeconds} from './useHeldSeekStep';

describe('holdSeekSeconds', () => {
	test('grows from the set step to 30, 60 and 180 seconds over a hold', () => {
		expect([1, 3, 4, 8, 9, 16, 17, 40].map((count) => holdSeekSeconds(10, count))).toEqual([10, 10, 30, 30, 60, 60, 180, 180]);
	});

	test('never moves less than the set step', () => {
		expect(holdSeekSeconds(60, 5)).toBe(60);
		expect(holdSeekSeconds(60, 20)).toBe(180);
	});
});

describe('useHeldSeekStep', () => {
	let now;

	beforeEach(() => {
		now = 0;
		jest.spyOn(Date, 'now').mockImplementation(() => now);
	});

	afterEach(() => jest.restoreAllMocks());

	const setup = () => renderHook(() => useHeldSeekStep(10)).result;

	// Presses arriving the way a held remote repeats them.
	const hold = (result, direction, presses) => Array.from({length: presses}, () => {
		now += 50;
		let move;
		act(() => {
			move = result.current.stepBy(direction);
		});
		return move;
	});

	test('speeds up while held and keeps the sign of the direction', () => {
		const result = setup();
		expect(hold(result, 1, 17)).toEqual([10, 10, 10, 30, 30, 30, 30, 30, 60, 60, 60, 60, 60, 60, 60, 60, 180]);
		expect(hold(result, -1, 1)).toEqual([-10]);
	});

	test('reports how far the next press goes, back to the set step once the key is let go', () => {
		const result = setup();
		expect(result.current.stepSeconds).toBe(10);
		hold(result, 1, 3);
		expect(result.current.stepSeconds).toBe(30);
		fireEvent.keyUp(window, {keyCode: 39});
		expect(result.current.stepSeconds).toBe(10);
	});

	test('starts over on a key up, so separate presses move the set step', () => {
		const result = setup();
		hold(result, 1, 5);
		fireEvent.keyUp(window, {keyCode: 39});
		expect(hold(result, 1, 1)).toEqual([10]);
	});

	test('starts over after a pause, in case the key up never arrived', () => {
		const result = setup();
		hold(result, 1, 5);
		now += 1500;
		expect(hold(result, 1, 1)).toEqual([10]);
	});
});
