import Spottable from '@enact/spotlight/Spottable';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import Spotlight from '@enact/spotlight';
import Slider from '@enact/sandstone/Slider';
import {useCallback, useEffect} from 'react';
import $L from '@enact/i18n/$L';
import {useSettings} from '../../context/SettingsContext';
import {isBackKey} from '../../utils/keys';
import {getSubtitleFontPx, resolveSubtitleStyleSettings} from '../../utils/subtitleConstants';
import {
	SECONDARY_OFFSET_MAX, SECONDARY_OFFSET_STEP, SECONDARY_SIZE_MAX, SECONDARY_SIZE_MIN, SECONDARY_SIZE_STEP,
	getSecondarySubtitleColorOptions
} from './secondarySubtitle';

import css from './Player.module.less';

const SpottableButton = Spottable('button');

const SettingsContainer = SpotlightContainerDecorator({
	enterTo: 'default-element',
	defaultElement: '[data-spot-default="true"]',
	straightOnly: false,
	leaveFor: {left: '', right: '', up: '', down: ''},
	preserveId: true
}, 'div');

const stopPropagation = (e) => e.stopPropagation();

// The second track's size, vertical offset and color. They stay on this device and never sync.
const SecondarySubtitleSettingsOverlay = ({onClose, isHdr}) => {
	const {settings, updateSetting} = useSettings();
	// Until it's set the second track takes the first track's size.
	const size = settings.secondarySubtitleSize > 0
		? settings.secondarySubtitleSize
		: getSubtitleFontPx(resolveSubtitleStyleSettings(settings, isHdr));
	const colors = getSecondarySubtitleColorOptions();
	const colorIndex = Math.max(0, colors.findIndex((option) => option.value === settings.secondarySubtitleColor));

	useEffect(() => {
		const timer = setTimeout(() => Spotlight.focus('secondary-sub-setting-size'), 100);
		return () => clearTimeout(timer);
	}, []);

	useEffect(() => {
		const handleKeyDown = (e) => {
			if (isBackKey(e)) {
				e.preventDefault();
				e.stopPropagation();
				onClose();
			}
		};
		window.addEventListener('keydown', handleKeyDown, true);
		return () => window.removeEventListener('keydown', handleKeyDown, true);
	}, [onClose]);

	const handleSizeChange = useCallback((e) => updateSetting('secondarySubtitleSize', e.value), [updateSetting]);
	const handleOffsetChange = useCallback((e) => updateSetting('secondarySubtitleOffset', e.value), [updateSetting]);
	const handleCycleColor = useCallback(() => {
		const options = getSecondarySubtitleColorOptions();
		updateSetting('secondarySubtitleColor', options[(colorIndex + 1) % options.length].value);
	}, [colorIndex, updateSetting]);

	return (
		<div className={css.trackModal} onClick={onClose}>
			<SettingsContainer
				className={`${css.modalContent} ${css.settingsModal}`}
				// Three controls don't need the tall panel the primary appearance list fills.
				style={{height: 'auto'}}
				onClick={stopPropagation}
				spotlightId="secondary-subtitle-settings-modal"
			>
				<h2 className={css.modalTitle}>{$L('Secondary Subtitle Track')}</h2>

				<div className={css.sliderItem}>
					<div className={css.sliderLabel}>
						<span>{$L('Subtitle Size')}</span>
						<span className={css.sliderValue}>{size}</span>
					</div>
					<Slider
						min={SECONDARY_SIZE_MIN}
						max={SECONDARY_SIZE_MAX}
						step={SECONDARY_SIZE_STEP}
						value={size}
						onChange={handleSizeChange}
						className={css.settingsSlider}
						tooltip={false}
						spotlightId="secondary-sub-setting-size"
						data-spot-default="true"
					/>
				</div>

				<div className={css.sliderItem}>
					<div className={css.sliderLabel}>
						<span>{$L('Vertical Offset')}</span>
						<span className={css.sliderValue}>{settings.secondarySubtitleOffset}%</span>
					</div>
					<Slider
						min={0}
						max={SECONDARY_OFFSET_MAX}
						step={SECONDARY_OFFSET_STEP}
						value={settings.secondarySubtitleOffset}
						onChange={handleOffsetChange}
						className={css.settingsSlider}
						tooltip={false}
						spotlightId="secondary-sub-setting-offset"
					/>
				</div>

				<SpottableButton
					className={css.settingItem}
					onClick={handleCycleColor}
					spotlightId="secondary-sub-setting-color"
				>
					<span className={css.settingLabel}>{$L('Text Fill Color')}</span>
					<span className={css.settingValue}>{colors[colorIndex].label}</span>
				</SpottableButton>

				<SpottableButton className={css.closeBtn} onClick={onClose} spotlightId="secondary-sub-settings-close">
					{$L('Press BACK to close')}
				</SpottableButton>
			</SettingsContainer>
		</div>
	);
};

export default SecondarySubtitleSettingsOverlay;
