import {sharePending} from './sharePending';

const deferred = () => {
	let resolve, reject;
	const promise = new Promise((ok, fail) => {
		resolve = ok;
		reject = fail;
	});
	return {promise, resolve, reject};
};

test('a call for the same key while the first is pending gets the same answer', async () => {
	const answer = deferred();
	const run = jest.fn(() => answer.promise);
	const shared = sharePending((key) => key, run);
	const first = shared('a');
	const second = shared('a');
	expect(second).toBe(first);
	answer.resolve(1);
	expect(await second).toBe(1);
	expect(run).toHaveBeenCalledTimes(1);
});

test('other keys go out on their own', () => {
	const run = jest.fn(() => deferred().promise);
	const shared = sharePending((key) => key, run);
	shared('a');
	shared('b');
	expect(run).toHaveBeenCalledTimes(2);
});

test('once settled, the next call runs again, after a failure too', async () => {
	const failure = deferred();
	const run = jest.fn().mockReturnValueOnce(failure.promise).mockReturnValueOnce(Promise.resolve(2));
	const shared = sharePending((key) => key, run);
	const first = shared('a');
	failure.reject(new Error('down'));
	await expect(first).rejects.toThrow('down');
	expect(await shared('a')).toBe(2);
	expect(run).toHaveBeenCalledTimes(2);
});
