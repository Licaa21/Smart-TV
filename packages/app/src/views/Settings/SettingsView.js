import {createContext, useCallback, useContext, useLayoutEffect, useRef, useState} from 'react';

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

// Lines the focused row up within the list. The row is measured on screen, since Settings Size can scale it
export const followFocus = (ev) => {
	const list = ev.currentTarget;
	const target = ev.target;
	if (!list || !target || target === list) return;
	const row = target.getBoundingClientRect();
	const rowTop = row.top - list.getBoundingClientRect().top + list.scrollTop;
	const rowHeight = row.height;
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
	// The rows, their boxes and the text shrink with the Settings Size pick, and the window around them stays as it
	// is. The list is laid out wider by the same factor and scaled down to fit, so everything in it shrinks together
	// whichever engine the set has. The frame around it is given the height the scaled list ends up with.
	const {settings} = useSettings();
	const zoom = settings.settingsScale > 0 && settings.settingsScale < 1 ? settings.settingsScale : null;
	const frameRef = useRef(null);
	const innerRef = useRef(null);
	useLayoutEffect(() => {
		const frame = frameRef.current;
		const inner = innerRef.current;
		if (!zoom || !frame || !inner) return undefined;
		const fit = () => { frame.style.height = `${Math.ceil(inner.offsetHeight * zoom)}px`; };
		fit();
		if (typeof window.ResizeObserver !== 'function') return undefined;
		const observer = new window.ResizeObserver(fit);
		observer.observe(inner);
		return () => observer.disconnect();
	}, [zoom]);
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
				{zoom ? (
					<div ref={frameRef}>
						<div
							ref={innerRef}
							className={css.listInner}
							data-settings-zoom={zoom}
							style={{
								width: `${100 / zoom}%`,
								transform: `scale(${zoom})`,
								WebkitTransform: `scale(${zoom})`,
								transformOrigin: '0 0',
								WebkitTransformOrigin: '0 0'
							}}
						>
							{children}
						</div>
					</div>
				) : (
					<div className={css.listInner}>
						{children}
					</div>
				)}
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
