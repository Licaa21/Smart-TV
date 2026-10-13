// A logo averaging brighter than this is mostly white, and is set on a dark tile. The rest, dark and colored
// ones alike, are set on a light tile in their own colors.
const PALE_LUMINANCE = 185;

/**
 * Tells whether a picture is mostly white, from its RGBA pixels. Pixels that are mostly see-through count for nothing.
 * @param {Uint8ClampedArray|number[]} data - RGBA bytes
 * @returns {boolean}
 */
export const toneOfPixels = (data) => {
	let total = 0;
	let weight = 0;
	for (let i = 0; i + 3 < data.length; i += 4) {
		const alpha = data[i + 3] / 255;
		if (alpha < 0.4) continue;
		total += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) * alpha;
		weight += alpha;
	}
	return weight > 0 && total / weight > PALE_LUMINANCE;
};
