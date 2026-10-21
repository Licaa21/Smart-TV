jest.mock('../platform', () => ({getPlatform: () => 'tizen'}));

import {paceArrowKeys} from './keys';

describe('arrow pacing', () => {
	let frames;

	beforeEach(() => {
		frames = [];
		window.requestAnimationFrame = (callback) => frames.push(callback);
		// Delivered at once, standing in for the message landing after the frame is drawn.
		global.MessageChannel = class {
			constructor () {
				this.port1 = {onmessage: null};
				this.port2 = {postMessage: () => this.port1.onmessage()};
			}
		};
	});

	const setup = () => {
		const target = new EventTarget();
		paceArrowKeys(target);
		const seen = jest.fn();
		target.addEventListener('keydown', seen);
		return {target, seen};
	};
	const send = (target, type, keyCode, repeat = false) => {
		const e = new Event(type, {cancelable: true});
		Object.defineProperties(e, {keyCode: {value: keyCode}, repeat: {value: repeat}});
		target.dispatchEvent(e);
		return e;
	};
	const drawFrame = () => frames.splice(0).forEach((callback) => callback());

	test('a held arrow that repeats before the last move is drawn is dropped', () => {
		const {target, seen} = setup();
		send(target, 'keydown', 40);
		const early = send(target, 'keydown', 40);
		expect(seen).toHaveBeenCalledTimes(1);
		expect(early.defaultPrevented).toBe(true);
		drawFrame();
		send(target, 'keydown', 40);
		expect(seen).toHaveBeenCalledTimes(2);
	});

	test('a repeat the engine flags is paced the same way', () => {
		const {target, seen} = setup();
		send(target, 'keydown', 39);
		send(target, 'keyup', 39);
		send(target, 'keydown', 39, true);
		expect(seen).toHaveBeenCalledTimes(1);
	});

	test('a separate press always goes through, drawn or not', () => {
		const {target, seen} = setup();
		send(target, 'keydown', 39);
		send(target, 'keyup', 39);
		send(target, 'keydown', 39);
		send(target, 'keyup', 39);
		send(target, 'keydown', 37);
		expect(seen).toHaveBeenCalledTimes(3);
	});

	test('only the arrows are paced', () => {
		const {target, seen} = setup();
		send(target, 'keydown', 13);
		send(target, 'keydown', 13);
		expect(seen).toHaveBeenCalledTimes(2);
	});

	test('a page that stops drawing lets the held arrow through after a second', () => {
		const {target, seen} = setup();
		send(target, 'keydown', 39);
		const later = Date.now() + 1500;
		const now = jest.spyOn(Date, 'now').mockImplementation(() => later);
		send(target, 'keydown', 39);
		now.mockRestore();
		expect(seen).toHaveBeenCalledTimes(2);
	});
});
