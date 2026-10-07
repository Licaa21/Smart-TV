import {GAMEPAD_KEYS, giveControllerToGame, installGamepadKeys, raiseHostBack} from '../../../platform-xbox/src/keys';

const press = (target, keyCode, type = 'keydown', init = {}) => {
	const event = new window.KeyboardEvent(type, {keyCode, which: keyCode, bubbles: true, cancelable: true, ...init});
	target.dispatchEvent(event);
	return event;
};

describe('the Xbox gamepad keys', () => {
	let button;
	let remove;
	let seen;
	let stopRecording;
	let now = 100000;

	beforeEach(() => {
		// Each test starts well clear of the last one's Back
		now += 10000;
		jest.spyOn(Date, 'now').mockImplementation(() => now);
		button = document.createElement('button');
		document.body.appendChild(button);
		button.focus();
		seen = [];
		const record = (e) => seen.push({type: e.type, keyCode: e.keyCode, key: e.key, repeat: e.repeat});
		remove = installGamepadKeys();
		// Registered after the translation, as Spotlight and the app are
		window.addEventListener('keydown', record, true);
		window.addEventListener('keyup', record, true);
		stopRecording = () => {
			window.removeEventListener('keydown', record, true);
			window.removeEventListener('keyup', record, true);
		};
	});

	afterEach(() => {
		remove();
		stopRecording();
		button.remove();
		Date.now.mockRestore();
	});

	test.each([
		[203, 38, 'ArrowUp'], [204, 40, 'ArrowDown'], [205, 37, 'ArrowLeft'], [206, 39, 'ArrowRight'],
		[211, 38, 'ArrowUp'], [212, 40, 'ArrowDown'], [213, 39, 'ArrowRight'], [214, 37, 'ArrowLeft'],
		[138, 38, 'ArrowUp'], [139, 40, 'ArrowDown'], [140, 37, 'ArrowLeft'], [141, 39, 'ArrowRight'],
		[195, 13, 'Enter'], [142, 13, 'Enter'], [196, 27, 'Escape'], [143, 27, 'Escape'], [197, 8, 'Backspace'], [207, 93, 'ContextMenu'],
		[201, 227, 'MediaRewind'], [202, 228, 'MediaFastForward']
	])('gamepad code %i reaches the app once, as %i', (gamepad, keyCode, key) => {
		const raw = press(button, gamepad);
		expect(seen).toEqual([{type: 'keydown', keyCode, key, repeat: false}]);
		expect(raw.defaultPrevented).toBe(true);
	});

	test('the release and a held key come through as they were', () => {
		press(button, 203, 'keydown', {repeat: true});
		press(button, 203, 'keyup');
		expect(seen).toEqual([
			{type: 'keydown', keyCode: 38, key: 'ArrowUp', repeat: true},
			{type: 'keyup', keyCode: 38, key: 'ArrowUp', repeat: false}
		]);
	});

	test('the translated key is raised on the element the gamepad key was aimed at', () => {
		const onButton = jest.fn();
		button.addEventListener('keydown', (e) => onButton(e.keyCode));
		press(button, 195);
		expect(onButton).toHaveBeenCalledTimes(1);
		expect(onButton).toHaveBeenCalledWith(13);
	});

	test('keys that are already standard pass through untouched', () => {
		const raw = press(button, 38, 'keydown', {key: 'ArrowUp'});
		press(button, 65, 'keydown', {key: 'a'});
		press(button, 27, 'keydown', {key: 'Unidentified'});
		expect(seen.map((entry) => entry.keyCode)).toEqual([38, 65, 27]);
		expect(raw.defaultPrevented).toBe(false);
	});

	test('every code in the table stands for a key the app handles', () => {
		for (const standard of Object.values(GAMEPAD_KEYS)) {
			expect([8, 13, 27, 37, 38, 39, 40, 93, 227, 228]).toContain(standard.keyCode);
		}
	});

	describe('while a game has the controller', () => {
		const withGamepads = (pads) => Object.defineProperty(window.navigator, 'getGamepads', {configurable: true, value: () => pads});

		beforeEach(() => {
			withGamepads([null, {buttons: []}]);
			giveControllerToGame(true);
		});

		afterEach(() => {
			giveControllerToGame(false);
			delete window.navigator.getGamepads;
		});

		test('its buttons dont reach the app as keys, in either form the console sends them', () => {
			const raw = press(button, 195);
			press(button, 203);
			press(button, 198);
			press(button, 40, 'keydown', {key: 'Unidentified'});
			press(button, 27, 'keydown', {key: 'Unidentified'});
			press(button, 27, 'keyup', {key: 'Unidentified'});
			expect(seen).toEqual([]);
			expect(raw.defaultPrevented).toBe(true);
		});

		test('a keyboard and a media remote still get through', () => {
			press(button, 40, 'keydown', {key: 'ArrowDown'});
			press(button, 27, 'keydown', {key: 'Escape'});
			press(button, 143);
			expect(seen.map((entry) => entry.keyCode)).toEqual([40, 27, 27]);
		});

		test('a B the game took isnt raised again when the host reports it', () => {
			press(button, 27, 'keydown', {key: 'Unidentified'});
			now += 50;
			expect(raiseHostBack()).toBe(false);
			expect(seen).toEqual([]);
		});

		test('the keys come through when the page sees no gamepad', () => {
			withGamepads([null, null]);
			press(button, 195);
			press(button, 27, 'keydown', {key: 'Unidentified'});
			expect(seen.map((entry) => entry.keyCode)).toEqual([13, 27]);
		});

		test('they come through again once the game gives it back', () => {
			giveControllerToGame(false);
			press(button, 195);
			expect(seen.map((entry) => entry.keyCode)).toEqual([13]);
		});
	});

	test('a Back the host reports is raised as a press and a release', () => {
		expect(raiseHostBack()).toBe(true);
		expect(seen).toEqual([
			{type: 'keydown', keyCode: 27, key: 'Escape', repeat: false},
			{type: 'keyup', keyCode: 27, key: 'Escape', repeat: false}
		]);
	});

	test('a Back told both ways counts once, whichever comes first', () => {
		press(button, 196);
		now += 50;
		expect(raiseHostBack()).toBe(false);
		expect(seen).toHaveLength(1);

		now += 5000;
		seen.length = 0;
		expect(raiseHostBack()).toBe(true);
		now += 50;
		press(button, 196);
		expect(seen.filter((entry) => entry.type === 'keydown')).toHaveLength(1);

		now += 5000;
		seen.length = 0;
		press(button, 196);
		expect(seen).toHaveLength(1);
	});

	test('nothing is translated once it is removed', () => {
		remove();
		press(button, 203);
		expect(seen).toEqual([{type: 'keydown', keyCode: 203, key: '', repeat: false}]);
	});
});
