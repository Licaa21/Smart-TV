jest.mock('@enact/i18n/$L', () => ({__esModule: true, default: (str) => str}));

import {
	resolveSubtitleStyleSettings,
	subtitleStyleKey,
	getSubtitleTextStyle,
	getSubtitleColorOptions,
	getSubtitleShadowColorOptions,
	getSubtitleBackgroundColorOptions,
	getSubtitleCanvasStyle,
	getPgsBackgroundStyle,
	getPgsPictureStyle,
	canvasRestingPercent,
	canvasLiftFor,
	CANVAS_DESCRIPTION_GAP,
	SUBTITLE_STYLE_KEYS
} from './subtitleConstants';

const settings = {
	subtitleHdrSeparate: false,
	subtitleSize: 'medium',
	subtitleColor: '#ffffff',
	subtitleBackground: 0,
	subtitleBackgroundColor: '#000000',
	subtitleShadowColor: '#000000',
	subtitleShadowOpacity: 100,
	subtitleShadowBlur: 0.1,
	subtitleOpacity: 100,
	subtitlePosition: 'bottom',
	subtitlePositionAbsolute: 90,
	subtitleSizeHdr: 'large',
	subtitleColorHdr: '#808080',
	subtitleBackgroundHdr: 40,
	subtitleBackgroundColorHdr: '#404040',
	subtitleShadowColorHdr: '#404040',
	subtitleShadowOpacityHdr: 50,
	subtitleShadowBlurHdr: 0.5,
	subtitleOpacityHdr: 80,
	subtitlePositionHdr: 'lower',
	subtitlePositionAbsoluteHdr: 70
};

describe('resolveSubtitleStyleSettings', () => {
	it('returns the settings untouched for SDR', () => {
		expect(resolveSubtitleStyleSettings({...settings, subtitleHdrSeparate: true}, false)).toEqual(
			{...settings, subtitleHdrSeparate: true}
		);
	});

	it('returns the settings untouched for HDR while the separate style is off', () => {
		expect(resolveSubtitleStyleSettings(settings, true).subtitleColor).toBe('#ffffff');
	});

	it('overlays every HDR twin once the separate style is on', () => {
		const resolved = resolveSubtitleStyleSettings({...settings, subtitleHdrSeparate: true}, true);

		for (const key of SUBTITLE_STYLE_KEYS) {
			expect(resolved[key]).toEqual(settings[`${key}Hdr`]);
		}
	});

	it('leaves a base value in place when its HDR twin is unset', () => {
		const partial = {subtitleHdrSeparate: true, subtitleColor: '#ffffff', subtitleSize: 'medium', subtitleSizeHdr: 'large'};
		const resolved = resolveSubtitleStyleSettings(partial, true);

		expect(resolved.subtitleColor).toBe('#ffffff');
		expect(resolved.subtitleSize).toBe('large');
	});

	it('does not mutate the settings it was given', () => {
		const input = {...settings, subtitleHdrSeparate: true};
		resolveSubtitleStyleSettings(input, true);

		expect(input.subtitleColor).toBe('#ffffff');
	});

	it('survives missing settings', () => {
		expect(resolveSubtitleStyleSettings(undefined, true)).toBeUndefined();
	});
});

describe('subtitleStyleKey', () => {
	it('writes to the HDR twin only while HDR styling is active', () => {
		expect(subtitleStyleKey('subtitleColor', true)).toBe('subtitleColorHdr');
		expect(subtitleStyleKey('subtitleColor', false)).toBe('subtitleColor');
	});
});

describe('getSubtitleTextStyle through the resolver', () => {
	it('renders the HDR colour for HDR and the SDR colour otherwise', () => {
		const on = {...settings, subtitleHdrSeparate: true};

		expect(getSubtitleTextStyle(resolveSubtitleStyleSettings(on, true)).color).toBe('#808080');
		expect(getSubtitleTextStyle(resolveSubtitleStyleSettings(on, false)).color).toBe('#ffffff');
	});

	it('renders the HDR size for HDR', () => {
		const on = {...settings, subtitleHdrSeparate: true};

		expect(getSubtitleTextStyle(resolveSubtitleStyleSettings(on, true)).fontSize).toBe('52px');
	});
});

describe('the subtitle palette', () => {
	it('offers all fifteen colors for the stroke and the background', () => {
		expect(getSubtitleShadowColorOptions()).toHaveLength(15);
		expect(getSubtitleBackgroundColorOptions()).toHaveLength(15);
	});

	it('leaves Transparent out of the text fill, which would hide the text', () => {
		const fill = getSubtitleColorOptions();
		expect(fill).toHaveLength(14);
		expect(fill.some((option) => option.value === '#00000000')).toBe(false);
	});
});

describe('getSubtitleTextStyle ligatures', () => {
	it('turns them off, so the i after an f keeps its dot', () => {
		const style = getSubtitleTextStyle({});
		expect(style.fontVariantLigatures).toBe('none');
		expect(style.fontFeatureSettings).toContain('"liga" 0');
	});
});

describe('getSubtitleTextStyle colors', () => {
	it('keeps an opaque color as hex', () => {
		expect(getSubtitleTextStyle(settings).color).toBe('#ffffff');
	});

	it('applies the opacity slider as rgba, which older engines can read', () => {
		expect(getSubtitleTextStyle({...settings, subtitleBackground: 50}).backgroundColor).toBe('rgba(0, 0, 0, 0.5)');
	});

	it('carries a see-through color\'s own alpha under the slider', () => {
		const style = getSubtitleTextStyle({...settings, subtitleBackgroundColor: '#ffffff80', subtitleBackground: 100, subtitleColor: '#00000080'});
		expect(style.backgroundColor).toBe('rgba(255, 255, 255, 0.502)');
		expect(style.color).toBe('rgba(0, 0, 0, 0.502)');
	});

	it('draws Transparent as nothing at all', () => {
		expect(getSubtitleTextStyle({...settings, subtitleBackgroundColor: '#00000000', subtitleBackground: 100}).backgroundColor).toBe('rgba(0, 0, 0, 0)');
	});
});

describe('the canvas PGS and ASS subtitles are drawn on', () => {
	it('goes up with the controls and the description, for ASS as well as PGS', () => {
		expect(getSubtitleCanvasStyle({}, 120, false).transform).toBe('translateY(-120px)');
		expect(getSubtitleCanvasStyle({}, 0, true).transform).toBe('translateY(0px)');
		// An ASS track takes nothing else, whatever the picture settings say
		const ass = getSubtitleCanvasStyle({pgsSubtitleSize: 'large'}, 0, false);
		expect(ass.transform).toBe('translateY(0px)');
	});

	it('gives a picture subtitle its size, position, opacity and brightness', () => {
		const style = getSubtitleCanvasStyle(
			{pgsSubtitleSize: 'large', pgsSubtitlePosition: 'middle', pgsSubtitleOpacity: 60, pgsSubtitleBrightness: 70},
			100, true, 1000
		);
		// 100 for the controls and 20% of a 1000 pixel screen for the position
		expect(style.transform).toBe('translateY(-300px) scale(1.2)');
		expect(style.transformOrigin).toBe('50% 100%');
		const picture = getPgsPictureStyle({pgsSubtitleOpacity: 60, pgsSubtitleBrightness: 70});
		expect(picture.opacity).toBe(0.6);
		expect(picture.filter).toBe('brightness(70%)');
	});

	it('draws a picture subtitle as it is when nothing is changed, with no filter over the screen', () => {
		const style = getSubtitleCanvasStyle({pgsSubtitleSize: 'medium', pgsSubtitlePosition: 'bottom'}, 0, true);
		expect(style.transform).toBe('translateY(0px)');
		expect(getPgsPictureStyle({pgsSubtitleOpacity: 100, pgsSubtitleBrightness: 100})).toEqual({});
	});

	it('goes a little further up for the description than the lift, and not at all further for the controls', () => {
		expect(canvasLiftFor(100, true)).toBe(100 + CANVAS_DESCRIPTION_GAP);
		expect(canvasLiftFor(100, false)).toBe(100);
		// Nothing in the way, nothing to clear
		expect(canvasLiftFor(0, true)).toBe(0);
	});

	it('draws a box behind a picture subtitle only when it has some opacity and the picture is on screen', () => {
		const area = {left: 0.25, top: 0.8, width: 0.5, height: 0.1};
		expect(getPgsBackgroundStyle({pgsSubtitleBackground: 0, pgsSubtitleBackgroundColor: '#000000'}, area)).toBeNull();
		expect(getPgsBackgroundStyle({pgsSubtitleBackground: 60, pgsSubtitleBackgroundColor: '#000000'}, null)).toBeNull();
		const box = getPgsBackgroundStyle({pgsSubtitleBackground: 50, pgsSubtitleBackgroundColor: '#ff0000'}, area);
		expect(box.background).toBe('rgba(255, 0, 0, 0.5)');
		// the picture's own area with a margin around it, kept inside the screen
		expect(box.left).toBe('24%');
		expect(box.top).toBe('78.6%');
		expect(box.width).toBe('52%');
		const edge = getPgsBackgroundStyle({pgsSubtitleBackground: 100, pgsSubtitleBackgroundColor: '#000000'}, {left: 0, top: 0.95, width: 1, height: 0.05});
		expect(edge.left).toBe('0%');
		expect(parseFloat(edge.top) + parseFloat(edge.height)).toBeCloseTo(100);
	});

	it('measures the lift for a picture subtitle from where its position puts it', () => {
		expect(canvasRestingPercent({pgsSubtitlePosition: 'higher'}, true)).toBe(36);
		expect(canvasRestingPercent({pgsSubtitlePosition: 'higher'}, false)).toBe(6);
	});
});
