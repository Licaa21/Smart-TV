import {createContext, useCallback, useContext, useRef, useState} from 'react';

import {useSettings} from '../../context/SettingsContext';
import {SettingsGlyph} from './settingsIcons';
import {SpottableDiv, ViewContainer} from './settingsSpottables';

import css from './Settings.module.less';

// The label a screen was opened with, for the screens that don't name themselves
export const SettingsTitleContext = createContext(null);
// Whether the screen being drawn was just pushed, which is when it slides in
export const SettingsEnterContext = createContext(false);

// A focused row scrolls to sit 90% of the way down the list
const FOLLOW_ALIGNMENT = 0.9;
const FOLLOW_MS = 120;

const isPerfHigh = () => document.documentElement.classList.contains('perf-high');

const easeOut = (t) => 1 - Math.pow(1 - t, 3);

const scrollListTo = (list, top) => {
	if (list._settingsScroll) window.cancelAnimationFrame(list._settingsScroll);
	const from = list.scrollTop;
	if (!isPerfHigh() || Math.abs(top - from) < 1) {
		list.scrollTop = top;
		return;
	}
	const start = Date.now();
	const step = () => {
		const t = Math.min(1, (Date.now() - start) / FOLLOW_MS);
		list.scrollTop = from + (top - from) * easeOut(t);
		list._settingsScroll = t < 1 ? window.requestAnimationFrame(step) : null;
	};
	list._settingsScroll = window.requestAnimationFrame(step);
};

// Lines the focused row up within the list. The row is measured on screen, since Settings Size can zoom it
export const followFocus = (ev) => {
	const list = ev.currentTarget;
	const target = ev.target;
	if (!list || !target || target === list) return;
	let rowTop;
	let rowHeight;
	const zoomed = target.closest('[data-settings-zoom]');
	if (zoomed && list.contains(zoomed)) {
		// Older engines report a zoomed row in its own unzoomed units while the list is in screen ones. The zoomed
		// block is as wide as the list on screen, so how wide it reports itself says which of the two it is.
		const frame = zoomed.getBoundingClientRect();
		const row = target.getBoundingClientRect();
		const scale = frame.width > 0 ? list.clientWidth / frame.width : 1;
		rowTop = (row.top - frame.top) * scale;
		rowHeight = row.height * scale;
	} else {
		const row = target.getBoundingClientRect();
		rowTop = row.top - list.getBoundingClientRect().top + list.scrollTop;
		rowHeight = row.height;
	}
	const view = list.clientHeight;
	const wanted = rowTop - FOLLOW_ALIGNMENT * (view - rowHeight);
	const top = Math.max(0, Math.min(list.scrollHeight - view, wanted));
	scrollListTo(list, top);
};

// The frame every settings screen sits in: a title that stays put, anything pinned under it,
// then the list. Each screen is a single spotlight container, which is also what the focus
// fallback lands on when a screen has nothing better to offer.
const SettingsView = ({spotlightId, title, root, header, clean, action, children}) => {
	const fallbackTitle = useContext(SettingsTitleContext);
	// The rows and text shrink with the Settings Size pick, and the window around them stays as it is
	const {settings} = useSettings();
	const zoom = settings.settingsScale > 0 && settings.settingsScale < 1 ? settings.settingsScale : null;
	const entering = useContext(SettingsEnterContext);
	const shownTitle = title ?? fallbackTitle;
	// The first screen's title takes a tint while the list is scrolled under it
	const [scrolled, setScrolled] = useState(false);
	const scrolledRef = useRef(false);
	const handleScroll = useCallback((ev) => {
		const next = ev.currentTarget.scrollTop > 0;
		if (next !== scrolledRef.current) {
			scrolledRef.current = next;
			setScrolled(next);
		}
	}, []);

	let className = css.viewContainer;
	if (entering) className += ` ${css.pageEnter}`;
	if (clean) className += ` ${css.cleanType}`;

	return (
		<ViewContainer className={className} spotlightId={spotlightId} data-settings-page>
			{shownTitle && (
				<div className={scrolled ? `${css.appBar} ${css.appBarScrolled}` : css.appBar}>
					<div className={root ? `${css.appBarTitle} ${css.appBarTitleRoot}` : css.appBarTitle}>{shownTitle}</div>
					{action}
				</div>
			)}
			{header}
			<div className={css.listContent} onFocus={followFocus} onScroll={root ? handleScroll : undefined}>
				<div className={css.listInner} style={zoom ? {zoom} : undefined} data-settings-zoom={zoom || undefined}>
					{children}
				</div>
			</div>
		</ViewContainer>
	);
};

// The one action a screen can carry on the right of its title, such as refresh or reset
export const TitleAction = ({icon, label, onClick}) => (
	<SpottableDiv className={css.appBarAction} onClick={onClick} spotlightId='settings-title-action' aria-label={label}>
		<SettingsGlyph name={icon} />
	</SpottableDiv>
);

export default SettingsView;
