import {useCallback, useEffect, useRef, useState} from 'react';
import $L from '@enact/i18n/$L';
import Spottable from '@enact/spotlight/Spottable';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import Spotlight from '@enact/spotlight';

import {ChevronDownIcon, LibrariesIcon, RefreshStateIcon} from '../icons/navIcons';
import useLibraryRefresh from '../../hooks/useLibraryRefresh';
import {pointerHover} from '../../utils/focusScroll';
import {KEYS} from '../../utils/keys';
import SidebarItem from './SidebarItem';

import css from './Sidebar.module.less';

const LibrariesContainer = SpotlightContainerDecorator({
	enterTo: 'last-focused'
}, 'div');

const SpottableButton = Spottable('button');

// Collapsible list of the user's libraries. It stays in the DOM while closed so
// the expand animation has something to grow, and only becomes focusable once
// it's actually open.
const SidebarLibraries = ({libraries, slot, expanded, onToggle, onSelectLibrary}) => {
	const {canRefresh, note, refreshAll} = useLibraryRefresh();
	const rowRef = useRef(null);
	// The scan button can only be reached by pressing Right from the row, so Up and Down never land on it.
	const [reachable, setReachable] = useState(false);

	const reachableRef = useRef(false);

	useEffect(() => {
		reachableRef.current = reachable;
		const button = reachable && rowRef.current && rowRef.current.querySelector('[data-refresh-all]');
		if (button) Spotlight.focus(button);
	}, [reachable]);

	const handleRefreshBlur = useCallback(() => setReachable(false), []);

	// Right from the row goes to the scan button beside it, where the sidebar would otherwise take Right as the way out
	// to the content, and Left from the button comes back. Right from the button is the way out.
	const handleRowKeyDown = useCallback((e) => {
		if (!rowRef.current) return;
		const button = rowRef.current.querySelector('[data-refresh-all]');
		if (!button) return;
		const onButton = Boolean(e.target.closest('[data-refresh-all]'));
		if (e.keyCode === KEYS.RIGHT && !onButton) {
			e.preventDefault();
			e.stopPropagation();
			// Already reachable when the button was just left by the pointer and is still open
			if (reachableRef.current) Spotlight.focus(button);
			else setReachable(true);
		} else if (e.keyCode === KEYS.LEFT && onButton) {
			e.preventDefault();
			e.stopPropagation();
			Spotlight.focus(rowRef.current.querySelector('button:not([data-refresh-all])'));
		}
	}, []);
	const handleLibraryClick = useCallback((e) => {
		const libId = e.currentTarget.dataset.libraryId;
		const lib = libraries.find(l => l.Id === libId);
		if (lib) onSelectLibrary?.(lib);
	}, [libraries, onSelectLibrary]);

	const handleLibraryFocus = useCallback((e) => {
		if (pointerHover()) return;
		e.target?.scrollIntoView?.({behavior: 'smooth', block: 'nearest'});
	}, []);

	return (
		<div>
			{/* The scan button rides on the Libraries row itself, on its right, and Right from the row focuses it. */}
			<div className={css.librariesRow} ref={rowRef} onKeyDown={handleRowKeyDown}>
			<SidebarItem
				Icon={LibrariesIcon}
				slot={slot}
				label={$L('Libraries')}
				onClick={onToggle}
				className={`${css.librariesToggle} ${expanded ? css.librariesExpandedState : ''}`}
			>
				<ChevronDownIcon className={css.chevron} />
			</SidebarItem>
			{canRefresh && (
				<SpottableButton className={css.refreshAllBtn} onClick={refreshAll} spotlightDisabled={!reachable} onBlur={handleRefreshBlur} data-refresh-all="true" aria-label={$L('Refresh all libraries')}>
					<RefreshStateIcon key={note} className={`${css.refreshAllIcon} ${note === 'busy' ? css.refreshSpin : note === 'started' || note === 'failed' ? css.refreshPop : ''}`} state={note} />
				</SpottableButton>
			)}
			</div>

			<LibrariesContainer
				className={`${css.librariesList} ${expanded ? css.librariesListExpanded : ''}`}
				spotlightDisabled={!expanded}
			>
				{libraries.map((lib, index) => (
					<SpottableButton
						key={lib.Id}
						className={css.libraryItem}
						onClick={handleLibraryClick}
						onFocus={handleLibraryFocus}
						data-library-id={lib.Id}
						data-nav-slot={(index % 16) + 1}
					>
						<span className={css.libraryName}>{lib.Name}</span>
					</SpottableButton>
				))}
			</LibrariesContainer>
		</div>
	);
};

export default SidebarLibraries;
