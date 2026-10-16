jest.mock('../platform', () => ({getPlatform: () => 'tizen'}));

import {dropStaleArrowRepeats} from './keys';

describe('held arrow repeats', () => {
	const setup = () => {
		const target = new EventTarget();
		dropStaleArrowRepeats(target);
		const seen = jest.fn();
		target.addEventListener('keydown', seen);
		return {target, seen};
	};
	const send = (target, type, keyCode, ageMs, repeat) => {
		const e = new Event(type, {cancelable: true});
		Object.defineProperties(e, {
			keyCode: {value: keyCode},
			repeat: {value: repeat},
			timeStamp: {value: Date.now() - ageMs}
		});
		target.dispatchEvent(e);
		return e;
	};

	test('a repeat that waited behind a slow move is dropped, a fresh one goes through', () => {
		const {target, seen} = setup();
		send(target, 'keydown', 40, 0, false);
		send(target, 'keydown', 40, 20, true);
		const stale = send(target, 'keydown', 40, 400, true);
		expect(seen).toHaveBeenCalledTimes(2);
		expect(stale.defaultPrevented).toBe(true);
	});

	test('a first press always goes through, however long it waited', () => {
		const {target, seen} = setup();
		send(target, 'keydown', 39, 400, false);
		expect(seen).toHaveBeenCalledTimes(1);
	});

	test('an engine without the repeat flag still has its held repeats told apart', () => {
		const {target, seen} = setup();
		send(target, 'keydown', 37, 0);
		send(target, 'keydown', 37, 400);
		expect(seen).toHaveBeenCalledTimes(1);
		send(target, 'keyup', 37, 0);
		send(target, 'keydown', 37, 400);
		expect(seen).toHaveBeenCalledTimes(2);
	});

	test('a set whose key events all read as old by the same amount still keeps its held repeats', () => {
		const {target, seen} = setup();
		send(target, 'keydown', 38, 5000, false);
		send(target, 'keydown', 38, 5010, true);
		send(target, 'keydown', 38, 5030, true);
		expect(seen).toHaveBeenCalledTimes(3);
		// a real wait on top of that offset is still dropped
		const stale = send(target, 'keydown', 38, 5400, true);
		expect(seen).toHaveBeenCalledTimes(3);
		expect(stale.defaultPrevented).toBe(true);
	});

	test('a set that leaves the stamp empty keeps every repeat', () => {
		const {target, seen} = setup();
		const raw = (repeat) => {
			const e = new Event('keydown', {cancelable: true});
			Object.defineProperties(e, {keyCode: {value: 40}, repeat: {value: repeat}, timeStamp: {value: 0}});
			target.dispatchEvent(e);
		};
		raw(false);
		raw(true);
		raw(true);
		expect(seen).toHaveBeenCalledTimes(3);
	});

	test('a wait too long to be a slow set is a clock that disagrees, and keeps the repeat', () => {
		const {target, seen} = setup();
		send(target, 'keydown', 40, 0, false);
		send(target, 'keydown', 40, 5000, true);
		expect(seen).toHaveBeenCalledTimes(2);
	});

	test('tells what a held key lost once it is let go, and only then', () => {
		const target = new EventTarget();
		const report = jest.fn();
		dropStaleArrowRepeats(target, report);
		send(target, 'keydown', 40, 0, false);
		send(target, 'keydown', 40, 300, true);
		send(target, 'keydown', 40, 500, true);
		expect(report).not.toHaveBeenCalled();
		send(target, 'keyup', 40, 0);
		expect(report).toHaveBeenCalledWith({dropped: 2, worstWaitMs: expect.any(Number), skewMs: expect.any(Number)});
		send(target, 'keydown', 40, 0, false);
		send(target, 'keyup', 40, 0);
		expect(report).toHaveBeenCalledTimes(1);
	});

	test('only the arrows are held back', () => {
		const {target, seen} = setup();
		send(target, 'keydown', 13, 0, false);
		send(target, 'keydown', 13, 400, true);
		expect(seen).toHaveBeenCalledTimes(2);
	});
});
