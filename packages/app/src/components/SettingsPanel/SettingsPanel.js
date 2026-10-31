/* eslint-disable react/jsx-no-bind */
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import $L from '@enact/i18n/$L';
import Spotlight from '@enact/spotlight';
import Spottable from '@enact/spotlight/Spottable';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import Settings from '../../views/Settings';
import SettingsLivePreview from '../../views/Settings/LivePreview/SettingsLivePreview';
import {SearchBar} from '../../views/Settings/BrowseViews';
import {SCENE_BY_KEY, describeRow} from '../../views/Settings/LivePreview/previewRows';
import {SETTINGS_SCHEMA, resolve} from '../../views/Settings/settingsSchema';
import {usePreviewPalette} from '../../views/SetupWizard/SetupPreviews';
import {useSettings} from '../../context/SettingsContext';
import {effectiveAccent, themeAccentHex} from '../../theme/accentSurfaces';
import {readableInk, toCssColor} from '../../theme/themeSpec';
import {useAuth} from '../../context/AuthContext';
import {ensurePreviewItemsLoaded} from '../../views/SetupWizard/setupPreviewData';
import {isTvKeyboardVisible} from '../TVKeyboard/keyboardBus';

import css from './SettingsPanel.module.less';

const PanelContainer = SpotlightContainerDecorator({
	enterTo: 'last-focused',
	restrict: 'self-only',
	leaveFor: {left: '', right: '', up: '', down: ''}
}, 'div');

const PillContainer = SpotlightContainerDecorator({
	enterTo: 'default-element',
	defaultElement: '[data-selected="true"]'
}, 'div');

const PillItem = Spottable('div');

const CLOSE_MS = 220;
const PILL_ID = 'settings-category-pill';

// Whether any row of the list column's page sits above [active], so Up has somewhere to go
// inside the page before it climbs to the pill.
const hasRowAbove = (column, active) => {
	const page = column.querySelector('[data-spotlight-container]');
	if (!page) return false;
	const top = active.getBoundingClientRect().top;
	return Array.prototype.some.call(page.querySelectorAll('.spottable'), (el) => (
		el !== active && el.offsetParent !== null && el.getBoundingClientRect().bottom <= top + 1
	));
};

// Settings with its live preview: the categories in a pill across the top, the chosen
// category's screens in a column on the left, and a preview of the screen the focused
// setting changes on the right.
const LiveSettingsLayout = ({closing, onClose, onLibrariesChanged, onRunSetupWizard, onSelectItem, hasLiveTv}) => {
	const {settings, activeTheme} = useSettings();
	const {api} = useAuth();
	const t = usePreviewPalette();
	// The accent for Settings, as a hex, with ink that reads on it: a white pick would otherwise carry white text
	const accent = effectiveAccent(settings, 'settings') || themeAccentHex(activeTheme);
	const categories = useMemo(() => SETTINGS_SCHEMA
		.filter((entry) => !entry.when || entry.when({settings}))
		.map((entry) => ({id: entry.id, label: resolve(entry.label)})), [settings]);
	const [category, setCategory] = useState(() => categories[0].id);
	const [rowId, setRowId] = useState(null);
	const [trying, setTrying] = useState(null);
	const [scene, setScene] = useState('home');
	const [query, setQuery] = useState('');
	// The pill in focus is white with black text, whatever the accent, so the ink picked for the accent is only for a pill at rest
	const [pillFocused, setPillFocused] = useState(false);
	const listRef = useRef(null);
	const pillRef = useRef(null);
	const topRef = useRef(null);

	// Kids Mode coming or going swaps the categories out from under the one that was open.
	useEffect(() => {
		if (!categories.some((c) => c.id === category)) setCategory(categories[0].id);
	}, [categories, category]);

	useEffect(() => {
		const timer = setTimeout(() => Spotlight.focus(PILL_ID), 60);
		return () => clearTimeout(timer);
	}, []);

	// The previews draw the library's own titles.
	useEffect(() => {
		ensurePreviewItemsLoaded(api);
	}, [api]);

	// Down from the pill enters the page, Up from a page's top row climbs to the pill. Run
	// before Spotlight, whose page containers otherwise hold focus at their edges.
	useEffect(() => {
		const handleKeyDown = (ev) => {
			if (ev.keyCode !== 38 && ev.keyCode !== 40) return;
			if (isTvKeyboardVisible()) return;
			const active = document.activeElement;
			const column = listRef.current;
			if (!active || !column) return;
			if (ev.keyCode === 40 && topRef.current && topRef.current.contains(active)) {
				// The first row rather than the page container, whose memory of its last row
				// can point at the same-named page of the category before.
				const page = column.querySelector('[data-spotlight-container]');
				const first = page && Array.prototype.find.call(
					page.querySelectorAll('.spottable'),
					(el) => el.offsetParent !== null
				);
				if (first) {
					ev.preventDefault();
					ev.stopPropagation();
					Spotlight.focus(first);
				}
				return;
			}
			if (ev.keyCode === 38 && column.contains(active)) {
				if (active.closest('[data-spotlight-id="options-view"]')) return;
				if (hasRowAbove(column, active)) return;
				ev.preventDefault();
				ev.stopPropagation();
				Spotlight.focus(PILL_ID);
			}
		};
		window.addEventListener('keydown', handleKeyDown, true);
		return () => window.removeEventListener('keydown', handleKeyDown, true);
	}, []);

	// Back at a category's own page returns to the pill, and from the pill closes Settings.
	const handleRootBack = useCallback(() => {
		if (pillRef.current && pillRef.current.contains(document.activeElement)) onClose();
		else Spotlight.focus(PILL_ID);
	}, [onClose]);

	const handleListFocus = useCallback((ev) => {
		const host = ev.target.closest ? ev.target.closest('[data-spotlight-id]') : null;
		const id = host ? host.getAttribute('data-spotlight-id') : null;
		if (!id || /^opt-\d+$/.test(id)) return;
		const described = describeRow(id, settings);
		if (!described) return;
		setRowId(id);
		if (described.scene) setScene(described.scene);
	}, [settings]);

	const handleTry = useCallback((key, value, index) => {
		if (key == null) {
			setTrying(null);
			return;
		}
		setTrying({key, value, index});
		if (SCENE_BY_KEY[key]) setScene(SCENE_BY_KEY[key]);
	}, []);

	const row = useMemo(() => describeRow(rowId, settings), [rowId, settings]);

	const handlePillFocus = useCallback(() => setPillFocused(true), []);
	const handlePillBlur = useCallback((ev) => {
		if (!ev.currentTarget.contains(ev.relatedTarget)) setPillFocused(false);
	}, []);

	const handleQueryChange = useCallback((ev) => setQuery(ev.target.value), []);
	const clearQuery = useCallback(() => setQuery(''), []);

	return (
		<div className={closing ? `${css.overlay} ${css.closing}` : css.overlay}>
			<PanelContainer className={css.livePanel} spotlightId='settings-panel-container'>
				<div className={css.liveTop} ref={topRef}>
					<div className={css.liveTitle}>{$L('Settings')}</div>
					<div className={css.pillWrap} ref={pillRef}>
						<PillContainer className={css.pill} spotlightId={PILL_ID} onFocus={handlePillFocus} onBlur={handlePillBlur}>
							{categories.map((c) => (
								<PillItem
									key={c.id}
									spotlightId={`pill-${c.id}`}
									data-selected={c.id === category}
									className={c.id === category ? `${css.pillItem} ${css.pillItemSelected}` : css.pillItem}
									style={c.id === category ? (accent ? {backgroundColor: toCssColor(accent), color: pillFocused ? undefined : readableInk(accent)} : {backgroundColor: t.accent}) : null}
									onFocus={() => setCategory(c.id)}
									onClick={() => setCategory(c.id)}
								>
									{c.label}
								</PillItem>
							))}
						</PillContainer>
					</div>
					{!settings.kidsModeEnabled && (
						<div className={css.searchSlot}>
							<SearchBar value={query} onChange={handleQueryChange} />
						</div>
					)}
				</div>
				<div className={css.liveBody}>
					<div className={css.listColumn} ref={listRef} onFocus={handleListFocus}>
						<Settings
							panelMode
							liveCategory={category}
							onRootBack={handleRootBack}
							onPreviewTry={handleTry}
							liveSearchQuery={settings.kidsModeEnabled ? '' : query}
							onLiveSearchClear={clearQuery}
							onBack={onClose}
							onLibrariesChanged={onLibrariesChanged}
							onRunSetupWizard={onRunSetupWizard}
							onSelectItem={onSelectItem}
							hasLiveTv={hasLiveTv}
						/>
					</div>
					<div className={css.previewColumn}>
						<SettingsLivePreview scene={scene} row={row} trying={trying} onPickScene={setScene} />
					</div>
				</div>
			</PanelContainer>
		</div>
	);
};

const SettingsPanel = ({initialView, onClose, onLibrariesChanged, onRunSetupWizard, onSelectItem, hasLiveTv}) => {
	const [closing, setClosing] = useState(false);
	const timerRef = useRef(null);

	useEffect(() => () => clearTimeout(timerRef.current), []);

	const handleClose = useCallback(() => {
		if (timerRef.current) return;
		if (document.documentElement.classList.contains('perf-low')) {
			onClose?.();
			return;
		}
		setClosing(true);
		timerRef.current = setTimeout(() => onClose?.(), CLOSE_MS);
	}, [onClose]);

	// Settings opened straight to one screen keeps the side drawer.
	if (!initialView) {
		return (
			<LiveSettingsLayout
				closing={closing}
				onClose={handleClose}
				onLibrariesChanged={onLibrariesChanged}
				onRunSetupWizard={onRunSetupWizard}
				onSelectItem={onSelectItem}
				hasLiveTv={hasLiveTv}
			/>
		);
	}

	return (
		<div className={closing ? `${css.overlay} ${css.closing}` : css.overlay}>
			<div className={css.scrim} onClick={handleClose} />
			<PanelContainer className={css.panel} spotlightId="settings-panel-container">
				<Settings
					panelMode
					initialView={initialView}
					onBack={handleClose}
					onLibrariesChanged={onLibrariesChanged}
					onRunSetupWizard={onRunSetupWizard}
					onSelectItem={onSelectItem}
					hasLiveTv={hasLiveTv}
				/>
			</PanelContainer>
		</div>
	);
};

export default SettingsPanel;
