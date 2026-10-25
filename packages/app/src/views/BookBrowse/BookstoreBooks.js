import {memo, useCallback, useEffect, useRef, useState} from 'react';
import $L from '@enact/i18n/$L';
import Spotlight from '@enact/spotlight';
import Spottable from '@enact/spotlight/Spottable';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';

import LoadingSpinner from '../../components/LoadingSpinner';
import TrackOptionRow from '../../components/TrackOptionRow';
import {useSettings} from '../../context/SettingsContext';
import useItemMenuHold, {cardIndexOf} from '../../hooks/useItemMenuHold';
import {useStorage} from '../../hooks/useStorage';
import {
	SCOPE_ALL, availableScopes, bookImageUrl, bookProgressMeta, bookSubtitle, isAudiobookItem, isAudiobookLibrary,
	isComicItem, isEbookItem, isMixedLibrary, playedPercent, scopeLabel, titlesLabel
} from '../../utils/bookLibrary';
import {keepFocusInView} from '../../utils/focusScroll';
import {KEYS} from '../../utils/keys';
import {showsWatchedCheck} from '../../utils/playedState';
import {rem, rootScale} from '../../utils/rootScale';
import {ModalContainer} from '../../utils/spotlightContainers';
import LibrarySkeleton from '../Library/LibrarySkeleton';
import {BookEmptyState, BookIcon, formatIconName} from './BookCard';
import {bookMenuItem, openBookItem, readOrListen} from './bookNavigation';
import {TITLE_SORTS, readMore, sortById} from './bookstorePanes';
import useBookLibrary from './useBookLibrary';

import css from './BookstoreBooks.module.less';

const SpottableDiv = Spottable('div');
// Up, down and left stop at the rail's edges, and right goes back into the content by hand.
const RailContainer = SpotlightContainerDecorator({enterTo: 'last-focused', leaveFor: {up: '', down: '', left: ''}}, 'div');
// Coming back to the Continue row lands on the tile it was left on.
const RowContainer = SpotlightContainerDecorator({enterTo: 'last-focused'}, 'div');

// Sizes on the 1920 canvas, matched in the stylesheet.
const RAIL_WIDTH = 414;
const CONTENT_INSET = 40 + 80;
const GRID_GAP = 33;
const CARD_TARGET = 250;
const GENRE_TARGET = 367;
const FOCUS_ATTEMPTS = 6;

const SCOPE_ICONS = {all: 'library_books_outlined', books: 'menu_book_rounded', audiobooks: 'headphones_rounded', comics: 'auto_stories_rounded'};

const BROWSE_PANES = [
	{id: 'series', label: () => $L('Series'), icon: 'layers_outlined'},
	{id: 'authors', label: () => $L('Authors'), icon: 'person_outline_rounded'},
	{id: 'genres', label: () => $L('Genres'), icon: 'sell_outlined'},
	{id: 'collections', label: () => $L('Collections'), icon: 'collections_bookmark_outlined'},
	{id: 'favorites', label: () => $L('Favorites'), icon: 'favorite_border_rounded'}
];

// Panes read from the whole library, so they wait for it.
const LIBRARY_PANES = ['series', 'authors', 'collections'];

const TOOLBAR_FIRST = 'book-toolbar-search';
const SORT_BUTTON = 'book-toolbar-sort';
const CONTINUE_ROW = 'book-continue';
const cardId = (index) => `book-card-${index}`;
const railId = (entryId) => `book-rail-${entryId}`;

const consume = (e) => {
	e.preventDefault();
	e.stopPropagation();
};

// A row just added isn't registered with Spotlight on the frame it mounts.
const focusId = (id) => {
	let attempts = 0;
	const tryFocus = () => {
		if (Spotlight.focus(id)) return;
		attempts += 1;
		if (attempts < FOCUS_ATTEMPTS) window.requestAnimationFrame(tryFocus);
	};
	window.requestAnimationFrame(tryFocus);
};

const scopeRailLabel = (scope) => (scope === SCOPE_ALL ? $L('All Titles') : scopeLabel(scope));

const Cover = ({url, title}) => (
	url ? <img className={css.image} src={url} alt="" loading="lazy" /> : (
		<div className={css.placeholder}><span>{title}</span></div>
	)
);

// A title's card: the cover at 2:3 with its progress, or an audiobook's square cover over a strip
// with its time. A comic is marked as one where the library also holds other formats.
const TitleCard = memo(({item, index, serverUrl, width, height, mixed, watched, onClick}) => {
	const url = bookImageUrl(item._serverUrl || serverUrl, item);
	const audiobook = isAudiobookItem(item);
	const percent = playedPercent(item);
	const comicBadge = mixed && isComicItem(item);
	return (
		<SpottableDiv className={css.card} style={{width}} data-index={index} spotlightId={cardId(index)} onClick={onClick}>
			<div className={css.cover} style={{height}}>
				{audiobook ? (
					<div className={css.audioArt}>
						<div className={css.audioCover} style={{height: width}}><Cover url={url} title={item.Name} /></div>
						<div className={css.audioStrip}>
							<BookIcon name="headphones_rounded" className={css.audioIcon} />
							<span>{bookProgressMeta(item)}</span>
						</div>
					</div>
				) : <Cover url={url} title={item.Name} />}
				{comicBadge && <span className={css.comicBadge}><BookIcon name="auto_stories_rounded" className={css.badgeIcon} /></span>}
				{item.UserData?.IsFavorite && (
					<div className={`${css.favoriteBadge} ${comicBadge ? css.belowBadge : ''}`}>
						<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
					</div>
				)}
				{watched && showsWatchedCheck(item) && (
					<div className={css.watchedBadge}>
						<svg viewBox="0 0 24 24"><path fill="white" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
					</div>
				)}
				{!audiobook && percent > 0 && (
					<div className={css.progressBar}><div className={css.progress} style={{width: `${Math.min(percent, 100)}%`}} /></div>
				)}
			</div>
			<div className={css.title}>{item.Name}</div>
			<div className={css.subtitle}>{bookSubtitle(item)}</div>
		</SpottableDiv>
	);
});

// Series, authors, genres and collections.
const BrowseCard = memo(({item, index, serverUrl, width, height, round, subtitle, onClick}) => (
	<SpottableDiv className={css.card} style={{width}} data-index={index} spotlightId={cardId(index)} onClick={onClick}>
		<div className={`${css.cover} ${round ? css.round : ''}`} style={{height}}>
			<Cover url={bookImageUrl(item._serverUrl || serverUrl, item)} title={item.Name} />
		</div>
		<div className={css.title}>{item.Name}</div>
		{subtitle && <div className={css.subtitle}>{bookSubtitle(item)}</div>}
	</SpottableDiv>
));

const ListTile = memo(({item, index, serverUrl, onClick}) => {
	const url = bookImageUrl(item._serverUrl || serverUrl, item);
	const audiobook = isAudiobookItem(item);
	const percent = playedPercent(item);
	const meta = bookProgressMeta(item);
	const subtitle = bookSubtitle(item);
	return (
		<SpottableDiv className={css.listTile} data-index={index} spotlightId={cardId(index)} onClick={onClick}>
			<div className={css.listCoverSlot}>
				<div className={audiobook ? css.listCoverAudio : css.listCover}>
					{url ? <img src={url} alt="" loading="lazy" /> : <BookIcon name={audiobook ? 'headphones_rounded' : 'menu_book_rounded'} className={css.listPlaceholder} />}
				</div>
			</div>
			<div className={css.listText}>
				<div className={css.listTitle}>{item.Name}</div>
				{subtitle && <div className={css.listSubtitle}>{subtitle}</div>}
				{(percent > 0 || meta) && (
					<div className={css.listMeta}>
						{percent > 0 && <div className={css.listProgress}><div style={{width: `${Math.min(percent, 100)}%`}} /></div>}
						{meta && <span>{meta}</span>}
					</div>
				)}
			</div>
			{!isEbookItem(item) && <BookIcon name={formatIconName(item)} className={css.listFormatIcon} />}
		</SpottableDiv>
	);
});

// What's being read or heard. Select opens the title's details, and the play button, which only a
// pointer reaches, reads or plays it.
const ContinueTile = memo(({item, index, serverUrl, onPlay, onClick}) => {
	const url = bookImageUrl(item._serverUrl || serverUrl, item);
	const audiobook = isAudiobookItem(item);
	const percent = playedPercent(item);
	const meta = bookProgressMeta(item);
	const subtitle = bookSubtitle(item);
	const handlePlay = useCallback((e) => {
		e.stopPropagation();
		onPlay(item);
	}, [item, onPlay]);
	return (
		<SpottableDiv className={css.continueTile} data-index={index} onClick={onClick}>
			<div className={audiobook ? css.continueCoverAudio : css.continueCover}>
				{url ? <img src={url} alt="" loading="lazy" /> : <BookIcon name={audiobook ? 'headphones_rounded' : 'menu_book_rounded'} className={css.continuePlaceholder} />}
			</div>
			<div className={css.continueText}>
				<div className={css.continueTitle}>{item.Name}</div>
				{subtitle && <div className={css.continueSubtitle}>{subtitle}</div>}
				<div className={css.continueProgress}><div style={{width: `${Math.min(percent, 100)}%`}} /></div>
				{meta && <div className={css.continueMeta}>{meta}</div>}
			</div>
			<div className={css.continuePlay} onClick={handlePlay} aria-label={audiobook ? $L('Continue Listening') : $L('Continue Reading')}>
				<BookIcon name="play_arrow_rounded" />
			</div>
		</SpottableDiv>
	);
});

const SortDialog = ({active, onSelect, onClose}) => {
	const stopPropagation = useCallback((e) => e.stopPropagation(), []);
	const handleClick = useCallback((e) => onSelect(e.currentTarget.dataset.sortId), [onSelect]);
	return (
		<div className={css.sortOverlay} onClick={onClose}>
			<ModalContainer className={css.sortPanel} onClick={stopPropagation} spotlightId="book-sort-modal">
				<h2 className={css.sortTitle}>{$L('Sort By')}</h2>
				{TITLE_SORTS.map((sort) => (
					<TrackOptionRow key={sort.id} label={sort.label()} selected={sort.id === active} data-sort-id={sort.id} onClick={handleClick} />
				))}
			</ModalContainer>
		</div>
	);
};

// Bookstore: a rail of formats and browse lists down the left, and the open list as a grid under
// what's being read.
const BookstoreBooks = ({library, api, serverUrl, onSelectItem, onOpenGrid, onPlay, onSearch, backHandlerRef}) => {
	const {settings} = useSettings();
	const data = useBookLibrary({api, library, genreLimit: 6});
	const [view, setView] = useState({pane: 'titles', scope: SCOPE_ALL});
	const [storedSort, setStoredSort, sortLoaded] = useStorage(`book_sort_${library?.Id}`, 'dateAdded');
	const [listView, setListView] = useStorage('book_list_view', false);
	const [showSort, setShowSort] = useState(false);
	const [paneItems, setPaneItems] = useState([]);
	const [paneLoading, setPaneLoading] = useState(false);
	const sort = sortById(storedSort);

	const scrollerRef = useRef(null);
	const paneRef = useRef(null);
	const itemsRef = useRef(paneItems);
	itemsRef.current = paneItems;
	const lastCardRef = useRef(null);
	const landedRef = useRef(false);

	const mixed = isMixedLibrary(library, data.counts);
	const hasResume = data.resume.length > 0;
	const listsTitles = view.pane === 'titles' || view.pane === 'favorites';
	const showsList = listsTitles && Boolean(listView);
	const selectedRail = view.pane === 'titles' ? `scope-${view.scope}` : `pane-${view.pane}`;
	const watched = ['always', 'hideCount'].includes(settings.watchedIndicatorBehavior || 'always');

	const gridWidth = window.innerWidth / rootScale() - RAIL_WIDTH - CONTENT_INSET;
	const targetWidth = view.pane === 'genres' ? GENRE_TARGET : CARD_TARGET;
	const columns = showsList ? 1 : Math.max(2, Math.floor((gridWidth + GRID_GAP) / (targetWidth + GRID_GAP)));
	const cellWidth = Math.floor((gridWidth - GRID_GAP * (columns - 1)) / columns);
	const aspect = view.pane === 'genres' ? 16 / 9 : (view.pane === 'authors' ? 1 : 2 / 3);
	const columnsRef = useRef(columns);
	columnsRef.current = columns;

	const loadMore = useCallback(async () => {
		const pane = paneRef.current;
		if (!pane || pane.loading || !pane.hasMore) return;
		pane.loading = true;
		setPaneLoading(true);
		const result = await readMore(pane.ctx, pane.fetched, itemsRef.current).catch(() => null);
		if (paneRef.current !== pane) return;
		pane.loading = false;
		pane.hasMore = Boolean(result?.hasMore);
		if (result) {
			pane.fetched = result.fetched;
			itemsRef.current = itemsRef.current.concat(result.added);
			setPaneItems(itemsRef.current);
		}
		setPaneLoading(false);
	}, []);

	const paneData = LIBRARY_PANES.includes(view.pane) && !data.loading ? data : null;
	const waitsForLibrary = LIBRARY_PANES.includes(view.pane) && !paneData;
	useEffect(() => {
		if (!api || !library?.Id || !sortLoaded || waitsForLibrary) return;
		paneRef.current = {
			ctx: {api, library, pane: view.pane, scope: view.scope, sort, untyped: false, series: paneData?.series, collections: paneData?.collections, titles: paneData?.titles},
			fetched: 0,
			hasMore: true,
			loading: false
		};
		itemsRef.current = [];
		setPaneItems([]);
		loadMore();
	}, [api, library, view, sort, sortLoaded, paneData, waitsForLibrary, loadMore]);

	const focusRail = useCallback(() => Spotlight.focus(railId(selectedRail)), [selectedRail]);
	const focusToolbar = useCallback(() => Spotlight.focus(TOOLBAR_FIRST), []);
	const focusContinue = useCallback(() => {
		if (scrollerRef.current) scrollerRef.current.scrollTop = 0;
		Spotlight.focus(CONTINUE_ROW);
	}, []);
	// The Continue row if there's one, else the first card. The toolbar sits at the far right, so
	// landing there reads as focus jumping away.
	const focusDefault = useCallback(() => {
		if (hasResume) focusId(CONTINUE_ROW);
		else focusId(itemsRef.current.length ? cardId(0) : TOOLBAR_FIRST);
	}, [hasResume]);
	const focusContent = useCallback(() => {
		const last = lastCardRef.current;
		if (last != null && last < itemsRef.current.length) Spotlight.focus(cardId(last));
		else focusDefault();
	}, [focusDefault]);

	// Focus lands once, when the library and the first page are both in.
	const firstPageIn = Boolean(!paneLoading && paneRef.current && !paneRef.current.loading);
	useEffect(() => {
		if (landedRef.current || data.loading || !firstPageIn) return;
		landedRef.current = true;
		focusDefault();
	}, [data.loading, firstPageIn, focusDefault]);

	const showPane = useCallback((pane, scope) => {
		lastCardRef.current = null;
		if (scrollerRef.current) scrollerRef.current.scrollTop = 0;
		setView((current) => (current.pane === pane && current.scope === scope ? current : {pane, scope}));
	}, []);

	const handleRailSelect = useCallback((e) => {
		const {pane, scope} = e.currentTarget.dataset;
		showPane(pane, scope || view.scope);
	}, [showPane, view.scope]);

	const handleRailKey = useCallback((e) => {
		if (e.keyCode !== KEYS.RIGHT) return;
		consume(e);
		focusContent();
	}, [focusContent]);

	const handleContinueKey = useCallback((e) => {
		const index = cardIndexOf(e.target);
		if (e.keyCode === KEYS.LEFT && index === 0) {
			consume(e);
			focusRail();
		} else if ((e.keyCode === KEYS.RIGHT && index === data.resume.length - 1) || e.keyCode === KEYS.UP) {
			consume(e);
		} else if (e.keyCode === KEYS.DOWN) {
			consume(e);
			focusToolbar();
		}
	}, [data.resume.length, focusRail, focusToolbar]);

	const handleToolbarKey = useCallback((e) => {
		const buttons = e.currentTarget.querySelectorAll('[data-toolbar-button]');
		const first = buttons[0] === e.target;
		const last = buttons[buttons.length - 1] === e.target;
		if (e.keyCode === KEYS.LEFT && first) {
			consume(e);
			focusRail();
		} else if (e.keyCode === KEYS.RIGHT && last) {
			consume(e);
		} else if (e.keyCode === KEYS.UP) {
			consume(e);
			if (hasResume) focusContinue();
		} else if (e.keyCode === KEYS.DOWN) {
			consume(e);
			if (itemsRef.current.length) Spotlight.focus(cardId(0));
		}
	}, [focusRail, focusContinue, hasResume]);

	// The grid never lets focus out the bottom: Down from the last row reads more if there is more,
	// or steps onto the last card from a short row above it.
	const handleGridKey = useCallback((e) => {
		const index = cardIndexOf(e.target);
		if (index < 0) return;
		const count = itemsRef.current.length;
		const cols = columnsRef.current;
		if (e.keyCode === KEYS.LEFT && index % cols === 0) {
			consume(e);
			focusRail();
		} else if (e.keyCode === KEYS.RIGHT && (index % cols === cols - 1 || index === count - 1)) {
			consume(e);
		} else if (e.keyCode === KEYS.UP && index < cols) {
			consume(e);
			focusToolbar();
		} else if (e.keyCode === KEYS.DOWN && index + cols >= count) {
			consume(e);
			if (paneRef.current?.hasMore) loadMore();
			else if (Math.floor(index / cols) < Math.floor((count - 1) / cols)) Spotlight.focus(cardId(count - 1));
		}
	}, [focusRail, focusToolbar, loadMore]);

	// The next page is read once focus is two rows from the end.
	const handleGridFocus = useCallback((e) => {
		const index = cardIndexOf(e.target);
		if (index < 0) return;
		lastCardRef.current = index;
		if (index >= itemsRef.current.length - columnsRef.current * 2) loadMore();
	}, [loadMore]);

	const handleGridClick = useCallback((e) => {
		const index = cardIndexOf(e.target);
		const item = itemsRef.current[index];
		if (item) openBookItem(item, {onSelectItem, onOpenGrid});
	}, [onSelectItem, onOpenGrid]);

	const handleContinueClick = useCallback((e) => {
		const item = data.resume[cardIndexOf(e.target)];
		if (item) openBookItem(item, {onSelectItem, onOpenGrid});
	}, [data.resume, onSelectItem, onOpenGrid]);

	// Series, authors and genres have no menu, and a collection's is the item menu like a title's.
	const menuPane = listsTitles || view.pane === 'collections';
	const gridItemAt = useCallback((target) => (menuPane ? bookMenuItem(itemsRef.current[cardIndexOf(target)]) : null), [menuPane]);
	const gridMenu = useItemMenuHold(gridItemAt);
	const continueItemAt = useCallback((target) => bookMenuItem(data.resume[cardIndexOf(target)]), [data.resume]);
	const continueMenu = useItemMenuHold(continueItemAt);

	const openSort = useCallback(() => setShowSort(true), []);
	const closeSort = useCallback(() => {
		setShowSort(false);
		focusId(SORT_BUTTON);
	}, []);
	const pickSort = useCallback((id) => {
		setStoredSort(id);
		closeSort();
	}, [setStoredSort, closeSort]);
	const toggleLayout = useCallback(() => setListView(!listView), [listView, setListView]);
	const readOrListenItem = useCallback((item) => readOrListen(item, onPlay), [onPlay]);

	useEffect(() => {
		if (showSort) focusId('book-sort-modal');
	}, [showSort]);

	const showSortRef = useRef(showSort);
	showSortRef.current = showSort;
	useEffect(() => {
		if (!backHandlerRef) return undefined;
		const handler = () => {
			if (!showSortRef.current) return false;
			closeSort();
			return true;
		};
		backHandlerRef.current = handler;
		return () => { if (backHandlerRef.current === handler) backHandlerRef.current = null; };
	}, [backHandlerRef, closeSort]);

	const paneCount = (pane) => {
		if (pane === 'series') return data.series.length;
		if (pane === 'authors') return data.authorCount;
		if (pane === 'genres') return data.genreCount;
		if (pane === 'collections') return data.collections.length;
		if (pane === 'favorites') return data.favoriteCount;
		return data.counts[view.scope];
	};
	const countLabel = (pane) => `${paneCount(pane)}${pane === 'collections' && data.collectionsIsFloor ? '+' : ''}`;

	const railScopes = mixed ? availableScopes(data.counts) : [SCOPE_ALL];
	const railBrowse = BROWSE_PANES.filter((pane) => paneCount(pane.id) > 0);

	if (data.loading) {
		return (
			<div className={css.page}>
				<LibrarySkeleton
					gridWidth={window.innerWidth / rootScale() - 174}
					cardWidth={267}
					posterHeight={400}
					padX={16}
					minRowGap={20}
					showText
				/>
			</div>
		);
	}

	const heading = view.pane === 'titles' ? scopeRailLabel(view.scope) : BROWSE_PANES.find((pane) => pane.id === view.pane).label();
	const width = rem(cellWidth);
	const height = rem(cellWidth / aspect);

	const renderItem = (item, index) => {
		if (showsList) return <ListTile key={item.Id} item={item} index={index} serverUrl={serverUrl} onClick={handleGridClick} />;
		if (listsTitles) {
			return <TitleCard key={item.Id} item={item} index={index} serverUrl={serverUrl} width={width} height={height} mixed={mixed} watched={watched} onClick={handleGridClick} />;
		}
		return (
			<BrowseCard
				key={item.Id}
				item={item}
				index={index}
				serverUrl={serverUrl}
				width={width}
				height={height}
				round={view.pane === 'authors'}
				subtitle={view.pane === 'series' || view.pane === 'collections'}
				onClick={handleGridClick}
			/>
		);
	};

	return (
		<div className={css.page}>
			<RailContainer className={css.rail} spotlightId="book-rail" onKeyDown={handleRailKey} onFocus={keepFocusInView}>
				<div className={css.railTitle}>{library?.Name || $L('Books')}</div>
				<div className={css.railSubtitle}>{titlesLabel(data.counts.all)}</div>
				<div className={css.railHeader}>{$L('Titles')}</div>
				{railScopes.map((scope) => (
					<SpottableDiv
						key={scope}
						className={`${css.railRow} ${selectedRail === `scope-${scope}` ? css.railSelected : ''}`}
						spotlightId={railId(`scope-${scope}`)}
						data-pane="titles"
						data-scope={scope}
						onClick={handleRailSelect}
					>
						<BookIcon name={SCOPE_ICONS[scope]} />
						<span className={css.railLabel}>{scopeRailLabel(scope)}</span>
						<span className={css.railCount}>{data.counts[scope]}</span>
					</SpottableDiv>
				))}
				{railBrowse.length > 0 && <div className={css.railHeader}>{$L('Browse')}</div>}
				{railBrowse.map((pane) => (
					<SpottableDiv
						key={pane.id}
						className={`${css.railRow} ${selectedRail === `pane-${pane.id}` ? css.railSelected : ''}`}
						spotlightId={railId(`pane-${pane.id}`)}
						data-pane={pane.id}
						onClick={handleRailSelect}
					>
						<BookIcon name={pane.icon} />
						<span className={css.railLabel}>{pane.label()}</span>
						<span className={css.railCount}>{countLabel(pane.id)}</span>
					</SpottableDiv>
				))}
			</RailContainer>

			<div className={css.content} ref={scrollerRef} onFocus={keepFocusInView}>
				{hasResume && (
					<div className={css.continueSection}>
						<h2 className={css.sectionTitle}>{isAudiobookLibrary(library) ? $L('Continue Listening') : $L('Continue Reading')}</h2>
						<RowContainer
							{...continueMenu}
							className={css.continueRow}
							spotlightId={CONTINUE_ROW}
							onKeyDown={handleContinueKey}
							onFocus={keepFocusInView}
						>
							{data.resume.map((item, index) => (
								<ContinueTile key={item.Id} item={item} index={index} serverUrl={serverUrl} onPlay={readOrListenItem} onClick={handleContinueClick} />
							))}
						</RowContainer>
					</div>
				)}

				<div className={css.toolbar} onKeyDown={handleToolbarKey}>
					<div className={css.toolbarHeading}>
						<span className={css.heading}>{heading}</span>
						<span className={css.headingCount}>{countLabel(view.pane)}</span>
					</div>
					<SpottableDiv className={css.pillButton} spotlightId={TOOLBAR_FIRST} data-toolbar-button onClick={onSearch}>
						<BookIcon name="search_rounded" /><span>{$L('Search')}</span>
					</SpottableDiv>
					{listsTitles && (
						<SpottableDiv className={css.pillButton} spotlightId={SORT_BUTTON} data-toolbar-button onClick={openSort}>
							<BookIcon name="sort_rounded" /><span>{sort.label()}</span>
						</SpottableDiv>
					)}
					{listsTitles && (
						<SpottableDiv className={css.iconButton} data-toolbar-button onClick={toggleLayout} aria-label={$L('Layout')}>
							<BookIcon name={listView ? 'grid_view_rounded' : 'view_list_rounded'} />
						</SpottableDiv>
					)}
				</div>

				{paneItems.length === 0 ? (
					firstPageIn ? (
						<BookEmptyState title={$L('No Books Found')} description={$L('This library does not contain any books, audiobooks, or comics yet.')} />
					) : <div className={css.loadingFirst}><LoadingSpinner /></div>
				) : (
					<div
						{...gridMenu}
						className={showsList ? css.list : css.grid}
						onKeyDown={handleGridKey}
						onFocus={handleGridFocus}
					>
						{paneItems.map(renderItem)}
					</div>
				)}
				{paneItems.length > 0 && paneLoading && <div className={css.loadingMore}><LoadingSpinner /></div>}
			</div>

			{showSort && <SortDialog active={sort.id} onSelect={pickSort} onClose={closeSort} />}
		</div>
	);
};

export default BookstoreBooks;
