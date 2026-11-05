import {fetchWithTimeout} from '../utils/fetchTimeout';
import {moonfinPing} from './seerrApi';

jest.mock('../utils/fetchTimeout', () => ({fetchWithTimeout: jest.fn()}));
jest.mock('../platform', () => ({isWebOS: () => false, isLegacyTizen: () => false}));
jest.mock('./jellyfinApi', () => ({createApiForServer: jest.fn(), getUserId: () => null}));
jest.mock('./moonbaseEndpoint', () => ({
	moonbaseEndpoint: async (base, token) => ({base, headers: {Authorization: `MediaBrowser Token="${token}"`}}),
	isSiloLogin: () => false
}));

const answer = () => Promise.resolve({
	status: 200,
	text: () => Promise.resolve('{"installed":true}'),
	headers: {forEach: () => {}}
});

beforeEach(() => fetchWithTimeout.mockImplementation(answer));

test('pings sent while one is still on its way share it', async () => {
	const [first, second] = await Promise.all([moonfinPing('http://server', 'token'), moonfinPing('http://server', 'token')]);
	expect(fetchWithTimeout).toHaveBeenCalledTimes(1);
	expect(second).toBe(first);
});

test('a ping after the last one answered goes out again', async () => {
	await moonfinPing('http://server', 'token');
	await moonfinPing('http://server', 'token');
	expect(fetchWithTimeout).toHaveBeenCalledTimes(2);
});

test('another server or token is its own ping', async () => {
	await Promise.all([moonfinPing('http://server', 'token'), moonfinPing('http://other', 'token')]);
	expect(fetchWithTimeout).toHaveBeenCalledTimes(2);
});

// The setup wizard offers to install Moonbase on a server that answers its ping with a 404, and reads that from the status.
test('a server with no Moonbase rejects its ping with the 404 it answered', async () => {
	fetchWithTimeout.mockImplementation(() => Promise.resolve({status: 404, text: () => Promise.resolve(''), headers: {forEach: () => {}}}));
	await expect(moonfinPing('http://nomoonbase', 'token')).rejects.toMatchObject({status: 404});
});

test('a ping that never got an answer carries no status', async () => {
	fetchWithTimeout.mockImplementation(() => Promise.reject(new Error('Network error')));
	const failure = await moonfinPing('http://down', 'token').catch((err) => err);
	expect(failure.status).toBeUndefined();
});
