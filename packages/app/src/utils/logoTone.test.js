import {logoNeedsWhite} from './logoTone';

const pixels = (...rgba) => Uint8ClampedArray.from(rgba.flat());

describe('logoNeedsWhite', () => {
	it('draws a black logo white', () => {
		expect(logoNeedsWhite(pixels([10, 10, 10, 255], [0, 0, 0, 255], [0, 0, 0, 0]))).toBe(true);
	});

	it('draws a navy logo white', () => {
		expect(logoNeedsWhite(pixels([0, 51, 160, 255], [0, 51, 160, 255]))).toBe(true);
	});

	it('keeps a white logo as it is', () => {
		expect(logoNeedsWhite(pixels([255, 255, 255, 255], [250, 250, 250, 255], [0, 0, 0, 0]))).toBe(false);
	});

	it('keeps the colors of a logo that stands out from the tile', () => {
		expect(logoNeedsWhite(pixels([229, 9, 20, 255], [229, 9, 20, 255]))).toBe(false);
		expect(logoNeedsWhite(pixels([28, 231, 131, 255]))).toBe(false);
		expect(logoNeedsWhite(pixels([31, 107, 255, 255]))).toBe(false);
	});

	it('leaves the see-through parts out', () => {
		expect(logoNeedsWhite(pixels([0, 0, 0, 255], [255, 255, 255, 20], [255, 255, 255, 20], [255, 255, 255, 20]))).toBe(true);
	});

	it('leaves a picture with nothing in it alone', () => {
		expect(logoNeedsWhite(pixels([0, 0, 0, 0]))).toBe(false);
	});
});
