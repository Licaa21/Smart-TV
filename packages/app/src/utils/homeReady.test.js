beforeEach(() => {
	jest.useFakeTimers();
	jest.resetModules();
});

afterEach(() => jest.useRealTimers());

const flush = async () => {
	for (let i = 0; i < 10; i++) await Promise.resolve();
};

const track = (promise) => {
	const state = {done: false};
	promise.then(() => {
		state.done = true;
	});
	return state;
};

test('waits for Home to show and then a moment more', async () => {
	const {afterHomeReady, markHomeReady} = require('./homeReady');
	const waiting = track(afterHomeReady());
	jest.advanceTimersByTime(5000);
	await flush();
	expect(waiting.done).toBe(false);
	markHomeReady();
	await flush();
	jest.advanceTimersByTime(2000);
	await flush();
	expect(waiting.done).toBe(true);
});

test('goes ahead on its own when Home never shows', async () => {
	const {afterHomeReady} = require('./homeReady');
	const waiting = track(afterHomeReady());
	jest.advanceTimersByTime(10000);
	await flush();
	jest.advanceTimersByTime(2000);
	await flush();
	expect(waiting.done).toBe(true);
});

test('a call after Home showed only waits the moment', async () => {
	const {afterHomeReady, markHomeReady} = require('./homeReady');
	markHomeReady();
	const waiting = track(afterHomeReady());
	await flush();
	jest.advanceTimersByTime(1999);
	await flush();
	expect(waiting.done).toBe(false);
	jest.advanceTimersByTime(1);
	await flush();
	expect(waiting.done).toBe(true);
});

test('once start-up is over a later call goes straight through', async () => {
	const {afterHomeReady, markHomeReady} = require('./homeReady');
	markHomeReady();
	afterHomeReady();
	await flush();
	jest.advanceTimersByTime(2000);
	await flush();
	const later = track(afterHomeReady());
	await flush();
	expect(later.done).toBe(true);
});
