// Whether a studio or network logo has to be drawn white to be read on the grey tile it sits on. A logo that is white
// already, or colored brightly enough to stand out from the tile, keeps its own colors. A dark one, black or navy, is
// drawn white.
//
// The tile is about this bright, as relative luminance. A logo is read when it is at least this much brighter than the
// tile, by the contrast formula of the web accessibility guidelines.
const TILE_LUMINANCE = 0.027;
const MIN_CONTRAST = 2.4;

const linear = (byte) => {
	const value = byte / 255;
	return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
};

/**
 * Tells whether a logo has to be drawn white, from its RGBA pixels. Pixels that are mostly see-through count for
 * little, and a picture with nothing in it is left alone.
 * @param {Uint8ClampedArray|number[]} data - RGBA bytes
 * @returns {boolean}
 */
export const logoNeedsWhite = (data) => {
	let total = 0;
	let weight = 0;
	for (let i = 0; i + 3 < data.length; i += 4) {
		const alpha = data[i + 3] / 255;
		if (alpha < 0.4) continue;
		total += (0.2126 * linear(data[i]) + 0.7152 * linear(data[i + 1]) + 0.0722 * linear(data[i + 2])) * alpha;
		weight += alpha;
	}
	if (weight === 0) return false;
	const contrast = (total / weight + 0.05) / (TILE_LUMINANCE + 0.05);
	return contrast < MIN_CONTRAST;
};
