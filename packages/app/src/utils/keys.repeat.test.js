jest.mock('../platform', () => ({getPlatform: () => 'tizen'}));

import {watchArrowHolds} from './keys';

describe('what a held arrow looked like', () => {
	let now;
	beforeEach(() => {
		now = 0;
		jest.spyOn(performance, 'now').mockImplementation(() => now);
	});
	afterEach(() => jest.restoreAllMocks());

	const press = (target, type, keyCode, at, repeat = false) => {
		now = at;
		const e = new Event(type, {cancelable: true});
		Object.defineProperties(e, {keyCode: {value: keyCode}, key: {value: 'ArrowDown'}, repeat: {value: repeat}});
		target.dispatchEvent(e);
	};

	test('tells how many downs a long hold sent, and how far apart', () => {
		const target = new EventTarget();
		const report = jest.fn();
		watchArrowHolds(target, report);
		press(target, 'keydown', 40, 0);
		[500, 600, 700, 800].forEach((at) => press(target, 'keydown', 40, at, true));
		press(target, 'keyup', 40, 850);
		expect(report).toHaveBeenCalledWith({key: 'ArrowDown', keyCode: 40, downs: 5, flaggedRepeats: 4, heldMs: 850, gapMs: [100, 100, 500], endedBy: 'key up'});
	});

	test('tells a hold that sent one down and nothing else', () => {
		const target = new EventTarget();
		const report = jest.fn();
		watchArrowHolds(target, report);
		press(target, 'keydown', 38, 0);
		press(target, 'keyup', 38, 1200);
		expect(report).toHaveBeenCalledWith(expect.objectContaining({downs: 1, flaggedRepeats: 0, heldMs: 1200, gapMs: []}));
	});

	test('is quiet about a tap', () => {
		const target = new EventTarget();
		const report = jest.fn();
		watchArrowHolds(target, report);
		press(target, 'keydown', 37, 0);
		press(target, 'keyup', 37, 120);
		expect(report).not.toHaveBeenCalled();
	});

	test('tells a hold whose key up never came once the next one starts', () => {
		const target = new EventTarget();
		const report = jest.fn();
		watchArrowHolds(target, report);
		press(target, 'keydown', 39, 0);
		press(target, 'keydown', 39, 700, true);
		press(target, 'keydown', 39, 5000);
		expect(report).toHaveBeenCalledWith(expect.objectContaining({downs: 2, endedBy: 'no key up'}));
	});

	test('leaves the other keys alone', () => {
		const target = new EventTarget();
		const report = jest.fn();
		watchArrowHolds(target, report);
		const e = new Event('keydown');
		Object.defineProperties(e, {keyCode: {value: 13}, key: {value: 'Enter'}});
		target.dispatchEvent(e);
		now = 2000;
		const up = new Event('keyup');
		Object.defineProperties(up, {keyCode: {value: 13}, key: {value: 'Enter'}});
		target.dispatchEvent(up);
		expect(report).not.toHaveBeenCalled();
	});
});
