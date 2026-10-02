jest.mock('../services/externalRowsApi', () => ({
	fetchCustomRow: jest.fn(),
	constructSourceUrl: jest.fn()
}));

import {fetchCustomRow, constructSourceUrl} from '../services/externalRowsApi';
import {validateCustomRow} from './externalHomeRows';

const listUrl = 'https://mdblist.com/lists/user/list';
const row = {source: 'mdblist', type: 'user_list', params: {username: 'user', listname: 'list'}};

describe('validateCustomRow', () => {
	beforeEach(() => {
		constructSourceUrl.mockReturnValue(listUrl);
	});

	it('waits longer than a home row and reads the server cache', async () => {
		fetchCustomRow.mockResolvedValue([{name: 'Movie'}]);

		expect(await validateCustomRow(row)).toEqual({ok: true});
		expect(fetchCustomRow).toHaveBeenCalledWith(row, {timeoutMs: 45000});
	});

	it('names the list when it comes back empty', async () => {
		fetchCustomRow.mockResolvedValue([]);

		expect(await validateCustomRow(row)).toEqual({error: expect.stringContaining(listUrl)});
	});
});
