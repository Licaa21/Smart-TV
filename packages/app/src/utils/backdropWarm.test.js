import {warmBackdrop, forgetWarmedBackdrops} from './backdropWarm';

const OWN = 'http://server/Items/abc/Images/Backdrop?maxWidth=1280';
const OUTSIDE = 'https://image.tmdb.org/t/p/w1280/a.jpg';

describe('warmBackdrop', () => {
	const RealImage = window.Image;
	let images;

	beforeEach(() => {
		images = [];
		window.Image = function FakeImage () {
			const art = {complete: false};
			images.push(art);
			return art;
		};
		forgetWarmedBackdrops();
	});
	afterEach(() => {
		window.Image = RealImage;
	});

	it('loads the picture the server blurs, the same address the backdrop will ask for', () => {
		warmBackdrop(OWN, 20);
		expect(images).toHaveLength(1);
		expect(images[0].src).toContain('/Items/abc/Images/Backdrop');
		expect(images[0].src).toContain('blur=4');
	});

	it('leaves a picture the server cannot blur alone', () => {
		warmBackdrop(OUTSIDE, 20);
		expect(images).toHaveLength(0);
	});

	it('does nothing without a picture or without a blur to ask for', () => {
		warmBackdrop('', 20);
		warmBackdrop(OWN, 0);
		expect(images).toHaveLength(0);
	});

	it('loads a picture once, however many cards ask for it', () => {
		warmBackdrop(OWN, 20);
		warmBackdrop(OWN, 20);
		expect(images).toHaveLength(1);
	});

	it('stops a picture that is still loading when the card is let go, and keeps one that has come in', () => {
		const stop = warmBackdrop(OWN, 20);
		stop();
		expect(images[0].src).toBe('');
		const stopLoaded = warmBackdrop(OWN, 20);
		expect(images).toHaveLength(2);
		images[1].complete = true;
		stopLoaded();
		expect(images[1].src).not.toBe('');
		warmBackdrop(OWN, 20);
		expect(images).toHaveLength(2);
	});

	it('lets a picture go only when no card wants it any longer', () => {
		const first = warmBackdrop(OWN, 20);
		const second = warmBackdrop(OWN, 20);
		expect(images).toHaveLength(1);
		first();
		expect(images[0].src).not.toBe('');
		second();
		expect(images[0].src).toBe('');
		// a card letting go twice counts once
		const again = warmBackdrop(OWN, 20);
		const other = warmBackdrop(OWN, 20);
		again();
		again();
		expect(images[1].src).not.toBe('');
		other();
		expect(images[1].src).toBe('');
	});

	it('holds only the latest pictures', () => {
		for (let i = 0; i < 40; i++) warmBackdrop(`http://server/Items/i${i}/Images/Backdrop?maxWidth=1280`, 20);
		expect(images).toHaveLength(40);
		warmBackdrop('http://server/Items/i0/Images/Backdrop?maxWidth=1280', 20);
		expect(images).toHaveLength(41);
	});
});
