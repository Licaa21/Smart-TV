import {watchArrowResponse} from './keys';

// A clock and an animation frame loop the test drives by hand
const rig = () => {
	let now = 0;
	let frames = [];
	jest.spyOn(performance, 'now').mockImplementation(() => now);
	jest.spyOn(window, 'requestAnimationFrame').mockImplementation((fn) => frames.push(fn));
	// The set stamps a key down with the time it came in, which is `now` unless the test says it waited in a queue
	const key = (target, type, keyCode, {repeat = false, waited = 0} = {}) => {
		const event = Object.assign(new Event(type), {keyCode, repeat});
		Object.defineProperty(event, 'timeStamp', {value: now - waited});
		target.dispatchEvent(event);
	};
	return {
		down: (target, keyCode = 40, options) => key(target, 'keydown', keyCode, options),
		up: (target, keyCode = 40) => key(target, 'keyup', keyCode),
		// Frames arrive at the given gaps, in ms
		frame: (...gaps) => gaps.forEach((gap) => {
			now += gap;
			const due = frames;
			frames = [];
			due.forEach((fn) => fn());
		}),
		// Sixty frames a second for about this long
		smooth: (ms) => {
			for (let t = 0; t < ms; t += 16) {
				now += 16;
				const due = frames;
				frames = [];
				due.forEach((fn) => fn());
			}
		},
		wait: (ms) => { now += ms; }
	};
};

describe('watchArrowResponse', () => {
	afterEach(() => jest.restoreAllMocks());

	const tap = (clock, target, ...frames) => {
		clock.down(target);
		clock.up(target);
		clock.frame(...frames);
		clock.smooth(700);
	};

	it('says how long a press took to reach a frame, and the worst frame after it, every few presses', () => {
		const target = document.createElement('div');
		const report = jest.fn();
		const clock = rig();
		watchArrowResponse(target, report, 3);
		// the first frame comes 120 ms after the key, then a frame of 90 ms
		tap(clock, target, 120, 16, 90);
		clock.wait(1000);
		tap(clock, target, 16);
		clock.wait(1000);
		expect(report).not.toHaveBeenCalled();
		tap(clock, target, 40);
		expect(report).toHaveBeenCalledTimes(1);
		const summary = report.mock.calls[0][0];
		expect(summary.presses).toBe(3);
		expect(summary.firstMs).toEqual([40, 120, 120]);
		expect(summary.worstGapMs).toEqual([16, 90, 90]);
		expect(summary.slow).toBe(0);
	});

	it('counts a press whose worst frame went over 100 ms as slow', () => {
		const target = document.createElement('div');
		const report = jest.fn();
		const clock = rig();
		watchArrowResponse(target, report, 2);
		tap(clock, target, 30, 160);
		clock.wait(1000);
		tap(clock, target, 30);
		expect(report.mock.calls[0][0].slow).toBe(1);
		expect(report.mock.calls[0][0].worstGapMs[2]).toBe(160);
	});

	it('counts a stall that outlasts the window, which is the worst of all', () => {
		const target = document.createElement('div');
		const report = jest.fn();
		const clock = rig();
		watchArrowResponse(target, report, 1);
		clock.down(target);
		clock.up(target);
		// a frame at 40 ms, then the page freezes for 700 ms
		clock.frame(40, 700);
		clock.smooth(100);
		expect(report.mock.calls[0][0].worstGapMs[2]).toBe(700);
		expect(report.mock.calls[0][0].slow).toBe(1);
	});

	it('says how old the stamp on a key was when the page got it, apart from how fast the page answered', () => {
		const target = document.createElement('div');
		const report = jest.fn();
		const clock = rig();
		watchArrowResponse(target, report, 1);
		clock.wait(5000);
		clock.down(target, 40, {waited: 300});
		clock.up(target);
		clock.frame(16);
		clock.smooth(700);
		expect(report.mock.calls[0][0].firstMs[2]).toBe(16);
		expect(report.mock.calls[0][0].inputAgeMs[2]).toBe(300);
	});

	it('counts quick taps as presses of their own, each from its own key down', () => {
		const target = document.createElement('div');
		const report = jest.fn();
		const clock = rig();
		watchArrowResponse(target, report, 2);
		clock.down(target);
		clock.up(target);
		clock.frame(40);
		// the second tap comes 300 ms into the first one's window
		clock.frame(260);
		clock.down(target);
		clock.up(target);
		clock.frame(30);
		clock.smooth(900);
		expect(report).toHaveBeenCalledTimes(1);
		expect(report.mock.calls[0][0].presses).toBe(2);
		expect(report.mock.calls[0][0].firstMs[2]).toBe(40);
	});

	it('leaves out keys that are not arrows, a flagged repeat, and a key that has not come up since its last key down', () => {
		const target = document.createElement('div');
		const report = jest.fn();
		const clock = rig();
		watchArrowResponse(target, report, 1);
		clock.down(target, 13);
		clock.up(target, 13);
		clock.smooth(700);
		clock.wait(1000);
		clock.down(target, 40, {repeat: true});
		clock.smooth(700);
		clock.up(target, 40);
		clock.wait(1000);
		expect(report).not.toHaveBeenCalled();
		// Tizen never flags a repeat: the second key down of a hold looks like the first
		clock.down(target, 40);
		clock.smooth(700);
		clock.wait(300);
		clock.down(target, 40);
		clock.smooth(700);
		expect(report).toHaveBeenCalledTimes(1);
		expect(report.mock.calls[0][0].presses).toBe(1);
	});

	it('still tells a held key from a press while another arrow is tapped', () => {
		const target = document.createElement('div');
		const report = jest.fn();
		const clock = rig();
		watchArrowResponse(target, report, 1);
		clock.down(target, 40);
		clock.smooth(100);
		clock.down(target, 39);
		clock.up(target, 39);
		clock.smooth(100);
		// Down repeats while it is still down: not a press
		clock.down(target, 40);
		clock.smooth(900);
		const presses = report.mock.calls.map((call) => call[0].presses);
		// the first Down and the Right tap, and nothing for the repeat
		expect(presses).toEqual([1, 1]);
	});

	it('counts a tap after a key up that never came', () => {
		const target = document.createElement('div');
		const report = jest.fn();
		const clock = rig();
		watchArrowResponse(target, report, 1);
		// no key up, so the key looks held
		clock.down(target);
		clock.smooth(700);
		expect(report).toHaveBeenCalledTimes(1);
		clock.wait(5000);
		clock.down(target);
		clock.smooth(700);
		expect(report).toHaveBeenCalledTimes(2);
	});

	it('throws away a press that a hidden page answered hours late, and keeps counting after', () => {
		const target = document.createElement('div');
		const report = jest.fn();
		const clock = rig();
		watchArrowResponse(target, report, 1);
		clock.down(target);
		clock.up(target);
		document.dispatchEvent(new Event('visibilitychange'));
		clock.frame(3600000, 16);
		clock.smooth(700);
		expect(report).not.toHaveBeenCalled();
		clock.wait(1000);
		tap(clock, target, 30);
		expect(report).toHaveBeenCalledTimes(1);
		expect(report.mock.calls[0][0].firstMs).toEqual([30, 30, 30]);
	});

	it('throws away a standby that sent no event, and keeps a freeze of seconds, which is what a lag report is for', () => {
		const target = document.createElement('div');
		const report = jest.fn();
		const clock = rig();
		watchArrowResponse(target, report, 1);
		tap(clock, target, 3600000);
		expect(report).not.toHaveBeenCalled();
		clock.wait(1000);
		tap(clock, target, 8000);
		expect(report.mock.calls[0][0].firstMs[2]).toBe(8000);
	});

	it('keeps up and down apart from left and right, each in its own batch, and adds what the context says', () => {
		const target = document.createElement('div');
		const report = jest.fn();
		const clock = rig();
		watchArrowResponse(target, report, 2, () => ({smooth: true, perf: 'auto'}));
		const tapKey = (keyCode) => {
			clock.down(target, keyCode);
			clock.up(target, keyCode);
			clock.smooth(700);
			clock.wait(300);
		};
		tapKey(40);
		tapKey(39);
		expect(report).not.toHaveBeenCalled();
		tapKey(38);
		expect(report).toHaveBeenCalledTimes(1);
		expect(report.mock.calls[0][0]).toMatchObject({axis: 'up/down', presses: 2, smooth: true, perf: 'auto'});
		tapKey(37);
		expect(report.mock.calls[1][0]).toMatchObject({axis: 'left/right', presses: 2});
	});

	const tapDownWith = (clock, target) => {
		clock.down(target, 40);
		clock.up(target, 40);
		clock.smooth(700);
		clock.wait(300);
	};

	it('lets go a few presses taken under settings that then changed, and reports a batch under the ones it was taken with', () => {
		const target = document.createElement('div');
		const report = jest.fn();
		const clock = rig();
		let smooth = true;
		watchArrowResponse(target, report, 3, () => ({smooth}));
		// two taken with it on are no sample, and are let go when it is turned off
		tapDownWith(clock, target);
		tapDownWith(clock, target);
		smooth = false;
		tapDownWith(clock, target);
		expect(report).not.toHaveBeenCalled();
		tapDownWith(clock, target);
		tapDownWith(clock, target);
		expect(report).toHaveBeenCalledTimes(1);
		expect(report.mock.calls[0][0]).toMatchObject({presses: 3, smooth: false});
		expect(report.mock.calls[0][0].partial).toBeUndefined();
	});

	it('reports five presses or more as they were when the settings change, marked as cut short', () => {
		const target = document.createElement('div');
		const report = jest.fn();
		const clock = rig();
		let smooth = false;
		watchArrowResponse(target, report, 10, () => ({smooth}));
		[1, 2, 3, 4, 5].forEach(() => tapDownWith(clock, target));
		smooth = true;
		tapDownWith(clock, target);
		expect(report).toHaveBeenCalledTimes(1);
		expect(report.mock.calls[0][0]).toMatchObject({presses: 5, smooth: false, partial: true});
	});

	it('reports a batch of a few presses as it is when the app is left, and none that is too short to say anything', () => {
		const target = document.createElement('div');
		const report = jest.fn();
		const clock = rig();
		watchArrowResponse(target, report, 10);
		const tapDown = () => {
			clock.down(target, 40);
			clock.up(target, 40);
			clock.smooth(700);
			clock.wait(300);
		};
		[1, 2, 3, 4].forEach(tapDown);
		Object.defineProperty(document, 'hidden', {value: true, configurable: true});
		document.dispatchEvent(new Event('visibilitychange'));
		expect(report).not.toHaveBeenCalled();
		Object.defineProperty(document, 'hidden', {value: false, configurable: true});
		tapDown();
		Object.defineProperty(document, 'hidden', {value: true, configurable: true});
		document.dispatchEvent(new Event('visibilitychange'));
		Object.defineProperty(document, 'hidden', {value: false, configurable: true});
		expect(report).toHaveBeenCalledTimes(1);
		expect(report.mock.calls[0][0].presses).toBe(5);
		expect(report.mock.calls[0][0].partial).toBe(true);
	});

	it('starts a new batch even when the report threw', () => {
		const target = document.createElement('div');
		const report = jest.fn(() => { throw new Error('logger'); });
		const clock = rig();
		watchArrowResponse(target, report, 1);
		expect(() => tap(clock, target, 30)).toThrow('logger');
		clock.wait(1000);
		report.mockImplementation(() => {});
		tap(clock, target, 50);
		expect(report.mock.calls[1][0].presses).toBe(1);
		expect(report.mock.calls[1][0].firstMs).toEqual([50, 50, 50]);
	});
});
