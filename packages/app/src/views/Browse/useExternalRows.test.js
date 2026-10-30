import {renderHook, waitFor} from '@testing-library/react';

import useExternalRows from './useExternalRows';
import {memoryCache, resetEmptySections} from './browseCache';
import {fetchExternalPresetRow} from '../../utils/externalHomeRows';

jest.mock('@enact/i18n/$L', () => ({__esModule: true, default: (str) => str}));
jest.mock('../../services/storage', () => ({
	getFromStorage: async () => null,
	saveToStorage: async () => {},
	removeFromStorage: async () => {}
}));
jest.mock('../../utils/externalHomeRows', () => ({
	getExternalHomeRowConfigs: () => [{id: 'tmdb_popular_movies', title: 'Popular Movies'}],
	fetchExternalPresetRow: jest.fn(),
	fetchCustomHomeRow: jest.fn(),
	fetchCalendarRows: jest.fn(),
	buildSeasonalRow: jest.fn()
}));
jest.mock('../../services/externalRowsApi', () => ({fetchSeasonalRow: jest.fn()}));
jest.mock('../../services/jellyfinApi', () => ({resolveItemsByProviderIds: async (items) => items}));
jest.mock('../../utils/deviceCountry', () => ({resolveDeviceCountry: async () => 'US'}));
// The rows are asked for in the language the server is set to, which needs the server
jest.mock('../../utils/metadataLanguage', () => ({currentMetadataLanguage: async () => null}));

const settings = {useMoonfinPlugin: true};
const homeRows = [{id: 'tmdb_popular_movies', enabled: true}];

const load = async () => {
	const {result} = renderHook(() => useExternalRows({settings, homeRows, kidsMode: false}));
	expect(result.current.pending.map((row) => row.id)).toEqual(['tmdb_popular_movies']);
	await waitFor(() => expect(result.current.pending).toEqual([]));
};

beforeEach(() => {
	resetEmptySections();
	jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('empty external rows', () => {
	test('a row that came back empty holds no place on the next load', async () => {
		fetchExternalPresetRow.mockResolvedValue([]);
		await load();
		expect(memoryCache.emptySections.has('tmdb_popular_movies')).toBe(true);
	});

	test("a failed load isn't taken for an empty row", async () => {
		fetchExternalPresetRow.mockRejectedValue(new Error('offline'));
		await load();
		expect(memoryCache.emptySections.has('tmdb_popular_movies')).toBe(false);
	});
});
