import {renderHook, act} from '@testing-library/react';

import {memoryCache, clearMemoryCache} from './browseCache';
import useSeerrRows from './useSeerrRows';
import {fetchSeerrHomeRow} from '../../utils/seerrHomeRows';

jest.mock('../../utils/seerrHomeRows', () => ({
	getSeerrHomeRowConfigs: () => [{id: 'trending', title: 'Trending Now', type: 'media', cardType: 'portrait'}],
	fetchSeerrHomeRow: jest.fn(),
	SEERR_SECTION_TO_CONFIG: {seerr_trending: 'trending'}
}));

// The fetches answer on promises, so a few of them are let go by
const settle = () => act(async () => {
	await Promise.resolve();
	await Promise.resolve();
});

const props = {owner: 'tok:u1', seerrEnabled: true, seerrAuthenticated: true, seerrUserId: 7, homeRows: [{id: 'seerr_trending', enabled: true}]};

describe('useSeerrRows when the home screen is returned to', () => {
	beforeEach(() => {
		clearMemoryCache();
		fetchSeerrHomeRow.mockReset();
		fetchSeerrHomeRow.mockResolvedValue([{Id: 'a'}]);
	});

	it('fetches the rows and keeps them for a return', async () => {
		const {result} = renderHook(() => useSeerrRows(props));
		await settle();
		expect(result.current.rows).toHaveLength(1);
		expect(memoryCache.seerrRows.rows).toBe(result.current.rows);
	});

	it('takes the kept rows on a return and does not fetch again', async () => {
		const view = renderHook(() => useSeerrRows(props));
		await settle();
		const kept = view.result.current.rows;
		fetchSeerrHomeRow.mockClear();

		const {result} = renderHook(() => useSeerrRows({...props, reuse: true}));
		await settle();
		expect(result.current.rows).toBe(kept);
		expect(fetchSeerrHomeRow).not.toHaveBeenCalled();
	});

	it('fetches again for a visit of its own', async () => {
		const view = renderHook(() => useSeerrRows(props));
		await settle();
		view.unmount();
		fetchSeerrHomeRow.mockClear();

		renderHook(() => useSeerrRows(props));
		await settle();
		expect(fetchSeerrHomeRow).toHaveBeenCalled();
	});

	it('fetches again after a request or a watchlist change, which alter what the cards say', async () => {
		const view = renderHook(() => useSeerrRows(props));
		await settle();
		view.unmount();
		fetchSeerrHomeRow.mockClear();
		window.dispatchEvent(new window.CustomEvent('moonfin:seerrChanged'));

		renderHook(() => useSeerrRows({...props, reuse: true}));
		await settle();
		expect(fetchSeerrHomeRow).toHaveBeenCalled();
	});

	it('fetches again when what the rows are built from has changed', async () => {
		const view = renderHook(() => useSeerrRows(props));
		await settle();
		view.unmount();
		fetchSeerrHomeRow.mockClear();

		renderHook(() => useSeerrRows({...props, seerrUserId: 8, reuse: true}));
		await settle();
		expect(fetchSeerrHomeRow).toHaveBeenCalled();
	});
});
