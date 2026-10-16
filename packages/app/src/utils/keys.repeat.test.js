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

	test('only the arrows are held back', () => {
		const {target, seen} = setup();
		send(target, 'keydown', 13, 0, false);
		send(target, 'keydown', 13, 400, true);
		expect(seen).toHaveBeenCalledTimes(2);
	});
});
