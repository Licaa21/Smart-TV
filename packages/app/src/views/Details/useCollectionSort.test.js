import {act, renderHook} from '@testing-library/react';

import {DEFAULT_SORT, SORT_ALPHABETICAL, SORT_CUSTOM} from './nouveau/nouveauCollectionSort';
import useCollectionSort from './useCollectionSort';

jest.mock('@enact/i18n/$L', () => ({__esModule: true, default: (str) => str}));

const items = [
	{Id: 'c', Name: 'Carol'},
	{Id: 'a', Name: 'Alpha'},
	{Id: 'b', Name: 'Bravo'}
];
const ids = (list) => list.map((i) => i.Id);
const optionIds = (options) => options.map((o) => o.id);

const open = async (api, collectionId = 'box') => {
	const view = renderHook(() => useCollectionSort(api, collectionId, items));
	await act(() => Promise.resolve());
	return view;
};

describe('useCollectionSort', () => {
	it('keeps the server order until another is chosen, and choosing closes the picker', async () => {
		const {result} = await open(null);
		expect(result.current.sortOption).toBe(DEFAULT_SORT);
		expect(ids(result.current.sorted)).toEqual(['c', 'a', 'b']);

		act(() => result.current.openSort());
		act(() => result.current.chooseSort(SORT_ALPHABETICAL));
		expect(result.current.sortOption).toBe(SORT_ALPHABETICAL);
		expect(ids(result.current.sorted)).toEqual(['a', 'b', 'c']);
		expect(result.current.sortOpen).toBe(false);
	});

	it('opens and closes the picker', async () => {
		const {result} = await open(null);
		expect(result.current.sortOpen).toBe(false);
		act(() => result.current.openSort());
		expect(result.current.sortOpen).toBe(true);
		act(() => result.current.closeSort());
		expect(result.current.sortOpen).toBe(false);
	});

	it('asks for nothing and offers no custom order without the plugin or a collection', async () => {
		const {result} = await open(null);
		expect(optionIds(result.current.sortOptions)).not.toContain(SORT_CUSTOM);

		const api = {getCollectionOrder: jest.fn()};
		await open(api, null);
		expect(api.getCollectionOrder).not.toHaveBeenCalled();
	});

	it('opens on an order somebody saved and offers it as custom', async () => {
		const api = {getCollectionOrder: jest.fn(() => Promise.resolve(['b', 'c', 'a']))};
		const {result} = await open(api);
		expect(api.getCollectionOrder).toHaveBeenCalledWith('box');
		expect(result.current.sortOption).toBe(SORT_CUSTOM);
		expect(ids(result.current.sorted)).toEqual(['b', 'c', 'a']);
		expect(optionIds(result.current.sortOptions)).toContain(SORT_CUSTOM);
	});

	it('stays on the server order when nothing was saved', async () => {
		const api = {getCollectionOrder: jest.fn(() => Promise.resolve([]))};
		const {result} = await open(api);
		expect(result.current.sortOption).toBe(DEFAULT_SORT);
		expect(optionIds(result.current.sortOptions)).not.toContain(SORT_CUSTOM);
	});
});
