import {renderHook, act} from '@testing-library/react';
import useBookProgress from './useBookProgress';

const mockApi = {setPlaybackPosition: jest.fn(), setWatched: jest.fn()};

jest.mock('../services/connectionPool', () => ({getApiForItem: () => null}));
jest.mock('../services/jellyfinApi', () => ({
	get api () {
		return mockApi;
	}
}));

const item = {Id: 'book1'};

beforeEach(() => {
	jest.useFakeTimers();
	mockApi.setPlaybackPosition.mockReset().mockResolvedValue();
	mockApi.setWatched.mockReset().mockResolvedValue();
});
afterEach(() => jest.useRealTimers());

test('opening a book saves nothing', () => {
	const {unmount} = renderHook(() => useBookProgress(item, 3, 12));
	act(() => jest.advanceTimersByTime(5000));
	unmount();
	expect(mockApi.setPlaybackPosition).not.toHaveBeenCalled();
});

test('the page is saved once the reader settles on it', () => {
	const {rerender} = renderHook(({page}) => useBookProgress(item, page, 12), {initialProps: {page: 3}});
	rerender({page: 4});
	rerender({page: 5});
	act(() => jest.advanceTimersByTime(1000));
	expect(mockApi.setPlaybackPosition).not.toHaveBeenCalled();
	act(() => jest.advanceTimersByTime(1000));
	expect(mockApi.setPlaybackPosition).toHaveBeenCalledTimes(1);
	expect(mockApi.setPlaybackPosition).toHaveBeenCalledWith('book1', 50000);
});

test('closing the reader saves a page it had not saved yet', () => {
	const {rerender, unmount} = renderHook(({page}) => useBookProgress(item, page, 12), {initialProps: {page: 0}});
	rerender({page: 2});
	unmount();
	expect(mockApi.setPlaybackPosition).toHaveBeenCalledWith('book1', 20000);
});

test('the last page marks the book read', async () => {
	const {rerender} = renderHook(({page}) => useBookProgress(item, page, 12), {initialProps: {page: 10}});
	rerender({page: 11});
	await act(async () => {
		jest.advanceTimersByTime(2000);
		await Promise.resolve();
	});
	expect(mockApi.setPlaybackPosition).toHaveBeenCalledWith('book1', 110000);
	expect(mockApi.setWatched).toHaveBeenCalledWith('book1', true);
});
