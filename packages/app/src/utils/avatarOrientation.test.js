import {exifOrientation, needsRedraw, orientationMatrix} from './avatarOrientation';

// A JPEG head with an EXIF block that holds one Orientation entry. `little` picks the byte order the camera wrote.
const jpegWithOrientation = (value, little = false) => {
	const tiff = [];
	const u16 = (n) => (little ? [n & 255, n >> 8] : [n >> 8, n & 255]);
	const u32 = (n) => (little ? [n & 255, (n >> 8) & 255, 0, 0] : [0, 0, (n >> 8) & 255, n & 255]);
	tiff.push(...(little ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(8), ...u16(1), ...u16(0x0112), ...u16(3), ...u32(1), ...u16(value), 0, 0, ...u32(0));
	const body = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
	const length = body.length + 2;
	return new Uint8Array([0xff, 0xd8, 0xff, 0xe1, length >> 8, length & 255, ...body, 0xff, 0xd9]);
};

describe('exifOrientation', () => {
	test('reads the flag a phone wrote, in either byte order', () => {
		expect(exifOrientation(jpegWithOrientation(6))).toBe(6);
		expect(exifOrientation(jpegWithOrientation(8, true))).toBe(8);
		expect(exifOrientation(jpegWithOrientation(3))).toBe(3);
	});

	test('is 1 for a file with no flag, an EXIF block without one, or no JPEG at all', () => {
		expect(exifOrientation(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))).toBe(1);
		expect(exifOrientation(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(1);
		expect(exifOrientation(new Uint8Array(0))).toBe(1);
		const noEntry = jpegWithOrientation(6);
		noEntry[noEntry.indexOf(0x12)] = 0x13;
		expect(exifOrientation(noEntry)).toBe(1);
	});

	test('is 1 for a value outside 1 to 8, and does not run off a cut file', () => {
		expect(exifOrientation(jpegWithOrientation(9))).toBe(1);
		expect(exifOrientation(jpegWithOrientation(6).slice(0, 14))).toBe(1);
	});
});

// Where the top left corner of a 4 x 2 picture (x to the right, y down) lands after the flag is applied, which is
// the position the EXIF specification gives for each of the eight.
describe('orientationMatrix', () => {
	const apply = ([a, b, c, d, e, f], x, y) => [a * x + c * y + e, b * x + d * y + f];
	const w = 4;
	const h = 2;

	test.each([
		// flag, size after, where the stored top left corner ends up, where the stored top right corner ends up
		[1, [4, 2], [0, 0], [4, 0]],
		[2, [4, 2], [4, 0], [0, 0]],
		[3, [4, 2], [4, 2], [0, 2]],
		[4, [4, 2], [0, 2], [4, 2]],
		[5, [2, 4], [0, 0], [0, 4]],
		[6, [2, 4], [2, 0], [2, 4]],
		[7, [2, 4], [2, 4], [2, 0]],
		[8, [2, 4], [0, 4], [0, 0]]
	])('flag %i', (flag, size, topLeft, topRight) => {
		const {matrix, width, height} = orientationMatrix(flag, w, h);
		expect([width, height]).toEqual(size);
		expect(apply(matrix, 0, 0)).toEqual(topLeft);
		expect(apply(matrix, w, 0)).toEqual(topRight);
		// the whole picture stays inside the box it was given
		[[0, 0], [w, 0], [0, h], [w, h]].forEach(([x, y]) => {
			const [px, py] = apply(matrix, x, y);
			expect(px).toBeGreaterThanOrEqual(0);
			expect(px).toBeLessThanOrEqual(width);
			expect(py).toBeGreaterThanOrEqual(0);
			expect(py).toBeLessThanOrEqual(height);
		});
	});

	test('an unknown flag leaves the picture as it is', () => {
		expect(orientationMatrix(0, w, h)).toEqual({matrix: [1, 0, 0, 1, 0, 0], width: w, height: h});
	});
});

describe('needsRedraw', () => {
	test('a flagged picture is drawn again, whatever its size or type', () => {
		expect(needsRedraw(6, 'image/jpeg', 40000)).toBe(true);
		expect(needsRedraw(3, 'image/jpg', 900000)).toBe(true);
	});

	test('a big JPEG with no flag is drawn small, and a small one is left as it is', () => {
		expect(needsRedraw(1, 'image/jpeg', 5953363)).toBe(true);
		expect(needsRedraw(1, 'image/jpeg', 90000)).toBe(false);
	});

	test('a PNG or a WebP with no flag is never drawn again, so its transparent corners stay transparent', () => {
		expect(needsRedraw(1, 'image/png', 5000000)).toBe(false);
		expect(needsRedraw(1, 'image/webp', 5000000)).toBe(false);
		expect(needsRedraw(1, undefined, 5000000)).toBe(false);
	});
});
