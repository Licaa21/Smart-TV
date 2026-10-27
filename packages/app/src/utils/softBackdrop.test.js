import {canSoften, softBackdropUrl, softWidth} from './softBackdrop';

describe('softBackdropUrl', () => {
	const realFetch = window.fetch;
	const realBitmap = window.createImageBitmap;
	const realCreate = URL.createObjectURL;
	const realRevoke = URL.revokeObjectURL;
	const realContext = window.HTMLCanvasElement.prototype.getContext;
	const realToBlob = window.HTMLCanvasElement.prototype.toBlob;
	let made;
	let blobs;

	beforeEach(() => {
		made = [];
		blobs = 0;
		window.fetch = jest.fn(() => Promise.resolve({ok: true, blob: () => Promise.resolve({size: 100})}));
		window.createImageBitmap = jest.fn((source, ...rest) => {
			if (!rest.length) return Promise.resolve({width: 1280, height: 720, close: jest.fn()});
			const options = rest[4];
			const bitmap = {width: options.resizeWidth, height: options.resizeHeight, close: jest.fn()};
			made.push(bitmap);
			return Promise.resolve(bitmap);
		});
		URL.createObjectURL = jest.fn(() => `blob:soft/${blobs++}`);
		URL.revokeObjectURL = jest.fn();
		window.HTMLCanvasElement.prototype.getContext = () => ({drawImage: jest.fn()});
		window.HTMLCanvasElement.prototype.toBlob = (done) => done({size: 10});
	});
	afterEach(() => {
		window.fetch = realFetch;
		window.createImageBitmap = realBitmap;
		URL.createObjectURL = realCreate;
		URL.revokeObjectURL = realRevoke;
		window.HTMLCanvasElement.prototype.getContext = realContext;
		window.HTMLCanvasElement.prototype.toBlob = realToBlob;
	});

	it('makes the picture small for the blur asked, keeping its shape, and hands back a local address', async () => {
		const url = await softBackdropUrl('https://image.tmdb.org/t/p/w1280/a.jpg', 20);
		expect(url).toMatch(/^blob:soft\//);
		expect(made[0].width).toBe(softWidth(20));
		expect(made[0].height).toBe(Math.round(softWidth(20) * 720 / 1280));
		expect(window.fetch).toHaveBeenCalledWith('https://image.tmdb.org/t/p/w1280/a.jpg', expect.objectContaining({credentials: 'omit'}));
	});

	it('makes it smaller the more it is to be blurred', () => {
		window.innerWidth = 1920;
		expect(softWidth(10)).toBeGreaterThan(softWidth(20));
		expect(softWidth(20)).toBeGreaterThan(softWidth(40));
	});

	it('makes a picture once however many ask, and keeps it', async () => {
		const [first, second] = await Promise.all([
			softBackdropUrl('https://image.tmdb.org/t/p/w1280/b.jpg', 20),
			softBackdropUrl('https://image.tmdb.org/t/p/w1280/b.jpg', 20)
		]);
		expect(second).toBe(first);
		expect(await softBackdropUrl('https://image.tmdb.org/t/p/w1280/b.jpg', 20)).toBe(first);
		expect(window.fetch).toHaveBeenCalledTimes(1);
	});

	it('does not ask again for a picture it could not make, for a while', async () => {
		window.fetch = jest.fn(() => Promise.resolve({ok: false}));
		expect(await softBackdropUrl('https://image.tmdb.org/t/p/w1280/f.jpg', 20)).toBeNull();
		expect(await softBackdropUrl('https://image.tmdb.org/t/p/w1280/f.jpg', 20)).toBeNull();
		expect(window.fetch).toHaveBeenCalledTimes(1);
	});

	it('gives null when it cannot be made, or when nothing is to be blurred', async () => {
		window.fetch = jest.fn(() => Promise.resolve({ok: false}));
		expect(await softBackdropUrl('https://image.tmdb.org/t/p/w1280/c.jpg', 20)).toBeNull();
		expect(await softBackdropUrl('https://image.tmdb.org/t/p/w1280/d.jpg', 0)).toBeNull();
		expect(await softBackdropUrl('', 20)).toBeNull();
		window.createImageBitmap = undefined;
		expect(canSoften()).toBe(false);
		expect(await softBackdropUrl('https://image.tmdb.org/t/p/w1280/e.jpg', 20)).toBeNull();
	});
});
