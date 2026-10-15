import $L from '@enact/i18n/$L';

export const SUBTITLE_SIZE_OPTIONS = [
	{ value: 'small', label: $L('Small'), fontSize: 36 },
	{ value: 'medium', label: $L('Medium'), fontSize: 44 },
	{ value: 'large', label: $L('Large'), fontSize: 52 },
	{ value: 'xlarge', label: $L('Extra Large'), fontSize: 60 }
];

// The palette the other clients offer, in their order. The three see-through entries carry their
// own alpha as #rrggbbaa. The text fill leaves out Transparent, which would hide the text.
const subtitlePalette = ({allowTransparent}) => [
	{ value: '#ffffff', label: $L('White') },
	{ value: '#cccccc', label: $L('Light Gray') },
	{ value: '#808080', label: $L('Gray') },
	{ value: '#404040', label: $L('Dark Gray') },
	{ value: '#000000', label: $L('Black') },
	{ value: '#ffff00', label: $L('Yellow') },
	{ value: '#00ff00', label: $L('Green') },
	{ value: '#00ffff', label: $L('Cyan') },
	{ value: '#0000ff', label: $L('Blue') },
	{ value: '#ff00ff', label: $L('Magenta') },
	{ value: '#ff0000', label: $L('Red') },
	{ value: '#000080', label: $L('Navy') },
	...(allowTransparent ? [{ value: '#00000000', label: $L('Transparent') }] : []),
	{ value: '#00000080', label: $L('Semi-transparent Black') },
	{ value: '#ffffff80', label: $L('Semi-transparent White') }
];

export const getSubtitleColorOptions = () => subtitlePalette({allowTransparent: false});
export const getSubtitleShadowColorOptions = () => subtitlePalette({allowTransparent: true});
export const getSubtitleBackgroundColorOptions = () => subtitlePalette({allowTransparent: true});

export const SUBTITLE_POSITION_OPTIONS = [
	{ value: 'bottom', label: $L('Bottom'), offset: 10 },
	{ value: 'lower', label: $L('Lower'), offset: 20 },
	{ value: 'middle', label: $L('Middle'), offset: 30 },
	{ value: 'higher', label: $L('Higher'), offset: 40 },
	{ value: 'absolute', label: $L('Absolute'), offset: 0 }
];

// Every style setting that has an HDR twin stored alongside it.
export const SUBTITLE_STYLE_KEYS = [
	'subtitleSize',
	'subtitlePosition',
	'subtitlePositionAbsolute',
	'subtitleOpacity',
	'subtitleColor',
	'subtitleShadowColor',
	'subtitleShadowOpacity',
	'subtitleShadowBlur',
	'subtitleBackgroundColor',
	'subtitleBackground'
];

export const hdrKeyFor = (key) => `${key}Hdr`;

export const subtitleStyleKey = (key, isHdr) => (isHdr ? hdrKeyFor(key) : key);

/**
 * Flattens the HDR twins over the base keys while HDR is on screen, so everything
 * downstream keeps reading the base names.
 */
export const resolveSubtitleStyleSettings = (settings, isHdr) => {
	if (!isHdr || !settings?.subtitleHdrSeparate) return settings;

	const resolved = {...settings};
	for (const key of SUBTITLE_STYLE_KEYS) {
		const value = settings[hdrKeyFor(key)];
		if (value !== undefined) resolved[key] = value;
	}
	return resolved;
};

// A palette value with an opacity slider applied on top. Older TV engines can't read 8 digit hex,
// so anything short of fully opaque comes out as rgba.
const toCssColor = (value, opacityPercent) => {
	const match = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(value || '');
	if (!match) return value;
	const alpha = (match[2] ? parseInt(match[2], 16) / 255 : 1) * (opacityPercent / 100);
	if (alpha >= 1) return `#${match[1]}`;
	const rgb = [0, 2, 4].map((i) => parseInt(match[1].slice(i, i + 2), 16));
	return `rgba(${rgb.join(', ')}, ${Math.round(alpha * 1000) / 1000})`;
};

const SIZE_MAP = { small: 36, medium: 44, large: 52, xlarge: 60 };
const POSITION_MAP = { bottom: 10, lower: 20, middle: 30, higher: 40 };

// How far up from the bottom of the screen the subtitles rest, in percent
export const subtitleBottomPercent = (settings) => (settings.subtitlePosition === 'absolute'
	? 100 - settings.subtitlePositionAbsolute
	: POSITION_MAP[settings.subtitlePosition] || 10);

// `lift` is how far the controls or the pause description push the subtitles up, and the transition on the
// overlay's class makes that a slide
export const getSubtitleOverlayStyle = (settings, lift = 0) => ({
	bottom: `${subtitleBottomPercent(settings)}%`,
	opacity: (settings.subtitleOpacity || 100) / 100,
	transform: `translateY(${-lift}px)`,
	WebkitTransform: `translateY(${-lift}px)`
});

// What a picture subtitle (PGS) can be given: it scales about the bottom edge, goes up by the percent of the screen the
// position adds to where the file puts it, and fades or dims.
export const PGS_SIZE_SCALE = {small: 0.8, medium: 1, large: 1.2, xlarge: 1.4};
export const PGS_RAISE_PERCENT = {bottom: 0, lower: 10, middle: 20, higher: 30};

// Where picture subtitles rest above the bottom of the screen when the file puts them near the edge, in percent. It is
// what the lift for the controls is measured from.
const PGS_RESTING_PERCENT = 6;
export const canvasRestingPercent = (settings, isPgs) => (
	isPgs ? PGS_RESTING_PERCENT + (PGS_RAISE_PERCENT[settings.pgsSubtitlePosition] || 0) : PGS_RESTING_PERCENT
);

// PGS and ASS rest low, and the tails of letters like p and g hang below the line the lift is measured to, so while the
// description is showing they go up a little further than the lift. With the controls up the lift is left as it is.
export const CANVAS_DESCRIPTION_GAP = 24;
export const canvasLiftFor = (lift, descriptionShown) => (descriptionShown && lift > 0 ? lift + CANVAS_DESCRIPTION_GAP : lift);

// The canvas that PGS and ASS subtitles are drawn on. Both move up out of the way of the controls and the pause description
// by `lift`, as the text subtitles do. A picture subtitle also takes the PGS settings, which an ASS track, drawn from the
// styling in its own file, does not.
export const getSubtitleCanvasStyle = (settings, lift = 0, isPgs = false, screenHeight = 1080) => {
	const raise = isPgs ? ((PGS_RAISE_PERCENT[settings.pgsSubtitlePosition] || 0) / 100) * screenHeight : 0;
	const scale = isPgs ? (PGS_SIZE_SCALE[settings.pgsSubtitleSize] || 1) : 1;
	const transform = `translateY(${-Math.round(lift + raise)}px)${scale === 1 ? '' : ` scale(${scale})`}`;
	const style = {
		transform,
		WebkitTransform: transform,
		transformOrigin: '50% 100%',
		WebkitTransformOrigin: '50% 100%',
		transition: 'transform 0.35s ease',
		WebkitTransition: '-webkit-transform 0.35s ease'
	};
	return style;
};

// What fades and dims the picture itself, apart from the box behind it, which has an opacity of its own
export const getPgsPictureStyle = (settings) => {
	const style = {};
	const opacity = Number.isFinite(settings.pgsSubtitleOpacity) ? settings.pgsSubtitleOpacity : 100;
	const brightness = Number.isFinite(settings.pgsSubtitleBrightness) ? settings.pgsSubtitleBrightness : 100;
	if (opacity < 100) style.opacity = opacity / 100;
	// Only when dimmed, since a filter over a whole screen of canvas is not free on the older sets
	if (brightness < 100) {
		style.filter = `brightness(${brightness}%)`;
		style.WebkitFilter = style.filter;
	}
	return style;
};

// The box drawn behind a picture subtitle. `area` is where the picture was drawn, as fractions of the screen, with a
// margin kept around it so the box is not tight against the letters. Nothing while its opacity is 0 or nothing is on screen.
const PGS_BOX_PAD_X = 1;
const PGS_BOX_PAD_Y = 1.4;
export const getPgsBackgroundStyle = (settings, area) => {
	const opacity = settings.pgsSubtitleBackground;
	if (!area || !(opacity > 0)) return null;
	const left = Math.max(0, area.left * 100 - PGS_BOX_PAD_X);
	const top = Math.max(0, area.top * 100 - PGS_BOX_PAD_Y);
	const right = Math.min(100, (area.left + area.width) * 100 + PGS_BOX_PAD_X);
	const bottom = Math.min(100, (area.top + area.height) * 100 + PGS_BOX_PAD_Y);
	return {
		position: 'absolute',
		left: `${left}%`,
		top: `${top}%`,
		width: `${right - left}%`,
		height: `${bottom - top}%`,
		background: toCssColor(settings.pgsSubtitleBackgroundColor || '#000000', opacity),
		borderRadius: '8px'
	};
};

export const getSubtitleTextStyle = (settings) => {
	const shadowColor = toCssColor(settings.subtitleShadowColor || '#000000', settings.subtitleShadowOpacity !== undefined ? settings.subtitleShadowOpacity : 100);
	const blur = `${settings.subtitleShadowBlur || 0.1}em`;

	return {
		fontSize: `${SIZE_MAP[settings.subtitleSize] || 44}px`,
		backgroundColor: toCssColor(settings.subtitleBackgroundColor || '#000000', settings.subtitleBackground !== undefined ? settings.subtitleBackground : 0),
		color: toCssColor(settings.subtitleColor || '#ffffff', 100),
		textShadow: `-2px -2px ${blur} ${shadowColor}, 2px -2px ${blur} ${shadowColor}, -2px 2px ${blur} ${shadowColor}, 2px 2px ${blur} ${shadowColor}, 0 0 ${blur} ${shadowColor}`
	};
};

export const sanitizeSubtitleHtml = (text) =>
	text
		.replace(/\\N/gi, '<br/>')
		.replace(/\r?\n/gi, '<br/>')
		.replace(/{\\.*?}/gi, '')
		.replace(/ {2,}/g, ' ')
		.trim();

