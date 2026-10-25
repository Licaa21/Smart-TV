import {renderHook, act} from '@testing-library/react';

import useSubtitleFetch from './useSubtitleFetch';

const deferred = () => {
	let resolve;
	const promise = new Promise((done) => { resolve = done; });
	return {promise, resolve};
};

describe('useSubtitleFetch', () => {
	it('stays loading until the fetch lands', async () => {
		const {result} = renderHook(() => useSubtitleFetch());
		const request = deferred();

		act(() => { result.current.track(request.promise); });
		expect(result.current.loading).toBe(true);

		await act(async () => { request.resolve(null); });
		expect(result.current.loading).toBe(false);
	});

	it("doesn't let an older fetch end a newer one", async () => {
		const {result} = renderHook(() => useSubtitleFetch());
		const older = deferred();
		const newer = deferred();

		act(() => {
			result.current.track(older.promise);
			result.current.track(newer.promise);
		});
		await act(async () => { older.resolve(null); });
		expect(result.current.loading).toBe(true);

		await act(async () => { newer.resolve(null); });
		expect(result.current.loading).toBe(false);
	});

	it('stops loading when cleared, whatever the fetch does later', async () => {
		const {result} = renderHook(() => useSubtitleFetch());
		const request = deferred();

		act(() => { result.current.track(request.promise); });
		act(() => { result.current.clear(); });
		expect(result.current.loading).toBe(false);

		act(() => { result.current.track(deferred().promise); });
		await act(async () => { request.resolve(null); });
		expect(result.current.loading).toBe(true);
	});
});
