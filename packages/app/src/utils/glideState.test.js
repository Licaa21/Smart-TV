import {noteSlide, setSmoothScrolling, slideUnderway, smoothScrollingOn} from './glideState';

describe('what the glide and the slide share', () => {
	let now;

	beforeEach(() => {
		now = 1000;
		jest.spyOn(Date, 'now').mockImplementation(() => now);
	});
	afterEach(() => {
		jest.restoreAllMocks();
		setSmoothScrolling(true);
	});

	it('keeps the Smooth Scrolling switch, on unless it was told off', () => {
		expect(smoothScrollingOn()).toBe(true);
		setSmoothScrolling(false);
		expect(smoothScrollingOn()).toBe(false);
		setSmoothScrolling(undefined);
		expect(smoothScrollingOn()).toBe(true);
	});

	it('says a slide is under way until the time it was noted for', () => {
		now = 100000;
		expect(slideUnderway()).toBe(false);
		noteSlide(200);
		expect(slideUnderway()).toBe(true);
		now += 199;
		expect(slideUnderway()).toBe(true);
		now += 2;
		expect(slideUnderway()).toBe(false);
	});

	it('is carried further by a longer slide noted after, and never cut short by a shorter one', () => {
		now = 200000;
		noteSlide(300);
		noteSlide(100);
		now += 250;
		expect(slideUnderway()).toBe(true);
		noteSlide(400);
		now += 350;
		expect(slideUnderway()).toBe(true);
		now += 100;
		expect(slideUnderway()).toBe(false);
	});
});
