// Category art for the settings list, and the small marks the rows draw for themselves.

import {CORE_ICON_PATHS} from './settingsCoreIcons';
import {materialIconPath} from './materialIconMap';

import css from './Settings.module.less';

// The filled glyph, or the outlined symbol for the few names it doesn't have
export const SettingsGlyph = ({name}) => {
	const core = CORE_ICON_PATHS[name];
	return (
		<svg viewBox={core ? '0 0 24 24' : '0 -960 960 960'} fill='currentColor' aria-hidden='true' focusable='false'>
			<path d={core || materialIconPath(name)} />
		</svg>
	);
};

export const IconSearch = () => <SettingsGlyph name='search' />;

// A switch row draws its glyph at full strength, and a plain one leaves out the tile behind it
export const renderSettingsIcon = (iconName, strong, plain) => {
	if (!iconName) return null;

	let className = css.listItemIcon;
	if (plain) className = css.listItemIconPlain;
	else if (strong) className += ` ${css.listItemIconStrong}`;
	return (
		<div className={className}>
			<SettingsGlyph name={iconName} />
		</div>
	);
};

export const renderToggle = (isOn) => (
	<div className={`${css.toggleTrack} ${isOn ? css.toggleOn : ''}`}>
		<div className={css.toggleThumb} />
	</div>
);

export const renderCheck = (isSelected) => (
	<div className={css.checkIcon}>
		{isSelected && <SettingsGlyph name='check' />}
	</div>
);

export const renderChevron = () => (
	<div className={css.chevronIcon}>
		<SettingsGlyph name='chevron_right' />
	</div>
);
