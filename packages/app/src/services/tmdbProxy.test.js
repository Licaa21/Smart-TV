import {__resetTmdbProxy, tmdbAvailable, tmdbGet} from './tmdbProxy';

let mockServer = 'http://server';
jest.mock('./jellyfinApi', () => ({getServerUrl: () => mockServer, getAuthHeader: () => 'MediaBrowser Token="t"'}));
jest.mock('../utils/requestQueue', () => ({mediaServerQueue: {run: (fn) => fn()}}));

const answer = (status, body) => ({ok: status >= 200 && status < 300, status, json: async () => (body === undefined ? Promise.reject(new Error('no body')) : body)});

describe('tmdbGet through the plugin', () => {
	beforeEach(() => {
		mockServer = 'http://server';
		__resetTmdbProxy();
		global.fetch = jest.fn(async () => answer(200, {id: 1}));
	});
	afterEach(() => {
		delete global.fetch;
	});

	const urlOfCall = (n = 0) => global.fetch.mock.calls[n][0];

	it('asks the plugin\'s Details route for a title, and its Season and Recommendations routes for the rest', async () => {
		await tmdbGet('/tv/1396', 'ro');
		await tmdbGet('/movie/603', 'ro');
		await tmdbGet('/tv/1396/season/2', 'ro');
		await tmdbGet('/tv/1396/recommendations', 'ro');
		expect(urlOfCall(0)).toBe('http://server/Moonfin/Tmdb/Details?mediaType=tv&tmdbId=1396&language=ro');
		expect(urlOfCall(1)).toBe('http://server/Moonfin/Tmdb/Details?mediaType=movie&tmdbId=603&language=ro');
		expect(urlOfCall(2)).toBe('http://server/Moonfin/Tmdb/Season?tmdbId=1396&seasonNumber=2&language=ro');
		expect(urlOfCall(3)).toBe('http://server/Moonfin/Tmdb/Recommendations?mediaType=tv&tmdbId=1396&language=ro');
		expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe('MediaBrowser Token="t"');
	});

	it('asks in English when no language is given, and sends no key of any kind', async () => {
		await tmdbGet('/tv/5', '');
		expect(urlOfCall()).toContain('language=en-US');
		expect(urlOfCall()).not.toMatch(/api_key|Bearer/i);
	});

	it('throws for a path the plugin has no route for', async () => {
		await expect(tmdbGet('/person/5', 'ro')).rejects.toThrow('No plugin route');
		expect(global.fetch).not.toHaveBeenCalled();
	});

	it('stops asking for five minutes once the plugin has no key or no routes', async () => {
		global.fetch = jest.fn(async () => answer(503, {error: 'No key'}));
		await expect(tmdbGet('/tv/1', 'ro')).rejects.toThrow('503');
		await expect(tmdbGet('/tv/2', 'ro')).rejects.toThrow('no TMDB routes');
		expect(global.fetch).toHaveBeenCalledTimes(1);

		__resetTmdbProxy();
		global.fetch = jest.fn(async () => answer(404, undefined));
		await expect(tmdbGet('/tv/1', 'ro')).rejects.toThrow('404');
		await expect(tmdbGet('/tv/2', 'ro')).rejects.toThrow('no TMDB routes');
		expect(global.fetch).toHaveBeenCalledTimes(1);
	});

	it('asks again after five minutes when the plugin cannot help', async () => {
		jest.useFakeTimers();
		try {
			global.fetch = jest.fn(async () => answer(503, {error: 'No key'}));
			await expect(tmdbGet('/tv/1', 'ro')).rejects.toThrow('503');
			jest.advanceTimersByTime(4 * 60 * 1000);
			expect(tmdbAvailable()).toBe(false);
			jest.advanceTimersByTime(2 * 60 * 1000);
			expect(tmdbAvailable()).toBe(true);
		} finally {
			jest.useRealTimers();
		}
	});

	it('does not let a slow answer from before undo a note made since', async () => {
		let release;
		global.fetch = jest.fn()
			.mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve(answer(200, {id: 1})); }))
			.mockImplementationOnce(async () => answer(503, {error: 'No key'}));
		const slow = tmdbGet('/tv/1', 'ro');
		await expect(tmdbGet('/tv/2', 'ro')).rejects.toThrow('503');
		expect(tmdbAvailable()).toBe(false);
		release();
		await slow;
		expect(tmdbAvailable()).toBe(false);
	});

	it('does not note a timeout or a lost connection, and the note is for one server only', async () => {
		global.fetch = jest.fn(async () => { throw new Error('timed out'); });
		await expect(tmdbGet('/tv/1', 'ro')).rejects.toThrow('timed out');
		expect(tmdbAvailable()).toBe(true);

		global.fetch = jest.fn(async () => answer(503, {error: 'No key'}));
		await expect(tmdbGet('/tv/1', 'ro')).rejects.toThrow('503');
		expect(tmdbAvailable()).toBe(false);
		mockServer = 'http://another';
		expect(tmdbAvailable()).toBe(true);
	});

	it('notes a refusal and a missing route, but not what is about one title', async () => {
		for (const [status, body, noted] of [[401, undefined, true], [403, {error: 'no'}, true], [404, undefined, true], [404, {error: 'TMDB does not know this id'}, false], [502, {error: 'TMDB failed'}, false], [500, undefined, false], [400, {title: 'Bad', status: 400}, false]]) {
			__resetTmdbProxy();
			global.fetch = jest.fn(async () => answer(status, body));
			await expect(tmdbGet('/tv/1', 'ro')).rejects.toThrow(String(status));
			expect(tmdbAvailable()).toBe(!noted);
		}
	});

	it('sends the language the way TMDB takes it', async () => {
		for (const [given, sent] of [['ro', 'ro'], ['ro-RO', 'ro-RO'], ['pt_BR', 'pt-BR'], ['zh-Hans-CN', 'zh-CN'], ['EN-us', 'en-US'], ['', 'en-US']]) {
			global.fetch.mockClear();
			await tmdbGet('/tv/5', given);
			expect(urlOfCall()).toContain(`language=${sent}`);
		}
	});

	it('keeps asking when TMDB just does not know one title', async () => {
		global.fetch = jest.fn(async () => answer(404, {error: 'TMDB does not know this id'}));
		await expect(tmdbGet('/tv/1', 'ro')).rejects.toThrow('404');
		await expect(tmdbGet('/tv/2', 'ro')).rejects.toThrow('404');
		expect(global.fetch).toHaveBeenCalledTimes(2);
	});

	it('answers with the plugin\'s JSON, and an answer that is not an object is an error', async () => {
		global.fetch = jest.fn(async () => answer(200, {name: 'Breaking Bad'}));
		await expect(tmdbGet('/tv/1396', 'ro')).resolves.toEqual({name: 'Breaking Bad'});
		global.fetch = jest.fn(async () => answer(200, 'nope'));
		await expect(tmdbGet('/tv/1396', 'ro')).rejects.toThrow('no usable answer');
		global.fetch = jest.fn(async () => answer(200, {success: false, error: 'No key'}));
		await expect(tmdbGet('/tv/1396', 'ro')).rejects.toThrow('no usable answer');
	});
});
