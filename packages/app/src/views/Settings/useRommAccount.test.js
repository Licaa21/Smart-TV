import {act, renderHook} from '@testing-library/react';

import {getRommAccount, startRommLink, unlinkRomm} from '../../services/gamesApi';
import useRommAccount from './useRommAccount';

jest.mock('../../services/gamesApi', () => ({
	getRommAccount: jest.fn(),
	startRommLink: jest.fn(),
	unlinkRomm: jest.fn()
}));

const PENDING = {available: true, linked: false, pending: {userCode: 'ABCD1234', intervalSeconds: 5}};
const LINKED = {available: true, linked: true, username: 'test', pending: null};

const elapse = (ms) => act(async () => {
	await jest.advanceTimersByTimeAsync(ms);
});

beforeEach(() => {
	jest.useFakeTimers();
	jest.clearAllMocks();
});

afterEach(() => jest.useRealTimers());

test('reads the link again on RomM\'s interval until it is approved, then stops', async () => {
	getRommAccount.mockResolvedValueOnce({available: true, linked: false, pending: null});
	startRommLink.mockResolvedValueOnce(PENDING);
	const {result} = renderHook(() => useRommAccount({serverUrl: 'https://server', accessToken: 't'}));
	await elapse(0);

	await act(() => result.current.link());
	expect(result.current.pending.userCode).toBe('ABCD1234');

	getRommAccount.mockResolvedValueOnce(PENDING).mockResolvedValueOnce(LINKED);
	await elapse(5000);
	expect(result.current.linked).toBe(false);
	await elapse(5000);
	expect(result.current.linked).toBe(true);
	expect(result.current.username).toBe('test');

	const reads = getRommAccount.mock.calls.length;
	await elapse(20000);
	expect(getRommAccount).toHaveBeenCalledTimes(reads);
});

test('a failed request says so and keeps what was shown', async () => {
	getRommAccount.mockResolvedValueOnce(LINKED);
	unlinkRomm.mockRejectedValueOnce(new Error('network'));
	const {result} = renderHook(() => useRommAccount({serverUrl: 'https://server', accessToken: 't'}));
	await elapse(0);

	await act(() => result.current.unlink());

	expect(result.current.failed).toBe(true);
	expect(result.current.linked).toBe(true);
});

test('stays hidden while signed out', async () => {
	const {result} = renderHook(() => useRommAccount({serverUrl: null, accessToken: null}));
	await elapse(0);

	expect(getRommAccount).not.toHaveBeenCalled();
	expect(result.current.available).toBe(false);
});
