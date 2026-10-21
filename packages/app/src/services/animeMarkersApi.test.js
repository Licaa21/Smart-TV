jest.mock('./storage', () => ({getFromStorage: jest.fn(), saveToStorage: jest.fn()}));
jest.mock('./jellyfinApi', () => ({getAuthHeader: () => 'auth', getServerUrl: () => 'http://a'}));
jest.mock('../utils/requestQueue', () => ({mediaServerQueue: {run: (task) => task()}}));

const DAY_MS = 24 * 60 * 60 * 1000;

const answer = {enabled: true, episodes: {'ep-1': {kind: 'filler'}}, seasons: {}};

// Each launch starts with a fresh module and whatever the TV kept from the last one.
const launch = (kept, reply = answer) => {
	jest.resetModules();
	const storage = require('./storage');
	storage.getFromStorage.mockResolvedValue(kept);
	storage.saveToStorage.mockResolvedValue(true);
	const request = jest.fn(() => Promise.resolve({ok: true, json: () => Promise.resolve(reply)}));
	global.fetch = request;
	return {api: require('./animeMarkersApi'), storage, request};
};

const flush = async () => {
	for (let i = 0; i < 10; i++) await Promise.resolve();
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('a series asked for on one launch is answered from storage on the next', async () => {
	const first = launch(null);
	const markers = await first.api.fetchSeriesMarkers('s1');
	expect(markers.episodes.ep1.kind).toBe('filler');
	jest.advanceTimersByTime(3000);
	await flush();
	const [key, kept] = first.storage.saveToStorage.mock.calls[0];
	expect(key).toBe('anime_markers_series');
	expect(Object.keys(kept)).toEqual(['http://a|s1']);

	const next = launch(kept);
	expect(await next.api.fetchSeriesMarkers('s1')).toEqual(markers);
	expect(next.request).not.toHaveBeenCalled();
});

test('a day old entry or one from another server is asked for again', async () => {
	const old = launch({'http://a|s1': {fetchedAt: Date.now() - DAY_MS, data: {episodes: {}, seasons: {}}}});
	await old.api.fetchSeriesMarkers('s1');
	expect(old.request).toHaveBeenCalledTimes(1);

	const other = launch({'http://b|s1': {fetchedAt: Date.now(), data: {episodes: {}, seasons: {}}}});
	await other.api.fetchSeriesMarkers('s1');
	expect(other.request).toHaveBeenCalledTimes(1);
});

test('a row of series cards asks once when the feature is off', async () => {
	const off = launch(null, {enabled: false, episodes: {}, seasons: {}});
	const results = await Promise.all(['s1', 's2', 's3'].map((id) => off.api.fetchSeriesMarkers(id)));
	expect(results).toEqual([null, null, null]);
	expect(off.request).toHaveBeenCalledTimes(1);
});
