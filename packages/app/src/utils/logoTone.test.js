import {toneOfPixels} from './logoTone';

const pixels = (...rgba) => Uint8ClampedArray.from(rgba.flat());

describe('toneOfPixels', () => {
	it('calls a white logo pale', () => {
		expect(toneOfPixels(pixels([255, 255, 255, 255], [250, 250, 250, 255], [0, 0, 0, 0]))).toBe(true);
	});

	it('does not call a dark logo pale', () => {
		expect(toneOfPixels(pixels([10, 10, 10, 255], [0, 0, 0, 255], [0, 0, 0, 0]))).toBe(false);
	});

	it('does not call a colored logo pale', () => {
		expect(toneOfPixels(pixels([229, 9, 20, 255], [229, 9, 20, 255]))).toBe(false);
		expect(toneOfPixels(pixels([28, 231, 131, 255]))).toBe(false);
	});

	it('leaves the see-through parts out', () => {
		expect(toneOfPixels(pixels([255, 255, 255, 255], [0, 0, 0, 20], [0, 0, 0, 20], [0, 0, 0, 20]))).toBe(true);
	});

	it('does not call an empty picture pale', () => {
		expect(toneOfPixels(pixels([255, 255, 255, 0]))).toBe(false);
	});
});
