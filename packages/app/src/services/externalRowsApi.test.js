import {fetchCustomRow} from './externalRowsApi';
import {fetchWithTimeout} from '../utils/fetchTimeout';

jest.mock('./jellyfinApi', () => ({getAuthHeader: () => 'auth', getServerUrl: () => 'http://server'}));
jest.mock('../utils/fetchTimeout', () => ({fetchWithTimeout: jest.fn()}));
jest.mock('../utils/requestQueue', () => ({mediaServerQueue: {run: (job) => job()}}));

const answer = (items) => ({ok: true, json: async () => ({success: true, items})});

describe('fetchCustomRow language', () => {
	beforeEach(() => {
		fetchWithTimeout.mockReset();
		fetchWithTimeout.mockResolvedValue(answer([{name: 'Titlu'}]));
	});

	it('asks the plugin for the row in the language, when it has one', async () => {
		await fetchCustomRow({source: 'tmdb', type: 'list', params: {id: '1'}}, {language: 'ro'});
		expect(fetchWithTimeout.mock.calls[0][0]).toContain('&language=ro');
	});

	it('keeps one copy per language, so one language does not hand another its titles', async () => {
		await fetchCustomRow({source: 'tmdb', type: 'list', params: {id: '2'}}, {language: 'ro'});
		await fetchCustomRow({source: 'tmdb', type: 'list', params: {id: '2'}}, {language: 'ro'});
		await fetchCustomRow({source: 'tmdb', type: 'list', params: {id: '2'}}, {language: 'fr'});
		expect(fetchWithTimeout).toHaveBeenCalledTimes(2);
	});

	it('sends no language when there is none', async () => {
		await fetchCustomRow({source: 'tmdb', type: 'list', params: {id: '3'}});
		expect(fetchWithTimeout.mock.calls[0][0]).not.toContain('language');
	});
});
