import {hasArt, prefetchArt} from './artPrefetch';

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
