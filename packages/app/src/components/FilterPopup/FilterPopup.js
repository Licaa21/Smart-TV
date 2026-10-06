import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import Spotlight from '@enact/spotlight';
import Spottable from '@enact/spotlight/Spottable';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import $L from '@enact/i18n/$L';

import {isBackKey} from '../../utils/keys';
import {keepFocusInView} from '../../utils/focusScroll';

import css from './FilterPopup.module.less';

const SpottableButton = Spottable('button');

// The popup holds the remote, so a press at its edge never reaches what is behind it.
const PopupContainer = SpotlightContainerDecorator({
	enterTo: 'default-element',
	defaultElement: '[data-filter-active="true"]',
	restrict: 'self-only',
	leaveFor: {left: '', right: '', up: '', down: ''},
	preserveId: true
}, 'div');

const GroupList = SpotlightContainerDecorator({
	enterTo: 'default-element',
	defaultElement: '[data-filter-active="true"]'
}, 'div');

const OptionsPane = SpotlightContainerDecorator({
	enterTo: 'default-element',
	defaultElement: '[data-selected="true"]'
}, 'div');

const stopPropagation = (e) => e.stopPropagation();

/**
 * One choice inside a group, a radio dot for a single pick and a box for a set of them.
 */
export const FilterOption = ({label, selected = false, multi = false, plain = false, onClick, spotlightId, ...rest}) => (
	<SpottableButton
		className={`${css.option} ${selected ? css.optionSelected : ''}`}
		data-selected={selected ? 'true' : undefined}
		onClick={onClick}
		spotlightId={spotlightId}
		{...rest}
	>
		{!plain && (
			<span className={multi ? css.checkbox : css.radio}>
				{selected && (multi
					? <svg viewBox="0 0 24 24" className={css.checkIcon}><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
					: <span className={css.radioFill} />)}
			</span>
		)}
		<span className={css.optionLabel}>{label}</span>
	</SpottableButton>
);

/**
 * A filter button's popup. The groups are listed down the left with what each is set to, and the
 * options of the one in focus are laid out beside them in columns, so a long list is a short grid
 * instead of a column to scroll, and nothing has to be scrolled back to in order to close it.
 * Choices apply as they are made. BACK or Done closes it.
 *
 * `groups` is a list of {key, title, summary, body}, where `body` returns the group's options and
 * is only called while the group is showing. `onClear` puts every group back and is offered only
 * while `canClear` is set. `defaultGroup` names the group that opens first.
 */
const FilterPopup = ({title, groups, onClose, onClear, canClear = false, defaultGroup, onGroupChange, spotlightId = 'filter-popup'}) => {
	const list = useMemo(() => (groups || []).filter(Boolean), [groups]);
	const [activeKey, setActiveKey] = useState(defaultGroup || list[0]?.key);
	const active = list.find((group) => group.key === activeKey) || list[0];

	// A group that has gone, such as a facet the library no longer holds, hands over to the first.
	useEffect(() => {
		if (active && active.key !== activeKey) setActiveKey(active.key);
	}, [active, activeKey]);

	// The popup takes the remote as it opens, landing on the group that is showing, and hands it
	// back to the button that opened it when it goes, so closing never leaves the remote nowhere.
	const defaultGroupRef = useRef(defaultGroup || list[0]?.key);
	const singleRef = useRef(list.length === 1);
	const openerRef = useRef(typeof document !== 'undefined' ? document.activeElement : null);
	useEffect(() => {
		const frame = window.requestAnimationFrame(() => {
			// Opened with a pointer, the remote would otherwise stay on the button behind the popup.
			Spotlight.setPointerMode?.(false);
			// One group has no list to pick from, so the remote goes straight to its options.
			const first = defaultGroupRef.current;
			const target = singleRef.current ? `${spotlightId}-options` : `${spotlightId}-group-${first}`;
			if (!(first && Spotlight.focus(target))) Spotlight.focus(spotlightId);
		});
		const opener = openerRef.current;
		return () => {
			window.cancelAnimationFrame(frame);
			if (opener && opener.isConnected && opener !== document.body) {
				window.requestAnimationFrame(() => {
					if (!Spotlight.focus(opener) && opener.focus) opener.focus();
				});
			}
		};
	}, [spotlightId]);

	const handleKeyDown = useCallback((e) => {
		if (isBackKey(e)) {
			e.preventDefault();
			e.stopPropagation();
			onClose?.();
		}
	}, [onClose]);

	// A group's own state, such as a search typed into it, is the screen's to put back when the
	// viewer moves to another.
	const shownKey = active?.key;
	const shownRef = useRef(shownKey);
	useEffect(() => {
		if (shownRef.current === shownKey) return;
		shownRef.current = shownKey;
		onGroupChange?.(shownKey);
	}, [shownKey, onGroupChange]);

	const handleGroupFocus = useCallback((e) => {
		const key = e.currentTarget.dataset.groupKey;
		if (key) setActiveKey(key);
	}, []);

	// Selecting a group hands the remote to its options.
	const handleGroupSelect = useCallback((e) => {
		const key = e.currentTarget.dataset.groupKey;
		if (key) setActiveKey(key);
		Spotlight.focus(`${spotlightId}-options`);
	}, [spotlightId]);

	return (
		<div className={css.overlay} onClick={onClose}>
			<PopupContainer
				className={`${css.popup} ${list.length > 1 ? '' : css.popupSingle}`}
				spotlightId={spotlightId}
				onClick={stopPropagation}
				onKeyDown={handleKeyDown}
			>
				<div className={css.header}>
					<h2 className={css.title}>{title}</h2>
					<div className={css.headerActions}>
						{canClear && onClear && (
							<SpottableButton className={css.headerButton} onClick={onClear} spotlightId={`${spotlightId}-clear`}>
								{$L('Clear Filters')}
							</SpottableButton>
						)}
						<SpottableButton className={css.headerButton} onClick={onClose} spotlightId={`${spotlightId}-done`}>
							{$L('Done')}
						</SpottableButton>
					</div>
				</div>
				<div className={css.body}>
					{list.length > 1 && <GroupList className={css.groups} spotlightId={`${spotlightId}-groups`}>
						{list.map((group) => (
							<SpottableButton
								key={group.key}
								className={`${css.group} ${group === active ? css.groupActive : ''}`}
								data-group-key={group.key}
								data-filter-active={group === active ? 'true' : undefined}
								onFocus={handleGroupFocus}
								onClick={handleGroupSelect}
								spotlightId={`${spotlightId}-group-${group.key}`}
							>
								<span className={css.groupTitle}>{group.title}</span>
								{group.summary ? <span className={css.groupSummary}>{group.summary}</span> : null}
							</SpottableButton>
						))}
					</GroupList>}
					<OptionsPane
						className={`${css.pane} ${list.length > 1 ? '' : css.paneAlone}`}
						spotlightId={`${spotlightId}-options`}
						onFocus={keepFocusInView}
					>
						{active && list.length > 1 && <h3 className={css.paneTitle}>{active.title}</h3>}
						<div className={css.options}>{active ? active.body() : null}</div>
					</OptionsPane>
				</div>
			</PopupContainer>
		</div>
	);
};

export default FilterPopup;
