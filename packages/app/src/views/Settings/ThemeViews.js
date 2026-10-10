/* eslint-disable react/jsx-no-bind */
import $L from '@enact/i18n/$L';

import {SpottableDiv} from './settingsSpottables';
import SettingsView from './SettingsView';

import css from './Settings.module.less';

// Theme colours are stored as #AARRGGBB, which CSS has no time for.
const hexToRgba = (hex) => {
	const clean = hex.replace('#', '');
	const a = parseInt(clean.slice(0, 2), 16) / 255;
	const r = parseInt(clean.slice(2, 4), 16);
	const g = parseInt(clean.slice(4, 6), 16);
	const b = parseInt(clean.slice(6, 8), 16);
	if (a >= 0.999) return `rgb(${r}, ${g}, ${b})`;
	return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
};

export const ThemesView = ({availableThemes, activeThemeId, onSelectTheme}) => (
	<SettingsView spotlightId='themes-view' title={$L('Theme')} clean>
		<div className={css.themeCardList}>
			{availableThemes.map((theme) => {
				const isSelected = theme.id === activeThemeId;
				const bg = hexToRgba(theme.colors.background);
				const surface = hexToRgba(theme.colors.surface);
				const accent = hexToRgba(theme.colors.accent);
				const progress = hexToRgba(theme.colors.rangeProgress);
				return (
					<SpottableDiv
						key={theme.id}
						className={`${css.themeCard}${isSelected ? ` ${css.themeCardSelected}` : ''}`}
						onClick={() => onSelectTheme(theme.id)}
						spotlightId={`theme-card-${theme.id}`}
					>
						<div className={css.themeCardHeader}>
							<div className={css.themeCardName}>{theme.displayName}</div>
							{isSelected && <div className={css.themeCardCheck}>✓</div>}
						</div>
						{theme.description ? (
							<div className={css.themeCardDescription}>{theme.description}</div>
						) : null}
						<div
							className={css.themeCardStripe}
							style={{background: `linear-gradient(to right, ${bg}, ${surface}, ${accent}, ${progress})`}}
						/>
					</SpottableDiv>
				);
			})}
		</div>
	</SettingsView>
);

export const ThemeStoreView = ({catalog, loading, error, busyId, availableThemes, onStoreThemeClick}) => (
	<SettingsView spotlightId='theme-store-view' title={$L('Theme Store')} clean>
		{loading ? (
			<div className={css.themeStoreMessage}>{$L('Loading themes…')}</div>
		) : error ? (
			<div className={css.themeStoreMessage}>{$L("Couldn't load the Theme Store. Check your connection and try again.")}</div>
		) : catalog.length === 0 ? (
			<div className={css.themeStoreMessage}>{$L('No themes are available right now.')}</div>
		) : (
			<div className={css.themeCardList}>
				{catalog.map((entry) => {
					const saved = availableThemes.some((t) => t.id === entry.id);
					const busy = busyId === entry.id;
					return (
						<SpottableDiv
							key={entry.id}
							className={css.themeCard}
							onClick={() => onStoreThemeClick(entry)}
							spotlightId={`store-theme-${entry.id}`}
						>
							<div className={css.themeCardHeader}>
								<div className={css.themeCardName}>{entry.displayName}</div>
								{saved && <div className={css.themeCardCheck}>✓</div>}
							</div>
							{entry.description ? (
								<div className={css.themeCardDescription}>{entry.description}</div>
							) : null}
							<div className={css.themeStoreCardAction}>
								{busy ? $L('Working...') : saved ? $L('Remove') : $L('Save & apply')}
							</div>
						</SpottableDiv>
					);
				})}
			</div>
		)}
	</SettingsView>
);
