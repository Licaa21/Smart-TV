import Spottable from '@enact/spotlight/Spottable';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import Spotlight from '@enact/spotlight';
import Scroller from '@enact/sandstone/Scroller';
import Slider from '@enact/sandstone/Slider';
import {useCallback, useEffect} from 'react';
import $L from '@enact/i18n/$L';
import {useSettings} from '../../context/SettingsContext';
import {isBackKey} from '../../utils/keys';
import {getPgsPositionOptions} from '../Settings/settingsOptions';
import {
	getSubtitleBackgroundColorOptions, getSubtitleColorOptions, getSubtitleShadowColorOptions,
	resolveSubtitleStyleSettings, subtitleStyleKey
} from '../../utils/subtitleConstants';

import css from './Player.module.less';

const SpottableButton = Spottable('button');

// Room is left for the title above and the hint below, so a long list scrolls and does not run under them
const LIST_STYLE = {flex: '1 1 auto', minHeight: 0, maxHeight: '52vh'};

const SettingsContainer = SpotlightContainerDecorator({
	enterTo: 'default-element',
	defaultElement: '[data-spot-default="true"]',
	straightOnly: false,
	leaveFor: {left: '', right: '', up: '', down: ''},
	preserveId: true
}, 'div');

const getSubtitleSizeOptions = () => [
	{value: 'small', label: $L('Small')},
	{value: 'medium', label: $L('Medium')},
	{value: 'large', label: $L('Large')},
	{value: 'xlarge', label: $L('Extra Large')}
];

const getSubtitlePositionOptions = () => [
	{value: 'bottom', label: $L('Bottom')},
	{value: 'lower', label: $L('Lower')},
	{value: 'middle', label: $L('Middle')},
	{value: 'higher', label: $L('Higher')},
	{value: 'absolute', label: $L('Absolute')}
];

const cycleOption = (options, currentValue, updateSetting, settingKey) => {
	const currentIndex = options.findIndex(o => o.value === currentValue);
	const index = currentIndex === -1 ? 0 : currentIndex;
	const nextIndex = (index + 1) % options.length;
	updateSetting(settingKey, options[nextIndex].value);
};

const getLabel = (options, currentValue, fallback) => {
	const option = options.find(o => o.value === currentValue);
	return option?.label || fallback;
};

const stopPropagation = (e) => e.stopPropagation();

// `subtitleKind` is what the track on screen is: text, which takes the style below, a picture (PGS), which takes its own settings,
// or ASS, which is styled by its own file and has nothing to set here.
const SubtitleSettingsOverlay = ({visible, onClose, isHdr = false, subtitleKind = 'text'}) => {
	const {settings, updateSetting} = useSettings();
	const hdrActive = Boolean(isHdr && settings.subtitleHdrSeparate);
	const style = resolveSubtitleStyleSettings(settings, isHdr);
	const keyFor = useCallback((key) => subtitleStyleKey(key, hdrActive), [hdrActive]);

	const SUBTITLE_SIZE_OPTIONS = getSubtitleSizeOptions();
	const SUBTITLE_COLOR_OPTIONS = getSubtitleColorOptions();
	const SUBTITLE_POSITION_OPTIONS = getSubtitlePositionOptions();
	const SUBTITLE_SHADOW_COLOR_OPTIONS = getSubtitleShadowColorOptions();
	const SUBTITLE_BACKGROUND_COLOR_OPTIONS = getSubtitleBackgroundColorOptions();

	useEffect(() => {
		if (visible) {
			setTimeout(() => {
				Spotlight.focus(subtitleKind === 'ass' ? 'sub-settings-close' : 'sub-setting-size');
			}, 100);
		}
	}, [visible, subtitleKind]);

	useEffect(() => {
		if (!visible) return;

		const handleKeyDown = (e) => {
			if (isBackKey(e)) {
				e.preventDefault();
				e.stopPropagation();
				onClose();
			}
		};

		window.addEventListener('keydown', handleKeyDown, true);
		return () => window.removeEventListener('keydown', handleKeyDown, true);
	}, [visible, onClose]);

	const handleCycleSize = useCallback(() => {
		cycleOption(getSubtitleSizeOptions(), style.subtitleSize, updateSetting, keyFor('subtitleSize'));
	}, [style.subtitleSize, updateSetting, keyFor]);

	const handleCyclePosition = useCallback(() => {
		cycleOption(getSubtitlePositionOptions(), style.subtitlePosition, updateSetting, keyFor('subtitlePosition'));
	}, [style.subtitlePosition, updateSetting, keyFor]);

	const handleCycleColor = useCallback(() => {
		cycleOption(getSubtitleColorOptions(), style.subtitleColor, updateSetting, keyFor('subtitleColor'));
	}, [style.subtitleColor, updateSetting, keyFor]);

	const handleCycleShadowColor = useCallback(() => {
		cycleOption(getSubtitleShadowColorOptions(), style.subtitleShadowColor, updateSetting, keyFor('subtitleShadowColor'));
	}, [style.subtitleShadowColor, updateSetting, keyFor]);

	const handleCycleBackgroundColor = useCallback(() => {
		cycleOption(getSubtitleBackgroundColorOptions(), style.subtitleBackgroundColor, updateSetting, keyFor('subtitleBackgroundColor'));
	}, [style.subtitleBackgroundColor, updateSetting, keyFor]);

	const handleCyclePgsSize = useCallback(() => {
		cycleOption(getSubtitleSizeOptions(), settings.pgsSubtitleSize, updateSetting, 'pgsSubtitleSize');
	}, [settings.pgsSubtitleSize, updateSetting]);

	const handleCyclePgsPosition = useCallback(() => {
		cycleOption(getPgsPositionOptions(), settings.pgsSubtitlePosition, updateSetting, 'pgsSubtitlePosition');
	}, [settings.pgsSubtitlePosition, updateSetting]);

	const handlePgsOpacityChange = useCallback((e) => {
		updateSetting('pgsSubtitleOpacity', e.value);
	}, [updateSetting]);

	const handlePgsBrightnessChange = useCallback((e) => {
		updateSetting('pgsSubtitleBrightness', e.value);
	}, [updateSetting]);

	const handleCyclePgsBackgroundColor = useCallback(() => {
		cycleOption(getSubtitleBackgroundColorOptions(), settings.pgsSubtitleBackgroundColor, updateSetting, 'pgsSubtitleBackgroundColor');
	}, [settings.pgsSubtitleBackgroundColor, updateSetting]);

	const handlePgsBackgroundChange = useCallback((e) => {
		updateSetting('pgsSubtitleBackground', e.value);
	}, [updateSetting]);

	const handlePositionAbsoluteChange = useCallback((e) => {
		updateSetting(keyFor('subtitlePositionAbsolute'), e.value);
	}, [updateSetting, keyFor]);

	const handleOpacityChange = useCallback((e) => {
		updateSetting(keyFor('subtitleOpacity'), e.value);
	}, [updateSetting, keyFor]);

	const handleShadowOpacityChange = useCallback((e) => {
		updateSetting(keyFor('subtitleShadowOpacity'), e.value);
	}, [updateSetting, keyFor]);

	const handleShadowBlurChange = useCallback((e) => {
		updateSetting(keyFor('subtitleShadowBlur'), e.value);
	}, [updateSetting, keyFor]);

	const handleBackgroundChange = useCallback((e) => {
		updateSetting(keyFor('subtitleBackground'), e.value);
	}, [updateSetting, keyFor]);

	if (!visible) return null;

	return (
		<div className={css.trackModal} onClick={onClose}>
			<SettingsContainer
				className={`${css.modalContent} ${css.settingsModal}`}
				onClick={stopPropagation}
				spotlightId="subtitle-settings-modal"
			>
				<h2 className={css.modalTitle}>{subtitleKind === 'pgs' ? $L('Picture Subtitles (PGS)') : $L('Subtitle Appearance')}</h2>
				{subtitleKind === 'ass' && (
					<SpottableButton className={css.settingNote} onClick={onClose} spotlightId="sub-settings-close">
						{$L('This subtitle is styled by its own file, so its look cannot be changed here.')}
					</SpottableButton>
				)}
				{subtitleKind === 'pgs' && (
					<Scroller
						direction="vertical"
						horizontalScrollbar="hidden"
						verticalScrollbar="hidden"
						style={LIST_STYLE}
					>
						<SpottableButton
							className={css.settingItem}
							onClick={handleCyclePgsSize}
							spotlightId="sub-setting-size"
							data-spot-default="true"
						>
							<span className={css.settingLabel}>{$L('Size')}</span>
							<span className={css.settingValue}>
								{getLabel(SUBTITLE_SIZE_OPTIONS, settings.pgsSubtitleSize, $L('Medium'))}
							</span>
						</SpottableButton>

						<SpottableButton
							className={css.settingItem}
							onClick={handleCyclePgsPosition}
							spotlightId="sub-setting-position"
						>
							<span className={css.settingLabel}>{$L('Position')}</span>
							<span className={css.settingValue}>
								{getLabel(getPgsPositionOptions(), settings.pgsSubtitlePosition, $L('Bottom'))}
							</span>
						</SpottableButton>

						<div className={css.sliderItem}>
							<div className={css.sliderLabel}>
								<span>{$L('PGS Opacity')}</span>
								<span className={css.sliderValue}>{settings.pgsSubtitleOpacity ?? 100}%</span>
							</div>
							<Slider
								min={10}
								max={100}
								step={5}
								value={settings.pgsSubtitleOpacity ?? 100}
								onChange={handlePgsOpacityChange}
								className={css.settingsSlider}
								tooltip={false}
								spotlightId="sub-setting-pgsOpacity"
							/>
						</div>

						<div className={css.sliderItem}>
							<div className={css.sliderLabel}>
								<span>{$L('PGS Brightness')}</span>
								<span className={css.sliderValue}>{settings.pgsSubtitleBrightness ?? 100}%</span>
							</div>
							<Slider
								min={20}
								max={100}
								step={5}
								value={settings.pgsSubtitleBrightness ?? 100}
								onChange={handlePgsBrightnessChange}
								className={css.settingsSlider}
								tooltip={false}
								spotlightId="sub-setting-pgsBrightness"
							/>
						</div>

						<SpottableButton
							className={css.settingItem}
							onClick={handleCyclePgsBackgroundColor}
							spotlightId="sub-setting-pgsBgColor"
						>
							<span className={css.settingLabel}>{$L('PGS Background Color')}</span>
							<span className={css.settingValue}>
								{getLabel(SUBTITLE_BACKGROUND_COLOR_OPTIONS, settings.pgsSubtitleBackgroundColor, $L('Black'))}
							</span>
						</SpottableButton>

						<div className={css.sliderItem}>
							<div className={css.sliderLabel}>
								<span>{$L('PGS Background Opacity')}</span>
								<span className={css.sliderValue}>{settings.pgsSubtitleBackground ?? 0}%</span>
							</div>
							<Slider
								min={0}
								max={100}
								step={5}
								value={settings.pgsSubtitleBackground ?? 0}
								onChange={handlePgsBackgroundChange}
								className={css.settingsSlider}
								tooltip={false}
								spotlightId="sub-setting-pgsBgOpacity"
							/>
						</div>
					</Scroller>
				)}
				{subtitleKind !== 'pgs' && subtitleKind !== 'ass' && (
				<Scroller
					direction="vertical"
					horizontalScrollbar="hidden"
					verticalScrollbar="hidden"
					style={LIST_STYLE}
				>
					{/* Size */}
					<SpottableButton
						className={css.settingItem}
						onClick={handleCycleSize}
						spotlightId="sub-setting-size"
						data-spot-default="true"
					>
						<span className={css.settingLabel}>{$L('Size')}</span>
						<span className={css.settingValue}>
							{getLabel(SUBTITLE_SIZE_OPTIONS, style.subtitleSize, $L('Medium'))}
						</span>
					</SpottableButton>

					{/* Position */}
					<SpottableButton
						className={css.settingItem}
						onClick={handleCyclePosition}
						spotlightId="sub-setting-position"
					>
						<span className={css.settingLabel}>{$L('Position')}</span>
						<span className={css.settingValue}>
							{getLabel(SUBTITLE_POSITION_OPTIONS, style.subtitlePosition, $L('Bottom'))}
						</span>
					</SpottableButton>

					{/* Absolute Position Slider */}
					{style.subtitlePosition === 'absolute' && (
						<div className={css.sliderItem}>
							<div className={css.sliderLabel}>
								<span>{$L('Absolute Position')}</span>
								<span className={css.sliderValue}>{style.subtitlePositionAbsolute}%</span>
							</div>
							<Slider
								min={0}
								max={100}
								step={5}
								value={style.subtitlePositionAbsolute}
							onChange={handlePositionAbsoluteChange}
								className={css.settingsSlider}
								tooltip={false}
								spotlightId="sub-setting-positionAbsolute"
							/>
						</div>
					)}

					<div className={css.divider} />

					{/* Opacity */}
					<div className={css.sliderItem}>
						<div className={css.sliderLabel}>
							<span>{$L('Text Opacity')}</span>
							<span className={css.sliderValue}>{style.subtitleOpacity}%</span>
						</div>
						<Slider
							min={0}
							max={100}
							step={5}
							value={style.subtitleOpacity}
						onChange={handleOpacityChange}
							className={css.settingsSlider}
							tooltip={false}
							spotlightId="sub-setting-opacity"
						/>
					</div>

					{/* Text Color */}
					<SpottableButton
						className={css.settingItem}
						onClick={handleCycleColor}
						spotlightId="sub-setting-color"
					>
						<span className={css.settingLabel}>{$L('Text Fill Color')}</span>
						<span className={css.settingValue}>
							{getLabel(SUBTITLE_COLOR_OPTIONS, style.subtitleColor, $L('White'))}
						</span>
					</SpottableButton>

					<div className={css.divider} />

					{/* Shadow Color */}
					<SpottableButton
						className={css.settingItem}
						onClick={handleCycleShadowColor}
						spotlightId="sub-setting-shadowColor"
					>
						<span className={css.settingLabel}>{$L('Shadow Color')}</span>
						<span className={css.settingValue}>
							{getLabel(SUBTITLE_SHADOW_COLOR_OPTIONS, style.subtitleShadowColor, $L('Black'))}
						</span>
					</SpottableButton>

					{/* Shadow Opacity */}
					<div className={css.sliderItem}>
						<div className={css.sliderLabel}>
							<span>{$L('Shadow Opacity')}</span>
							<span className={css.sliderValue}>{style.subtitleShadowOpacity}%</span>
						</div>
						<Slider
							min={0}
							max={100}
							step={5}
							value={style.subtitleShadowOpacity}
						onChange={handleShadowOpacityChange}
							className={css.settingsSlider}
							tooltip={false}
							spotlightId="sub-setting-shadowOpacity"
						/>
					</div>

					{/* Shadow Blur */}
					<div className={css.sliderItem}>
						<div className={css.sliderLabel}>
							<span>{$L('Shadow Size (Blur)')}</span>
							<span className={css.sliderValue}>
								{style.subtitleShadowBlur ? style.subtitleShadowBlur.toFixed(1) : '0.1'}
							</span>
						</div>
						<Slider
							min={0}
							max={1}
							step={0.1}
							value={style.subtitleShadowBlur || 0.1}
						onChange={handleShadowBlurChange}
							className={css.settingsSlider}
							tooltip={false}
							spotlightId="sub-setting-shadowBlur"
						/>
					</div>

					<div className={css.divider} />

					{/* Background Color */}
					<SpottableButton
						className={css.settingItem}
						onClick={handleCycleBackgroundColor}
						spotlightId="sub-setting-bgColor"
					>
						<span className={css.settingLabel}>{$L('Background Color')}</span>
						<span className={css.settingValue}>
							{getLabel(SUBTITLE_BACKGROUND_COLOR_OPTIONS, style.subtitleBackgroundColor, $L('Black'))}
						</span>
					</SpottableButton>

					{/* Background Opacity */}
					<div className={css.sliderItem}>
						<div className={css.sliderLabel}>
							<span>{$L('Background Opacity')}</span>
							<span className={css.sliderValue}>{style.subtitleBackground}%</span>
						</div>
						<Slider
							min={0}
							max={100}
							step={5}
							value={style.subtitleBackground}
						onChange={handleBackgroundChange}
							className={css.settingsSlider}
							tooltip={false}
							spotlightId="sub-setting-bgOpacity"
						/>
					</div>
				</Scroller>
				)}

				<div className={css.closeHint}>{$L('Press BACK to close')}</div>
			</SettingsContainer>
		</div>
	);
};

export default SubtitleSettingsOverlay;
