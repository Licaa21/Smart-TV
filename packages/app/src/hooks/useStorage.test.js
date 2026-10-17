import {act, renderHook, waitFor} from '@testing-library/react';
import {useStorage} from './useStorage';
import {getFromStorage, saveToStorage} from '../services/storage';

jest.mock('../services/storage', () => ({getFromStorage: jest.fn(), saveToStorage: jest.fn()}));

describe('useStorage', () => {
	const stored = {a: 'large', b: 'small'};
	beforeEach(() => {
		getFromStorage.mockImplementation((key) => Promise.resolve(key in stored ? stored[key] : null));
	});

	it('reads the stored value and says when it is in', async () => {
		const {result} = renderHook(() => useStorage('a', 'medium'));
		expect(result.current[2]).toBe(false);
		await waitFor(() => expect(result.current[2]).toBe(true));
		expect(result.current[0]).toBe('large');
	});

	it('is not loaded again until the new key has come in, and takes that key\'s value', async () => {
		const {result, rerender} = renderHook(({key}) => useStorage(key, 'medium'), {initialProps: {key: 'a'}});
		await waitFor(() => expect(result.current[2]).toBe(true));
		rerender({key: 'b'});
		expect(result.current[2]).toBe(false);
		await waitFor(() => expect(result.current[2]).toBe(true));
		expect(result.current[0]).toBe('small');
		expect(result.current[2]).toBe(true);
	});

	it('falls to the default for a key with nothing stored', async () => {
		const {result, rerender} = renderHook(({key}) => useStorage(key, 'medium'), {initialProps: {key: 'a'}});
		await waitFor(() => expect(result.current[2]).toBe(true));
		rerender({key: 'none'});
		await waitFor(() => expect(result.current[2]).toBe(true));
		expect(result.current[0]).toBe('medium');
	});

	it('saves under the current key', async () => {
		const {result} = renderHook(() => useStorage('a', 'medium'));
		await waitFor(() => expect(result.current[2]).toBe(true));
		act(() => result.current[1]('extraLarge'));
		expect(saveToStorage).toHaveBeenCalledWith('a', 'extraLarge');
	});
});
