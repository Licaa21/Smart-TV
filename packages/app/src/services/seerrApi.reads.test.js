import {fetchWithTimeout} from '../utils/fetchTimeout';
import {getUser, requestTv, setMoonfinConfig} from './seerrApi';

jest.mock('../utils/fetchTimeout', () => ({fetchWithTimeout: jest.fn()}));
jest.mock('../platform', () => ({isWebOS: () => false, isLegacyWebOS: () => false, isLegacyTizen: () => false}));
jest.mock('./jellyfinApi', () => ({createApiForServer: jest.fn(), getUserId: () => null}));
jest.mock('./siloSession', () => ({loadSiloSessions: () => Promise.resolve()}));
jest.mock('./moonbaseEndpoint', () => ({moonbaseEndpoint: jest.fn(), isSiloLogin: () => false}));
jest.mock('./siloSeerr', () => ({createSiloSeerr: () => ({request: async () => []})}));

const reply = (status, body) => fetchWithTimeout.mockResolvedValue({
	status, text: () => Promise.resolve(JSON.stringify(body)), headers: {forEach: () => {}}
});

beforeEach(() => {
	fetchWithTimeout.mockReset();
	setMoonfinConfig('https://jf.example', 'token');
});

describe('Seerr reads asked for together', () => {
	test('send one request and answer every caller', async () => {
		reply(200, {id: 7});
		const [a, b, c] = await Promise.all([getUser(), getUser(), getUser()]);
		expect(fetchWithTimeout).toHaveBeenCalledTimes(1);
		expect([a, b, c]).toEqual([{id: 7}, {id: 7}, {id: 7}]);
	});

	test('give each caller its own copy, so one that changes it does not change it for the others', async () => {
		reply(200, {results: [1, 2, 3]});
		const [a, b] = await Promise.all([getUser(), getUser()]);
		a.results.length = 0;
		expect(b.results).toEqual([1, 2, 3]);
	});

	test('are asked for again once the first has landed', async () => {
		reply(200, {id: 7});
		await getUser();
		await getUser();
		expect(fetchWithTimeout).toHaveBeenCalledTimes(2);
	});

	test('share a failure while it is out, and are not held to it afterwards', async () => {
		reply(500, {message: 'down'});
		const results = await Promise.allSettled([getUser(), getUser()]);
		expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected']);
		expect(fetchWithTimeout).toHaveBeenCalledTimes(1);
		reply(200, {id: 1});
		await expect(getUser()).resolves.toEqual({id: 1});
	});

	test('never hold back a change', async () => {
		reply(200, {id: 1});
		await Promise.all([requestTv(42, {seasons: 'all'}), requestTv(42, {seasons: 'all'})]);
		expect(fetchWithTimeout).toHaveBeenCalledTimes(2);
	});
});
