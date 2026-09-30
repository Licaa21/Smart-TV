import Slider from '@enact/sandstone/Slider';

import {renderSettingsIcon, renderToggle, renderChevron} from './settingsIcons';
import {SpottableDiv} from './settingsSpottables';

import css from './Settings.module.less';

// The row shapes every settings screen is built from. None of them reach for the settings
// context, so what a row shows and what a press does are both decided by the caller.

export const SectionTitle = ({children}) => <div className={css.sectionTitle}>{children}</div>;

export const ToggleRow = ({settingKey, title, desc, icon, checked, onToggle}) => (
	<SpottableDiv className={css.listItem} onClick={onToggle} spotlightId={`setting-${settingKey}`}>
		{renderSettingsIcon(icon)}
		<div className={css.listItemBody}>
			<div className={css.listItemHeading}>{title}</div>
			{desc && <div className={css.listItemCaption}>{desc}</div>}
		</div>
		<div className={css.listItemTrailing}>{renderToggle(checked)}</div>
	</SpottableDiv>
);

// A dot of the color an option stands for, in front of its label or the chevron.
export const Swatch = ({color}) => (color
	? <span className={css.swatch} style={{backgroundColor: color}} />
	: null);

export const OptionRow = ({settingKey, title, caption, icon, swatch, onOpen}) => (
	<SpottableDiv className={css.listItem} onClick={onOpen} spotlightId={`setting-${settingKey}`}>
		{renderSettingsIcon(icon)}
		<div className={css.listItemBody}>
			<div className={css.listItemHeading}>{title}</div>
			<div className={css.listItemCaption}>{caption}</div>
		</div>
		<div className={css.listItemTrailing}>
			<Swatch color={swatch} />
			{renderChevron()}
		</div>
	</SpottableDiv>
);

export const NavRow = ({id, title, desc, icon, onClick}) => (
	<SpottableDiv className={css.listItem} onClick={onClick} spotlightId={`setting-${id}`}>
		{renderSettingsIcon(icon)}
		<div className={css.listItemBody}>
			<div className={css.listItemHeading}>{title}</div>
			{desc && <div className={css.listItemCaption}>{desc}</div>}
		</div>
		<div className={css.listItemTrailing}>{renderChevron()}</div>
	</SpottableDiv>
);

export const InfoRow = ({id, label, value, icon}) => (
	<SpottableDiv className={css.listItem} spotlightId={`info-${id}`}>
		{renderSettingsIcon(icon)}
		<div className={css.listItemBody}>
			<div className={css.listItemHeading}>{label}</div>
		</div>
		<div className={css.listItemValue}>{value}</div>
	</SpottableDiv>
);

export const SliderRow = ({settingKey, title, min, max, step, value, format, icon, onChange}) => (
	<div className={css.sliderContainer}>
		<div className={css.sliderLabel}>
			<div className={css.sliderTitleGroup}>
				{renderSettingsIcon(icon)}
				<span className={css.sliderTitle}>{title}</span>
			</div>
			<span className={css.sliderValue}>{format ? format(value) : value}</span>
		</div>
		<Slider
			min={min}
			max={max}
			step={step}
			value={value}
			onChange={onChange}
			className={css.settingsSlider}
			tooltip={false}
			spotlightId={`setting-${settingKey}`}
		/>
	</div>
);
