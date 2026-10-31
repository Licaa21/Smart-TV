/* eslint-disable react/jsx-no-bind */
import {useMemo} from 'react';
import $L from '@enact/i18n/$L';

import {SettingsOverride, useSettings} from '../../../context/SettingsContext';
import {
	DetailStylePreview,
	KeyboardPreview,
	MediaBarPreview,
	PlayerPreview,
	SettingsHomePreview,
	usePreviewPalette
} from '../../SetupWizard/SetupPreviews';
import {MEDIA_BAR_KEYS} from './previewRows';

import css from './SettingsLivePreview.module.less';

export const SCENES = ['home', 'details', 'player', 'search'];

const SCENE_LABELS = {
	home: () => $L('Home'),
	details: () => $L('Details Page'),
	player: () => $L('Player'),
	search: () => $L('Search')
};

// Read inside the override, so a picker's option shows before it's saved.
const MediaBarScene = () => {
	const {settings} = useSettings();
	return <MediaBarPreview mode={settings.featuredBarStyle || 'moonfin'} />;
};

const DetailsScene = () => {
	const {settings} = useSettings();
	return <DetailStylePreview variant={settings.detailScreenStyle || 'v2'} />;
};

const SceneView = ({scene, focusKey}) => {
	if (scene === 'details') return <DetailsScene />;
	if (scene === 'search') return <KeyboardPreview />;
	if (scene === 'player') {
		let moment = 'middle';
		if (focusKey === 'introAction') moment = 'intro';
		if (focusKey === 'nextUpBehavior') moment = 'end';
		return <PlayerPreview moment={moment} />;
	}
	if (MEDIA_BAR_KEYS.indexOf(focusKey) >= 0) return <MediaBarScene />;
	return <SettingsHomePreview />;
};

// The live preview beside the settings list: scene chips, a mock of the screen the focused
// setting changes, and that setting spelled out with every choice a picker offers.
const SettingsLivePreview = ({scene, row, trying, onPickScene}) => {
	const t = usePreviewPalette();
	const overrides = useMemo(() => (trying ? {[trying.key]: trying.value} : null), [trying]);
	const focusKey = row ? row.key : null;
	const tryingHere = !!(trying && row && trying.key === row.key);
	const live = tryingHere ? trying.index : (row ? row.saved : -1);

	return (
		<div className={css.preview}>
			<div className={css.header}>
				<span className={css.dot} style={{backgroundColor: t.accent}} />
				<span className={css.label}>{$L('Live preview')}</span>
				<div className={css.chips}>
					{SCENES.map((id) => (
						<div
							key={id}
							className={id === scene ? `${css.chip} ${css.chipSelected}` : css.chip}
							onClick={() => onPickScene(id)}
						>
							{SCENE_LABELS[id]()}
						</div>
					))}
				</div>
			</div>
			<div className={css.frame}>
				<SettingsOverride overrides={overrides}>
					<SceneView scene={scene} focusKey={focusKey} />
				</SettingsOverride>
			</div>
			{row && (
				<div className={css.inspector}>
					{/* A link opens a screen of its own settings, so it has no status to report. */}
					{row.key && (
						<div className={css.status}>
							<span className={css.statusDot} style={{backgroundColor: row.scene ? t.accent : 'rgba(255, 255, 255, 0.4)'}} />
							<span className={row.scene ? css.statusOn : css.statusOff}>
								{row.scene
									? $L('Shows on the {screen} preview').replace('{screen}', SCENE_LABELS[row.scene]())
									: $L('Not shown in the preview')}
							</span>
						</div>
					)}
					<div className={css.title}>{row.title}</div>
					{row.description && <div className={css.description}>{row.description}</div>}
					{row.options.length > 0 && row.options.length <= 8 && (
						<div className={css.options}>
							{row.options.map((option, index) => {
								const isLive = index === live;
								const isSaved = tryingHere && index === row.saved && !isLive;
								return (
									<span
										key={String(option.value)}
										className={isLive ? `${css.option} ${css.optionLive}` : css.option}
										style={isSaved ? {borderColor: t.accent} : null}
									>
										{option.label}
										{isSaved && <span className={css.savedTag}>{$L('Saved')}</span>}
									</span>
								);
							})}
						</div>
					)}
				</div>
			)}
		</div>
	);
};

export default SettingsLivePreview;
