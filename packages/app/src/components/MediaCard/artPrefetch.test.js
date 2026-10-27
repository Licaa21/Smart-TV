import {hasArt, artSource, artState, touchArt, decodeArt, prefetchArt, noteArtFocus, noteArtArrived, noteArtDecoded, setArtLogSink} from './artPrefetch';

describe('prefetchArt', () => {
	const RealImage = window.Image;
	let started;
	let handles;
	// the scheduler is shared, so what a test leaves under way is dropped before the next
	const ask = (...args) => {
		const request = prefetchArt(...args);
		handles.push(request);
		return request;
	};

	beforeEach(() => {
		started = [];
		handles = [];
		window.Image = function FakeImage () {
			const art = {};
			started.push(art);
			return art;
		};
	});
	afterEach(() => {
		handles.forEach((request) => request.cancel());
		window.Image = RealImage;
	});

	const urls = () => started.map((art) => art.src);

	it('runs four at a time, nearest first, and starts the next when one finishes', () => {
		const requests = [9, 7, 5, 3, 1, 8, 2].map((rank) => ask(`http://art/p${rank}`, rank));
		// the first four asked for start as they come, the rest wait for a place
		expect(urls()).toEqual(['http://art/p9', 'http://art/p7', 'http://art/p5', 'http://art/p3']);

		started[1].onload();
		expect(urls()[4]).toBe('http://art/p1');
		started[0].onload();
		expect(urls()[5]).toBe('http://art/p2');
		started[2].onload();
		expect(urls()[6]).toBe('http://art/p8');
		expect(requests).toHaveLength(7);
	});

	it('moves the rank of a request that is still waiting', () => {
		['a', 'b', 'c', 'd'].forEach((name) => ask(`http://art/${name}`, 1));
		const far = ask('http://art/far', 50);
		ask('http://art/near', 20);
		far.setRank(0);
		started[0].onload();
		expect(urls()[4]).toBe('http://art/far');
	});

	it('drops a request that is waiting, and one that is under way, and gives the place on', () => {
		const first = ask('http://art/first', 1);
		['b', 'c', 'd'].forEach((name) => ask(`http://art/${name}`, 2));
		const waiting = ask('http://art/waiting', 3);
		ask('http://art/after', 4);

		waiting.cancel();
		first.cancel();
		expect(started[0].src).toBe('');
		expect(urls()).toContain('http://art/after');
		expect(urls()).not.toContain('http://art/waiting');
	});

	it('remembers art that came in, and tells of art that did not', () => {
		const failed = jest.fn();
		ask('http://art/ok', 1);
		ask('http://art/missing', 2, failed);
		started[0].onload();
		started[1].onerror();
		expect(hasArt('http://art/ok')).toBe(true);
		expect(hasArt('http://art/missing')).toBe(false);
		expect(failed).toHaveBeenCalledTimes(1);
	});

	it('does not tell of a request that was dropped', () => {
		const failed = jest.fn();
		const request = ask('http://art/dropped', 1, failed);
		const art = started[0];
		request.cancel();
		expect(art.onerror).toBeNull();
		expect(failed).not.toHaveBeenCalled();
	});
});

describe('prefetchArt reading the art as a blob', () => {
	const realFetch = window.fetch;
	const RealImage = window.Image;
	const realCreate = URL.createObjectURL;
	const realRevoke = URL.revokeObjectURL;
	let handles;
	let pending;
	let plainLoads;
	let nextBlob;

	const ask = (...args) => {
		const request = prefetchArt(...args);
		handles.push(request);
		return request;
	};
	// A fetch that answers when the test says so
	const answer = (index, body) => pending[index].resolve(body);
	const flush = () => Promise.resolve().then(() => Promise.resolve()).then(() => Promise.resolve());

	beforeEach(() => {
		handles = [];
		pending = [];
		plainLoads = [];
		nextBlob = 0;
		window.fetch = jest.fn((url, options) => new Promise((resolve, reject) => {
			const entry = {url, options, resolve, reject};
			pending.push(entry);
			if (options.signal) options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), {name: 'AbortError'})));
		}));
		window.Image = function FakeImage () {
			const art = {};
			plainLoads.push(art);
			return art;
		};
		URL.createObjectURL = jest.fn(() => `blob:art/${nextBlob++}`);
		URL.revokeObjectURL = jest.fn();
	});
	afterEach(() => {
		handles.forEach((request) => request.cancel());
		window.fetch = realFetch;
		window.Image = RealImage;
		URL.createObjectURL = realCreate;
		URL.revokeObjectURL = realRevoke;
		setArtLogSink(null);
		jest.useRealTimers();
	});

	const ok = (size = 1000) => ({ok: true, status: 200, blob: () => Promise.resolve({size})});

	it('holds what came in and hands the card a local address, which is nothing until then', async () => {
		const url = 'http://server/Moonfin/Tmdb/Thumb?tmdbId=1&ApiKey=secret';
		const done = jest.fn();
		ask(url, 0, null, done);
		expect(window.fetch).toHaveBeenCalledWith(url, expect.objectContaining({credentials: 'omit'}));
		expect(artSource(url)).toBeNull();
		expect(artState(url)).toBe('running');

		answer(0, ok());
		await flush();
		expect(artSource(url)).toMatch(/^blob:art\//);
		expect(hasArt(url)).toBe(true);
		expect(artState(url)).toBe('held');
		expect(done).toHaveBeenCalledTimes(1);
	});

	it('tells of a 404 and sends the card to the network for it', async () => {
		const url = 'http://server/Moonfin/Tmdb/Thumb?tmdbId=2';
		const failed = jest.fn();
		ask(url, 0, failed);
		answer(0, {ok: false, status: 404});
		await flush();
		expect(failed).toHaveBeenCalledWith(404);
		expect(artSource(url)).toBe(url);
		expect(hasArt(url)).toBe(false);
	});

	it('loads an address that may not be read the plain way instead', async () => {
		const url = 'http://other/art-3.jpg';
		ask(url, 0);
		pending[0].reject(new TypeError('Failed to fetch'));
		await flush();
		expect(plainLoads).toHaveLength(1);
		expect(plainLoads[0].src).toBe(url);
		plainLoads[0].onload();
		expect(hasArt(url)).toBe(true);
		expect(artSource(url)).toBe(url);
	});

	it('lets a request go that does not answer in time, and the card asks the network itself', async () => {
		jest.useFakeTimers();
		const url = 'http://server/art-4.jpg';
		const failed = jest.fn();
		ask(url, 0, failed);
		jest.advanceTimersByTime(15000);
		await flush();
		expect(failed).toHaveBeenCalledWith(-1);
		expect(artSource(url)).toBe(url);
		expect(artState(url)).toBe('none');
	});

	it('drops a request that is under way', async () => {
		const url = 'http://server/art-5.jpg';
		const failed = jest.fn();
		const request = ask(url, 0, failed);
		request.cancel();
		await flush();
		expect(failed).not.toHaveBeenCalled();
		expect(artState(url)).toBe('none');
		expect(artSource(url)).toBeNull();
	});

	it('tells the report what the focused card found, without the address', () => {
		const lines = [];
		setArtLogSink((message, context) => lines.push([message, context]));
		const url = 'http://server/Moonfin/Tmdb/Thumb?tmdbId=99&ApiKey=secret';
		expect(noteArtFocus(url)).toBe(false);
		expect(lines[0][0]).toBe('Wide art not ready at focus');
		expect(lines[0][1]).toEqual(expect.objectContaining({kind: 'thumb', state: 'none'}));
		expect(JSON.stringify(lines)).not.toContain('secret');
		noteArtArrived(url, 420);
		expect(lines[1]).toEqual(['Wide art arrived late', {kind: 'thumb', ms: 420}]);
	});

	it('loads every picture of a host the plain way once a few could not be read, and a lone failure only that picture', async () => {
		ask('http://nocors.test/one.jpg', 0);
		pending[0].reject(new TypeError('Failed to fetch'));
		await flush();
		expect(plainLoads).toHaveLength(1);
		// the host is still read as a blob after one failure
		ask('http://nocors.test/two.jpg', 0);
		expect(window.fetch).toHaveBeenCalledTimes(2);
		pending[1].reject(new TypeError('Failed to fetch'));
		await flush();
		ask('http://nocors.test/three.jpg', 0);
		pending[2].reject(new TypeError('Failed to fetch'));
		await flush();
		ask('http://nocors.test/four.jpg', 0);
		expect(window.fetch).toHaveBeenCalledTimes(3);
		expect(plainLoads).toHaveLength(4);
		expect(artSource('http://nocors.test/five.jpg')).toBe('http://nocors.test/five.jpg');
	});

	it('lets a picture that is loaded the plain way and does not answer go too', async () => {
		jest.useFakeTimers();
		const url = 'http://slow.test/plain.jpg';
		ask(url, 0);
		answer(0, {ok: false, status: 502});
		await flush();
		const failed = jest.fn();
		ask(url, 0, failed);
		expect(plainLoads).toHaveLength(1);
		jest.advanceTimersByTime(15000);
		expect(failed).toHaveBeenCalledWith(-1);
	});

	it('keeps the picture the focused card draws when too much is held', async () => {
		jest.useFakeTimers();
		const urls = ['http://keep.test/a.jpg', 'http://keep.test/b.jpg', 'http://keep.test/c.jpg'];
		ask(urls[0], 0);
		answer(0, ok(12 * 1024 * 1024));
		await flush();
		touchArt(urls[0]);
		ask(urls[1], 1);
		ask(urls[2], 2);
		answer(1, ok(12 * 1024 * 1024));
		answer(2, ok(12 * 1024 * 1024));
		await flush();
		await flush();
		expect(artSource(urls[0])).toMatch(/^blob:art\//);
		expect(artSource(urls[1])).toBeNull();
	});

	it('decodes the held pictures it is told to ahead, with the held address', async () => {
		const decodes = [];
		window.Image = function FakeImage () {
			const art = {decode: jest.fn(() => Promise.resolve())};
			decodes.push(art);
			return art;
		};
		const url = 'http://server/decode-me.jpg';
		decodeArt(url);
		expect(decodes).toHaveLength(0);
		ask(url, 0);
		answer(0, ok());
		await flush();
		decodeArt(url);
		expect(decodes).toHaveLength(1);
		expect(decodes[0].src).toBe(artSource(url));
		expect(decodes[0].decode).toHaveBeenCalled();
		decodeArt(url);
		expect(decodes).toHaveLength(1);
	});

	it('tells the report how long the TV took to decode, per kind', () => {
		const lines = [];
		setArtLogSink((message, context) => lines.push([message, context]));
		// enough focuses for a summary whatever the counters stood at
		for (let i = 0; i < 50; i++) {
			const url = `http://server/Items/x${i}/Images/Backdrop`;
			noteArtFocus(url);
			noteArtDecoded(url, 100 + i);
		}
		const summaryLine = lines.filter(([message]) => message === 'Wide art summary').pop();
		expect(summaryLine[1].library).toEqual(expect.objectContaining({late: expect.any(Number), plain: expect.any(Number)}));
		expect(summaryLine[1].library.decoded).toBeGreaterThan(0);
		expect(summaryLine[1].library.decodeMaxMs).toBeGreaterThanOrEqual(100);
		expect(summaryLine[1].library.decodeAvgMs).toBeGreaterThanOrEqual(100);
	});

	it('gives the oldest picture up, and takes its address back a while later, once too much is held', async () => {
		jest.useFakeTimers();
		const sizes = [12, 12, 12].map((mb) => mb * 1024 * 1024);
		const urls = ['http://server/big-a.jpg', 'http://server/big-b.jpg', 'http://server/big-c.jpg'];
		urls.forEach((url, i) => {
			ask(url, i);
		});
		sizes.forEach((size, i) => answer(i, ok(size)));
		await flush();
		await flush();
		expect(artSource(urls[2])).toMatch(/^blob:art\//);
		expect(artSource(urls[0])).toBe(null);
		// a card still loading from it is not cut off at once
		expect(URL.revokeObjectURL).not.toHaveBeenCalled();
		jest.advanceTimersByTime(10000);
		expect(URL.revokeObjectURL).toHaveBeenCalled();
	});
});

describe('prefetchArt sharing a request', () => {
	const RealImage = window.Image;
	let started;
	let handles;
	beforeEach(() => {
		started = [];
		handles = [];
		window.Image = function FakeImage () {
			const art = {};
			started.push(art);
			return art;
		};
	});
	afterEach(() => {
		handles.forEach((request) => request.cancel());
		window.Image = RealImage;
	});
	const ask = (...args) => {
		const request = prefetchArt(...args);
		handles.push(request);
		return request;
	};

	it('makes one request for a picture two cards ask for, and drops it when the last asker lets go', () => {
		const first = ask('http://art/shared.jpg', 5);
		const second = ask('http://art/shared.jpg', 1);
		expect(started).toHaveLength(1);
		first.cancel();
		expect(started[0].src).toBe('http://art/shared.jpg');
		second.cancel();
		expect(started[0].src).toBe('');
	});

	it('goes at the nearest rank of those asking', () => {
		['a', 'b', 'c', 'd'].forEach((name) => ask(`http://art/busy-${name}.jpg`, 1));
		ask('http://art/other.jpg', 9);
		const shared = ask('http://art/wanted.jpg', 20);
		ask('http://art/wanted.jpg', 2);
		shared.setRank(30);
		started[0].onload();
		expect(started[4].src).toBe('http://art/wanted.jpg');
	});
});
