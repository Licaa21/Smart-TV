import {useCallback, useEffect, useRef, useState} from 'react';
import $L from '@enact/i18n/$L';
import Spottable from '@enact/spotlight/Spottable';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import Spotlight from '@enact/spotlight';

import useLibraryRefresh from '../../hooks/useLibraryRefresh';
import {pointerHover} from '../../utils/focusScroll';
import {LibrariesIcon} from '../icons/navIcons';
import NavPillButton from './NavPillButton';

import css from './NavBar.module.less';

const PILL_ID = 'navbar-libraries';

// Coming into the group lands on the pill rather than on whichever library button is
// nearest, so arriving from the right doesn't drop you at the end of an open list with
// the whole list to walk back through. enterTo does nothing without an element named
// alongside it.
const LibrariesContainer = SpotlightContainerDecorator({
	enterTo: 'default-element',
	defaultElement: `.${css.librariesBtn}`
}, 'div');

const SpottableButton = Spottable('button');

const BLUR_GRACE = 100;
const FOCUS_DELAY = 50;

// The libraries drop down. It closes once focus leaves the group, after a short
// grace period so moving between its own buttons doesn't collapse it.
//
// Opened with a pointer it stays until a click lands outside it or picks a
// library. Hover is what focuses under a pointer, so closing on blur would
// collapse it the moment the cursor drifted off, and the list wraps so every
// library is on screen to click rather than in a strip to scroll.
const NavLibraries = ({libraries, slot, activeView, onSelectLibrary, leftTargetId, onMenuOpen}) => {
	const [expanded, setExpanded] = useState(false);
	const [byPointer, setByPointer] = useState(false);
	const blurTimeoutRef = useRef(null);
	const listRef = useRef(null);
	const {canRefresh, note, refreshAll} = useLibraryRefresh();

	useEffect(() => {
		return () => {
			if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
		};
	}, []);

	useEffect(() => {
		if (!expanded) return undefined;
		const timer = setTimeout(() => {
			// A press that beats this timer keeps whatever it landed on, rather than being
			// undone by focus arriving late.
			const current = Spotlight.getCurrent();
			if (current && !current.classList.contains(css.librariesBtn)) return;
			// On the first library, since the button before it scans the whole server and is not one to land on by mistake.
			const firstLibBtn = listRef.current?.querySelector('[data-library-id]');
			if (firstLibBtn) Spotlight.focus(firstLibBtn);
		}, FOCUS_DELAY);
		return () => clearTimeout(timer);
	}, [expanded]);

	// The bar has to know, since the panel hangs off the centre wrapper rather
	// than off the group itself.
	useEffect(() => {
		onMenuOpen?.(expanded && byPointer);
	}, [expanded, byPointer, onMenuOpen]);

	useEffect(() => {
		if (!expanded || !byPointer) return undefined;
		const onClickOutside = (e) => {
			if (!e.target.closest?.(`.${css.librariesGroup}`)) setExpanded(false);
		};
		document.addEventListener('click', onClickOutside, true);
		return () => document.removeEventListener('click', onClickOutside, true);
	}, [expanded, byPointer]);

	const handleToggle = useCallback(() => {
		if (!libraries?.length) return;
		setByPointer(pointerHover());
		setExpanded(prev => !prev);
	}, [libraries]);

	const handleFocus = useCallback(() => {
		if (blurTimeoutRef.current) {
			clearTimeout(blurTimeoutRef.current);
			blurTimeoutRef.current = null;
		}
	}, []);

	const handleBlur = useCallback((e) => {
		if (pointerHover()) return;
		const container = e.currentTarget;
		blurTimeoutRef.current = setTimeout(() => {
			if (!container.contains(document.activeElement)) setExpanded(false);
		}, BLUR_GRACE);
	}, []);

	const handleSpotlightLeft = useCallback((e) => {
		e.preventDefault();
		e.stopPropagation();
		if (!Spotlight.focus(leftTargetId)) Spotlight.move('left');
	}, [leftTargetId]);

	// The pill sits alongside the list rather than above it, so up has nothing to find
	// on its own and gets sent back by hand.
	const handleLibraryUp = useCallback((e) => {
		e.preventDefault();
		e.stopPropagation();
		Spotlight.focus(PILL_ID);
	}, []);

	const handleLibraryClick = useCallback((e) => {
		const libId = e.currentTarget.dataset.libraryId;
		const lib = libraries.find(l => l.Id === libId);
		if (!lib) return;
		setExpanded(false);
		onSelectLibrary?.(lib);
	}, [libraries, onSelectLibrary]);

	return (
		<LibrariesContainer
			className={[css.librariesGroup, expanded && css.expanded, expanded && byPointer && css.wrapped].filter(Boolean).join(' ')}
			onFocus={handleFocus}
			onBlur={handleBlur}
		>
			<NavPillButton
				Icon={LibrariesIcon}
				slot={slot}
				label={$L('Libraries')}
				onClick={handleToggle}
				spotlightId={PILL_ID}
				className={css.librariesBtn}
				onSpotlightLeft={handleSpotlightLeft}
			/>
			<div className={css.librariesList} ref={listRef}>
				{expanded && canRefresh && (
					<SpottableButton
						className={`${css.navBtn} ${css.libraryBtn} ${css.refreshAllBtn}`}
						onClick={refreshAll}
						onSpotlightUp={handleLibraryUp}
						data-nav-slot={1}
					>
						<span className={css.navLabel}>{note === 'started' ? $L('Refresh started') : note === 'failed' ? $L('Refresh failed') : $L('Refresh all libraries')}</span>
					</SpottableButton>
				)}
				{expanded && libraries.map((lib, index) => (
					<SpottableButton
						key={lib.Id}
						className={`${css.navBtn} ${css.libraryBtn} ${activeView === lib.Id ? css.active : ''}`}
						onClick={handleLibraryClick}
						onSpotlightUp={handleLibraryUp}
						data-library-id={lib.Id}
						data-nav-slot={(index % 16) + 1}
					>
						<span className={css.navLabel}>{lib.Name}</span>
					</SpottableButton>
				))}
			</div>
		</LibrariesContainer>
	);
};

export default NavLibraries;
