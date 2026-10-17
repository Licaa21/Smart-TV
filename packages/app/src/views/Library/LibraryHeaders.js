// The pieces of the library header that the Classic, Modern and Docked styles share or
// swap in. Each one is memoized, since the screen around them redraws on every focus move
// to show the focused item and none of this changes with it.

import {memo} from 'react';
import $L from '@enact/i18n/$L';
import Spottable from '@enact/spotlight/Spottable';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import SpottableInput from '../../components/SpottableInput/SpottableInput';
import {LETTERS, createPanelKeyDown, createToolbarKeyDown} from '../../utils/gridChrome';

import css from './Library.module.less';

const SpottableButton = Spottable('button');
const ToolbarContainer = SpotlightContainerDecorator({enterTo: 'last-focused', restrict: 'self-first'}, 'div');

export const SEARCH_ICON = 'M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z';
export const HOME_ICON = 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z';
export const SORT_ICON = 'm80-280 162-400h63l161 400h-63l-38-99H181l-38 99H80Zm121-151h144l-70-185h-4l-70 185Zm347 151v-62l233-286H566v-52h272v63L607-332h233v52H548ZM384-784l96-96 96 96H384Zm96 704-96-96h192l-96 96Z';
export const SETTINGS_ICON = 'm388-80-20-126q-19-7-40-19t-37-25l-118 54-93-164 108-79q-2-9-2.5-20.5T185-480q0-9 .5-20.5T188-521L80-600l93-164 118 54q16-13 37-25t40-18l20-127h184l20 126q19 7 40.5 18.5T669-710l118-54 93 164-108 77q2 10 2.5 21.5t.5 21.5q0 10-.5 21t-2.5 21l108 78-93 164-118-54q-16 13-36.5 25.5T592-206L572-80H388Zm48-60h88l14-112q33-8 62.5-25t53.5-41l106 46 40-72-94-69q4-17 6.5-33.5T715-480q0-17-2-33.5t-7-33.5l94-69-40-72-106 46q-23-26-52-43.5T538-708l-14-112h-88l-14 112q-34 7-63.5 24T306-642l-106-46-40 72 94 69q-4 17-6.5 33.5T245-480q0 17 2.5 33.5T254-413l-94 69 40 72 106-46q24 24 53.5 41t62.5 25l14 112Zm44-210q54 0 92-38t38-92q0-54-38-92t-92-38q-54 0-92 38t-38 92q0 54 38 92t92 38Zm0-130Z';
const ARROW_UP_ICON = 'M440-160v-487L216-423l-56-57 320-320 320 320-56 57-224-224v487h-80Z';
const ARROW_DOWN_ICON = 'M440-800v487L216-537l-56 57 320 320 320-320-56-57-224 224v-487h-80Z';
const GROUP_ICON = 'M12 2l-5.5 9h11L12 2zm0 3.84L13.93 9h-3.87L12 5.84zM17.5 13c-2.49 0-4.5 2.01-4.5 4.5s2.01 4.5 4.5 4.5 4.5-2.01 4.5-4.5-2.01-4.5-4.5-4.5zm0 7c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5zM3 21.5h8v-8H3v8zm2-6h4v4H5v-4z';
const SHOW_ICON = 'M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z';
const DISPLAY_ICON = 'M3 3v8h8V3H3zm6 6H5V5h4v4zm-6 4v8h8v-8H3zm6 6H5v-4h4v4zm4-16v8h8V3h-8zm6 6h-4V5h4v4zm-6 4v8h8v-8h-8zm6 6h-4v-4h4v4z';

// The Modern letter row sits under the bar, so Up goes back to it rather than to
// whichever bar control happens to be above the letter.
const handleLetterRowKeyDown = createToolbarKeyDown('library-grid', 'library-bar');

// The five-way would take Home on to the search under it rather than over to the grid.
const handleDockKeyDown = createPanelKeyDown('library-grid-area');

export const LibraryTitle = memo(({isFolderView, folderStack, rootName, displayName, shownCount, onBreadcrumb}) => (
	isFolderView && folderStack.length > 0 ? (
		<div className={css.breadcrumb}>
			<SpottableButton
				className={css.breadcrumbItem}
				onClick={onBreadcrumb}
				data-depth={0}
				spotlightId="breadcrumb-root"
			>
				{rootName}
			</SpottableButton>
			{folderStack.map((f, i) => (
				<span key={f.id} className={css.breadcrumbSegment}>
					<span className={css.breadcrumbSep}>›</span>
					{i < folderStack.length - 1 ? (
						<SpottableButton
							className={css.breadcrumbItem}
							onClick={onBreadcrumb}
							data-depth={i + 1}
						>
							{f.name}
						</SpottableButton>
					) : (
						<span className={css.breadcrumbCurrent}>{f.name}</span>
					)}
				</span>
			))}
			<div className={css.itemCount}>{shownCount} {$L('Items')}</div>
		</div>
	) : (
		<>
			<div className={css.libraryTitle}>{displayName}</div>
			<div className={css.itemCount}>{shownCount} {$L('Items')}</div>
		</>
	)
));

export const Letters = memo(({startLetter, onSelect}) => LETTERS.map((letter, index) => (
	<SpottableButton
		key={letter}
		className={`${css.letterButton} ${startLetter === letter ? css.active : ''}`}
		onClick={onSelect}
		data-letter={letter}
		spotlightId={index === 0 ? 'library-letter-hash' : undefined}
	>
		{letter}
	</SpottableButton>
)));

const Icon = ({path, small}) => (
	<svg className={css.pillIcon} viewBox={small ? '0 0 24 24' : '0 -960 960 960'}>
		<path d={path} />
	</svg>
);

const SortArrow = ({ascending}) => (
	<svg className={css.pillArrow} viewBox="0 -960 960 960">
		<path d={ascending ? ARROW_UP_ICON : ARROW_DOWN_ICON} />
	</svg>
);

const Search = ({className, value, onChange}) => (
	<div className={`${css.searchWrap} ${className}`}>
		<svg className={css.searchIcon} viewBox="0 -960 960 960">
			<path d={SEARCH_ICON} />
		</svg>
		<SpottableInput
			type="text"
			className={css.searchField}
			placeholder={$L('Search this library...')}
			value={value}
			onChange={onChange}
			spotlightId="library-search"
			autoComplete="off"
		/>
	</div>
);

const IconButton = ({path, small, onClick, spotlightId}) => (
	<SpottableButton className={css.barButton} onClick={onClick} spotlightId={spotlightId}>
		<svg className={css.toolbarIcon} viewBox={small ? '0 0 24 24' : '0 -960 960 960'}>
			<path d={path} />
		</svg>
	</SpottableButton>
);

// One bar with every control in it, each labelled with what it is set to.
export const ModernBar = memo(({
	canGroup, sortLabel, sortAscending, groupLabel, showLabel, searchQuery,
	onSearchChange, onHome, onSort, onGroup, onShow, onSettings, onKeyDown
}) => (
	<ToolbarContainer className={css.modernBar} spotlightId="library-bar" onKeyDown={onKeyDown}>
		<IconButton path={HOME_ICON} small onClick={onHome} spotlightId="library-home-btn" />
		<Search className={css.barSearch} value={searchQuery} onChange={onSearchChange} />
		<SpottableButton className={css.barPill} onClick={onSort} spotlightId="library-sort-btn">
			<Icon path={SORT_ICON} />
			<span className={css.pillLabel}>{$L('Sort')}</span>
			<span className={css.pillValue}>{sortLabel}</span>
			<SortArrow ascending={sortAscending} />
		</SpottableButton>
		{canGroup && (
			<SpottableButton className={css.barPill} onClick={onGroup} spotlightId="library-group-btn">
				<Icon path={GROUP_ICON} small />
				<span className={css.pillLabel}>{$L('Group')}</span>
				<span className={css.pillValue}>{groupLabel}</span>
			</SpottableButton>
		)}
		<SpottableButton className={css.barPill} onClick={onShow} spotlightId="library-show-btn">
			<Icon path={SHOW_ICON} small />
			<span className={css.pillLabel}>{$L('Show')}</span>
			<span className={css.pillValue}>{showLabel}</span>
		</SpottableButton>
		<IconButton path={SETTINGS_ICON} onClick={onSettings} spotlightId="library-settings-btn" />
	</ToolbarContainer>
));

export const ModernLetters = memo(({startLetter, onSelect}) => (
	<ToolbarContainer className={css.letterRow} spotlightId="library-letters" onKeyDown={handleLetterRowKeyDown}>
		<Letters startLetter={startLetter} onSelect={onSelect} />
	</ToolbarContainer>
));

const DockRow = ({path, small, label, value, onClick, spotlightId, children}) => (
	<SpottableButton className={css.dockRow} onClick={onClick} spotlightId={spotlightId}>
		<Icon path={path} small={small} />
		<span className={css.dockRowLabel}>{label}</span>
		<span className={css.pillValue}>{value}</span>
		{children}
	</SpottableButton>
);

// The panel down the left side. Focus coming back to it lands on whichever control in it
// was used last.
export const LibraryDock = memo(({
	isFolderView, folderStack, rootName, displayName, shownCount, onBreadcrumb,
	canGroup, sortLabel, sortAscending, groupLabel, showLabel, displayLabel, searchQuery,
	showLetters, startLetter, onLetterSelect,
	onSearchChange, onHome, onSort, onGroup, onShow, onSettings
}) => (
	<ToolbarContainer className={css.dock} spotlightId="library-dock" onKeyDown={handleDockKeyDown}>
		<div className={css.dockHeader}>
			<IconButton path={HOME_ICON} small onClick={onHome} spotlightId="library-home-btn" />
			<div className={css.dockTitle}>
				<LibraryTitle
					isFolderView={isFolderView}
					folderStack={folderStack}
					rootName={rootName}
					displayName={displayName}
					shownCount={shownCount}
					onBreadcrumb={onBreadcrumb}
				/>
			</div>
		</div>
		<Search className={css.dockSearch} value={searchQuery} onChange={onSearchChange} />
		<div className={css.dockRows}>
			<DockRow path={SORT_ICON} label={$L('Sort By')} value={sortLabel} onClick={onSort} spotlightId="library-sort-btn">
				<SortArrow ascending={sortAscending} />
			</DockRow>
			{canGroup && <DockRow path={GROUP_ICON} small label={$L('Group By')} value={groupLabel} onClick={onGroup} spotlightId="library-group-btn" />}
			<DockRow path={SHOW_ICON} small label={$L('Show')} value={showLabel} onClick={onShow} spotlightId="library-show-btn" />
			<DockRow path={DISPLAY_ICON} small label={$L('Display')} value={displayLabel} onClick={onSettings} spotlightId="library-settings-btn" />
		</div>
		{showLetters && (
			<div className={css.dockLetters}>
				<div className={css.letterGrid}>
					<Letters startLetter={startLetter} onSelect={onLetterSelect} />
				</div>
			</div>
		)}
	</ToolbarContainer>
));
