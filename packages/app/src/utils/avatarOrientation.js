// A phone photo is stored sideways with a flag (EXIF Orientation, 1 to 8) that says how to turn it. Browsers from Chromium 81 on
// turn it as they draw it, and the Chromium 76 of a 2021 Samsung does not, so a profile picture taken on a phone shows rotated.

// The flag of a JPEG, read from its first bytes, or 1 (as stored) when there is none.
export const exifOrientation = (bytes) => {
	if (!bytes || bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return 1;
	let at = 2;
	while (at + 4 <= bytes.length) {
		if (bytes[at] !== 0xff) return 1;
		const marker = bytes[at + 1];
		const length = (bytes[at + 2] << 8) | bytes[at + 3];
		// EXIF lives in the APP1 block, after "Exif\0\0"
		if (marker === 0xe1 && bytes[at + 4] === 0x45 && bytes[at + 5] === 0x78 && bytes[at + 6] === 0x69 && bytes[at + 7] === 0x66) {
			const tiff = at + 10;
			const little = bytes[tiff] === 0x49;
			const u16 = (o) => (o + 2 > bytes.length ? -1 : (little ? bytes[o] | (bytes[o + 1] << 8) : (bytes[o] << 8) | bytes[o + 1]));
			const u32 = (o) => (o + 4 > bytes.length ? -1 : (little
				? (bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16)) + bytes[o + 3] * 16777216
				: bytes[o] * 16777216 + ((bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3])));
			const first = u32(tiff + 4);
			if (first < 0) return 1;
			const entries = u16(tiff + first);
			for (let i = 0; i < entries; i++) {
				const entry = tiff + first + 2 + i * 12;
				if (u16(entry) === 0x0112) {
					const value = u16(entry + 8);
					return value >= 1 && value <= 8 ? value : 1;
				}
			}
			return 1;
		}
		// Start of scan: the picture itself, past every block that could hold the flag
		if (marker === 0xda) return 1;
		at += 2 + length;
	}
	return 1;
};

// The canvas transform [a, b, c, d, e, f] that draws a stored picture of width x height the right way up, and the size it has
// once turned.
export const orientationMatrix = (orientation, width, height) => {
	switch (orientation) {
		case 2: return {matrix: [-1, 0, 0, 1, width, 0], width, height};
		case 3: return {matrix: [-1, 0, 0, -1, width, height], width, height};
		case 4: return {matrix: [1, 0, 0, -1, 0, height], width, height};
		case 5: return {matrix: [0, 1, 1, 0, 0, 0], width: height, height: width};
		case 6: return {matrix: [0, 1, -1, 0, height, 0], width: height, height: width};
		case 7: return {matrix: [0, -1, -1, 0, height, width], width: height, height: width};
		case 8: return {matrix: [0, -1, 1, 0, 0, width], width: height, height: width};
		default: return {matrix: [1, 0, 0, 1, 0, 0], width, height};
	}
};

// Whether a picture is worth drawing again: it is turned by a flag, or it is a JPEG big enough that the screen would do better with a
// small copy. A PNG is left alone, since drawing it as a JPEG would fill its transparent corners with black.
export const SMALL_PICTURE_BYTES = 150 * 1024;
export const needsRedraw = (orientation, type, bytes) => (
	orientation !== 1 || (/^image\/jpe?g$/i.test(type || '') && bytes > SMALL_PICTURE_BYTES)
);
