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

