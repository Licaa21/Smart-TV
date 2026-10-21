import {useState, useEffect, useCallback, useRef, useMemo} from 'react';
import Spotlight from '@enact/spotlight';
import Spottable from '@enact/spotlight/Spottable';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import {VirtualGridList} from '@enact/sandstone/VirtualList';
import $L from '@enact/i18n/$L';
import {useSeerr} from '../../context/SeerrContext';
import {useSettings} from '../../context/SettingsContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import FilterPopup, {FilterOption} from '../../components/FilterPopup';
import {useStorage} from '../../hooks/useStorage';
import useStyleLibraries from '../../hooks/useStyleLibraries';
import {pickStyleLibrary} from '../../utils/styleLibrary';
import {GRID_DIRECTIONS, IMAGE_SIZES, IMAGE_TYPES, focusOverhang, horizontalCellPad} from '../../utils/gridChrome';
import useHeaderGridKeys from '../../hooks/useHeaderGridKeys';
import {useAuth} from '../../context/AuthContext';
import ScreenBackdrop from '../../components/ScreenBackdrop';
import RatingsRow from '../../components/RatingsRow';
import libraryCss from '../Library/Library.module.less';
import {DOCK_WIDTH, HOME_ICON, HeaderSearch, LibraryDock, LibraryTitle, ModernBar, SETTINGS_ICON, SORT_ICON, libraryStyleOf} from '../Library/LibraryHeaders';
import * as seerrApi from '../../services/seerrApi';
import {buildSeerrDiscoverParams, filterSearchResults, filterTitlesByName, mergeTitles, getSeerrSortOptions, getSeerrTvStatusOptions, getSeerrMinRatingOptions, getSeerrMinVoteOptions, getSeerrRuntimeOptions, getSeerrReleaseOptions, hasSeerrDiscoverFilters} from '../../utils/seerrBrowseFilters';
import {browseStateKey, forgetReturnPoint, readBrowseState, writeBrowseState} from './seerrBrowseState';

import css from './SeerrBrowse.module.less';

const SpottableDiv = Spottable('div');
const SpottableButton = Spottable('button');
const ToolbarContainer = SpotlightContainerDecorator({enterTo: 'last-focused', restrict: 'self-first'}, 'div');
const GridContainer = SpotlightContainerDecorator({enterTo: 'last-focused', restrict: 'self-first'}, 'div');

// The room the grid leaves at its sides, and the least gap kept between rows, as in the library.
const GRID_INSET = 174;
const MIN_ROW_GAP = 6;
const MAX_PAGES = 25;
// A search reads this many pages of Seerr's answer, a hundred titles, and waits this long after the last key
const SEARCH_PAGES = 5;
const SEARCH_DELAY_MS = 400;

/**
 * SeerrBrowse - Browse Seerr content by genre, studio, or keyword
 *
 * @param {Object} props
 * @param {string} props.browseType - 'genre', 'studio', 'network', or 'keyword'
 * @param {Object} props.item - The item to browse (must have id and name)
 * @param {string} props.mediaType - 'movie' or 'tv' (default determined by browseType)
 * @param {Function} props.onSelectItem - Callback when an item is selected
 * @param {Function} props.onBack - Callback to go back
 */
const SeerrBrowse = ({browseType, item, mediaType: initialMediaType, onSelectItem, onHome, backHandlerRef}) => {
	const {isEnabled} = useSeerr();
	const {settings} = useSettings();
	const stateKey = useMemo(
		() => browseStateKey(browseType, item, initialMediaType),
		[browseType, item, initialMediaType]
	);
	// Read once on mount. Later writes must not feed back into what seeded them.
	const savedRef = useRef(readBrowseState(stateKey));
	const saved = savedRef.current;
	const [items, setItems] = useState([]);
	const [isLoading, setIsLoading] = useState(true);
	const [totalCount, setTotalCount] = useState(0);
	// A genre, studio, network or keyword lists the kind of title it was opened for, so the screen has no switch for it
	const [mediaType] = useState(() => {
		if (saved?.mediaType) return saved.mediaType;
		// Studios are movies only, networks are TV only
		if (browseType === 'studio') return 'movie';
		if (browseType === 'network') return 'tv';
		return initialMediaType || 'movie';
	});
	const [initialLoadDone, setInitialLoadDone] = useState(false);
	const [showFilterModal, setShowFilterModal] = useState(false);
	const [showDisplay, setShowDisplay] = useState(false);
	// The group the popup opens on: Sort By from the sort button, the filters from the Filters one
	const [popupGroup, setPopupGroup] = useState('sort');
	// Narrows the titles that are loaded, by name, since Seerr cannot search inside a genre or a studio
	const [searchQuery, setSearchQuery] = useState('');
	// A search in a genre, or in a plain Movies or TV Shows browse, asks Seerr, since the titles of a genre run to the thousands and a
	// title can stand far down its popularity. A studio, a network or a keyword cannot be searched inside, so there the search
	// narrows the titles that are loaded.
	const searchesSeerr = browseType === 'genre' || browseType === 'all';
	const [searchHits, setSearchHits] = useState(null);
	const searchRunRef = useRef(0);
	// The grid is laid out by the settings of the library it stands for, the movies library for movies and the shows
	// library for shows, so a card is the same size and shape here as there.
	const {api} = useAuth();
	const libraries = useStyleLibraries(api);
	const layoutId = pickStyleLibrary(libraries, mediaType === 'tv' ? 'tvshows' : 'movies')?.Id || 'seerr-browse';
	const [imageSize, setImageSize, sizeLoaded] = useStorage(`library_imageSize_${layoutId}`, 'medium');
	const [imageType, setImageType, typeLoaded] = useStorage(`library_imageType_${layoutId}`, 'poster');
	const [gridDirection, setGridDirection, directionLoaded] = useStorage(`library_gridDirection_${layoutId}`, 'vertical');
	const [cardText, setCardText, cardTextLoaded] = useStorage(`library_cardText_${layoutId}`, 'on');
	// The grid waits for the library's settings, so it is not drawn at the defaults and then again.
	const layoutLoaded = libraries !== null && sizeLoaded && typeLoaded && directionLoaded && cardTextLoaded;
	const showCardText = cardText !== 'off';
	const libraryStyle = libraryStyleOf(settings);
	const isDocked = libraryStyle === 'docked';
	const [sortBy, setSortBy] = useState(saved?.sortBy || 'popularity.desc');
	const [genreIds, setGenreIds] = useState(saved?.genreIds || []);
	const [tvStatuses, setTvStatuses] = useState(saved?.tvStatuses || []);
	const [language, setLanguage] = useState(saved?.language || '');
	const [minRating, setMinRating] = useState(saved?.minRating || '');
	const [minVotes, setMinVotes] = useState(saved?.minVotes || '');
	const [runtime, setRuntime] = useState(saved?.runtime || '');
	const [released, setReleased] = useState(saved?.released || '');
	const [filterGenres, setFilterGenres] = useState([]);
	const [filterLanguages, setFilterLanguages] = useState([]);
	const filterOptionsRequestedRef = useRef(false);

	const loadingMoreRef = useRef(false);
	const loadCooldownRef = useRef(false);
	const itemsRef = useRef([]);
	// Each load of the list is a run of its own, and a run that has been replaced adds nothing, so two of them cannot both
	// append the same pages
	const runRef = useRef(0);
	const remoteSearch = searchesSeerr && Boolean(searchQuery.trim());
	const shownItems = useMemo(
		() => (remoteSearch ? (searchHits || []) : filterTitlesByName(items, searchQuery)),
		[remoteSearch, searchHits, items, searchQuery]
	);
	// What the cards read, the titles that are showing, which a search makes fewer than were loaded
	const shownRef = useRef(shownItems);
	shownRef.current = shownItems;
	const totalPagesRef = useRef(1);
	const currentPageRef = useRef(1);
	const scrollToRef = useRef(null);
	const restoredRef = useRef(false);
	const getScrollTo = useCallback((fn) => {
		scrollToRef.current = fn;
	}, []);

	const loadItems = useCallback(async (page = 1, append = false) => {
		if (!item || !isEnabled) return;

		if (append && loadingMoreRef.current) return;

		const run = runRef.current;
		if (append) {
			loadingMoreRef.current = true;
		}

		try {
			const params = {
				page,
				sortBy,
				...buildSeerrDiscoverParams({
					routeGenreId: browseType === 'genre' ? item.id : undefined,
					genreIds,
					tvStatuses,
					language,
					minRating,
					minVotes,
					runtime,
					released
				})
			};
			if (browseType === 'studio') params.studio = item.id;
			if (browseType === 'network') params.network = item.id;
			if (browseType === 'keyword') params.keywords = item.id;
			const result = await seerrApi.discoverFiltered(mediaType, params);
			if (run !== runRef.current) return;

			const newItems = result.results || [];
			totalPagesRef.current = result.totalPages || 1;

			setItems(prev => {
				const updatedItems = mergeTitles(append ? prev : [], newItems, mediaType);
				itemsRef.current = updatedItems;
				return updatedItems;
			});
			setTotalCount(result.totalResults || 0);
			currentPageRef.current = page;

		} catch (err) {
			console.error('Failed to load items:', err);
		} finally {
			if (run === runRef.current) {
				setIsLoading(false);
				loadingMoreRef.current = false;
				if (append) {
					loadCooldownRef.current = true;
					setTimeout(() => { loadCooldownRef.current = false; }, 500);
				}
			}
		}
	}, [item, isEnabled, browseType, mediaType, sortBy, genreIds, tvStatuses, language, minRating, minVotes, runtime, released]);

	useEffect(() => {
		writeBrowseState(stateKey, {
			mediaType, sortBy, genreIds, tvStatuses, language, minRating, minVotes, runtime, released
		});
	}, [stateKey, mediaType, sortBy, genreIds, tvStatuses, language, minRating, minVotes, runtime, released]);

	useEffect(() => {
		if (item && isEnabled) {
			runRef.current += 1;
			const run = runRef.current;
			setIsLoading(true);
			setItems([]);
			itemsRef.current = [];
			loadingMoreRef.current = false;
			currentPageRef.current = 1;

			// Coming back to a screen that had been paged through reloads as far as
			// it had reached, otherwise the item it was left on is not there to
			// return to.
			const lastPage = restoredRef.current ? 3 : Math.min(savedRef.current?.pagesLoaded || 3, MAX_PAGES);

			const loadInitialPages = async () => {
				for (let page = 1; page <= lastPage; page++) {
					await loadItems(page, page > 1);
					if (run !== runRef.current) return;
					if (page >= totalPagesRef.current) break;
				}
				setInitialLoadDone(true);
			};
			setInitialLoadDone(false);
			loadInitialPages();
		}
	}, [item, isEnabled, mediaType, loadItems]);

	// Once the list is back, put focus on the item that was opened. Scrolling to
	// it is what brings the grid back to where it was left.
	useEffect(() => {
		if (restoredRef.current || !initialLoadDone) return;
		restoredRef.current = true;
		const focusedId = savedRef.current?.focusedId;
		// Only a return from a title's details page lands on its card, a later visit starts at the first title
		forgetReturnPoint(stateKey);
		// A first visit puts the focus on the first title, as the library does, so the title under the header is filled
		if (!focusedId) {
			const timer = setTimeout(() => Spotlight.focus('seerr-browse-grid'), 100);
			return () => clearTimeout(timer);
		}
		const index = itemsRef.current.findIndex((i) => i.id === focusedId);
		if (index < 0 || !scrollToRef.current) return;
		scrollToRef.current({index, animate: false, focus: true});
	}, [initialLoadDone, stateKey]);

	// the card focus is on, whose backdrop shows behind the grid
	const [backdropItem, setBackdropItem] = useState(null);
	// Asks Seerr once typing has stopped, and keeps the titles of this screen's type and genre among what it answers
	useEffect(() => {
		searchRunRef.current += 1;
		const run = searchRunRef.current;
		const typed = searchQuery.trim();
		if (!searchesSeerr || !typed) {
			setSearchHits(null);
			return undefined;
		}
		const timer = setTimeout(async () => {
			let hits = [];
			try {
				for (let page = 1; page <= SEARCH_PAGES; page++) {
					const result = await seerrApi.search(typed, page);
					if (run !== searchRunRef.current) return;
					hits = mergeTitles(hits, filterSearchResults(result?.results, {mediaType, genreId: browseType === 'genre' ? item?.id : null}), mediaType);
					if (page >= (result?.totalPages || 1)) break;
				}
			} catch (err) {
				hits = [];
			}
			if (run === searchRunRef.current) setSearchHits(hits);
		}, SEARCH_DELAY_MS);
		return () => clearTimeout(timer);
	}, [searchQuery, searchesSeerr, browseType, item, mediaType]);

	// A search that has too few matches in what is loaded reads on, a page at a time, until it has a screenful or the pages end
	useEffect(() => {
		if (searchesSeerr || !searchQuery.trim() || isLoading || shownItems.length >= 20) return;
		if (currentPageRef.current >= totalPagesRef.current || currentPageRef.current >= MAX_PAGES || loadingMoreRef.current) return;
		loadItems(currentPageRef.current + 1, true);
	}, [searchesSeerr, searchQuery, shownItems.length, items.length, isLoading, loadItems]);

	const handleItemFocus = useCallback((ev) => {
		const itemIndex = ev.currentTarget?.dataset?.index;
		if (itemIndex === undefined) return;
		const mediaItem = shownRef.current[parseInt(itemIndex, 10)];
		if (mediaItem) setBackdropItem(mediaItem);
	}, []);

	const handleItemClick = useCallback((ev) => {
		const itemIndex = ev.currentTarget?.dataset?.index;
		if (itemIndex === undefined) return;

		const mediaItem = shownRef.current[parseInt(itemIndex, 10)];
		if (mediaItem) {
			const type = mediaItem.media_type || mediaItem.mediaType || (mediaItem.title ? 'movie' : 'tv');
			writeBrowseState(stateKey, {
				focusedId: mediaItem.id,
				pagesLoaded: currentPageRef.current
			});
			onSelectItem?.({
				mediaId: mediaItem.id,
				mediaType: type
			});
		}
	}, [onSelectItem, stateKey]);

	const handleCloseModal = useCallback(() => {
		setShowFilterModal(false);
	}, []);

	// The genre and language lists are only read once the panel opens, so a
	// browse that never opens it costs nothing extra.
	const loadFilterOptions = useCallback(async () => {
		if (filterOptionsRequestedRef.current) return;
		filterOptionsRequestedRef.current = true;
		// A genre screen is already in its genre, so it has no list of genres to pick
		const [genres, languages] = await Promise.all([
			browseType === 'genre' ? [] : (mediaType === 'tv' ? seerrApi.getGenreSliderTv() : seerrApi.getGenreSliderMovies()).catch(() => []),
			seerrApi.getLanguages().catch(() => [])
		]);
		setFilterGenres(Array.isArray(genres) ? genres.filter((g) => g && g.id !== undefined && g.name) : []);
		setFilterLanguages((Array.isArray(languages) ? languages : [])
			.filter((l) => l && l.iso_639_1)
			.map((l) => ({code: l.iso_639_1, name: l.english_name || l.name || l.iso_639_1}))
			.sort((a, b) => a.name.localeCompare(b.name)));
	}, [mediaType, browseType]);

	const handleOpenFilterModal = useCallback(() => {
		loadFilterOptions();
		setPopupGroup('sort');
		setShowFilterModal(true);
	}, [loadFilterOptions]);

	const handleOpenFilters = useCallback(() => {
		loadFilterOptions();
		setPopupGroup('released');
		setShowFilterModal(true);
	}, [loadFilterOptions]);

	// The setters write under the library's id, which is only known once the libraries are in, so the handler reads them fresh
	const displaySettersRef = useRef({});
	displaySettersRef.current = {size: setImageSize, type: setImageType, direction: setGridDirection, text: setCardText};
	const handleDisplayPick = useCallback((ev) => {
		const {displayGroup, displayValue} = ev.currentTarget.dataset;
		displaySettersRef.current[displayGroup]?.(displayValue);
	}, []);
	const handleOpenDisplay = useCallback(() => setShowDisplay(true), []);
	const handleCloseDisplay = useCallback(() => setShowDisplay(false), []);
	const handleSearchChange = useCallback((ev) => setSearchQuery(ev.target.value), []);

	useEffect(() => {
		if (!backHandlerRef) return;
		const handler = () => {
			if (showDisplay) {
				setShowDisplay(false);
				return true;
			}
			if (showFilterModal) {
				setShowFilterModal(false);
				return true;
			}
			return false;
		};
		backHandlerRef.current = handler;
		return () => { if (backHandlerRef.current === handler) backHandlerRef.current = null; };
	}, [backHandlerRef, showFilterModal, showDisplay]);

	// The same card sizes the library uses, so a poster is as big here as it is there.
	const isWideImage = imageType === 'thumbnail';
	const posterHeight = isWideImage
		? ({small: 128, medium: 160, large: 191, extraLarge: 223}[imageSize] || 160)
		: ({small: 174, medium: 217, large: 261, extraLarge: 304}[imageSize] || 217);
	const cardWidth = isWideImage
		? ({small: 227, medium: 284, large: 340, extraLarge: 397}[imageSize] || 284)
		: ({small: 116, medium: 145, large: 174, extraLarge: 203}[imageSize] || 145);
	const textHeight = showCardText ? 61 : 0;
	const cardHeight = posterHeight + textHeight;
	// A focused card grows past its cell, so the cell is padded by what it grows into.
	const gridInset = GRID_INSET + (isDocked ? DOCK_WIDTH : 0);
	const cellPadX = horizontalCellPad(cardWidth, window.innerWidth - gridInset);
	const cellPadY = Math.max(MIN_ROW_GAP, focusOverhang(cardHeight));
	const gridItemSize = useMemo(
		() => ({minWidth: cardWidth + cellPadX * 2, minHeight: cardHeight + cellPadY * 2}),
		[cardWidth, cardHeight, cellPadX, cellPadY]
	);
	const cellPadding = `${cellPadY}px ${cellPadX}px`;

	const renderItem = useCallback(({index, ...rest}) => {
		const mediaItem = shownItems[index];

		const itemsLoaded = shownItems.length;
		const nearEnd = index >= itemsLoaded - 10;
		const hasMorePages = currentPageRef.current < totalPagesRef.current;
		const underMaxPages = currentPageRef.current < MAX_PAGES;

		if (nearEnd && !remoteSearch && hasMorePages && underMaxPages && !loadingMoreRef.current && !loadCooldownRef.current) {
			loadItems(currentPageRef.current + 1, true);
		}

		if (!mediaItem) return null;

		const imageUrl = isWideImage && mediaItem.backdropPath
			? seerrApi.getImageUrl(mediaItem.backdropPath, 'w500')
			: mediaItem.posterPath
				? seerrApi.getImageUrl(mediaItem.posterPath, 'w300')
				: null;

		const title = mediaItem.title || mediaItem.name;
		const year = mediaItem.releaseDate?.substring(0, 4) || mediaItem.firstAirDate?.substring(0, 4);
		const status = mediaItem.mediaInfo?.status;
		const cardLine = [year, mediaItem.voteAverage > 0 ? '\u2605 ' + mediaItem.voteAverage.toFixed(1) : null].filter(Boolean).join(' ');

		return (
			<SpottableDiv
				{...rest}
				className={libraryCss.itemCard}
				style={{padding: cellPadding}}
				onClick={handleItemClick}
				onFocus={handleItemFocus}
				data-index={index}
			>
				<div className={libraryCss.itemCardInner}>
					{imageUrl ? (
						<img
							className={libraryCss.poster}
							style={{height: posterHeight}}
							src={imageUrl}
							alt={title}
							loading="lazy"
						/>
					) : (
						<div className={libraryCss.posterPlaceholder} style={{height: posterHeight}}>
							<svg viewBox="0 0 24 24" className={libraryCss.placeholderIcon}>
								<path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z" />
							</svg>
						</div>
					)}
					{/* What Seerr knows of it: in the library, partly there or on its way. */}
					{status && [3, 4, 5].includes(status) && (
						<div className={`${css.availabilityBadge} ${css[`availability${status}`]}`} />
					)}
					{showCardText && (
						<div className={libraryCss.cardText}>
							<div className={libraryCss.cardTitle}>{title}</div>
							{cardLine && <div className={libraryCss.cardSubtitle}>{cardLine}</div>}
						</div>
					)}
				</div>
			</SpottableDiv>
		);
	}, [handleItemClick, handleItemFocus, loadItems, isWideImage, posterHeight, cellPadding, showCardText, shownItems, remoteSearch]);

	const handleSortSelect = useCallback((ev) => {
		const key = ev.currentTarget?.dataset?.sortKey;
		if (!key) return;
		const option = getSeerrSortOptions(mediaType).find((o) => o.key === key);
		if (!option) return;
		// Reselecting the active axis flips its direction.
		if (sortBy.startsWith(key + '.')) {
			const flipped = sortBy.endsWith('.asc') ? `${key}.desc` : `${key}.asc`;
			setSortBy(flipped);
		} else {
			setSortBy(option.defaultValue);
		}
	}, [mediaType, sortBy]);

	const handleGenreToggle = useCallback((ev) => {
		const id = parseInt(ev.currentTarget?.dataset?.genreId, 10);
		if (!Number.isFinite(id)) return;
		setGenreIds((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));
	}, []);

	const handleTvStatusToggle = useCallback((ev) => {
		const key = parseInt(ev.currentTarget?.dataset?.statusKey, 10);
		if (!Number.isFinite(key)) return;
		setTvStatuses((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
	}, []);

	const handleLanguageSelect = useCallback((ev) => {
		setLanguage(ev.currentTarget?.dataset?.languageCode || '');
	}, []);

	const handleMinRatingSelect = useCallback((ev) => {
		setMinRating(ev.currentTarget?.dataset?.optionKey || '');
	}, []);

	const handleMinVotesSelect = useCallback((ev) => {
		setMinVotes(ev.currentTarget?.dataset?.optionKey || '');
	}, []);

	const handleRuntimeSelect = useCallback((ev) => {
		setRuntime(ev.currentTarget?.dataset?.optionKey || '');
	}, []);

	const handleReleasedSelect = useCallback((ev) => {
		setReleased(ev.currentTarget?.dataset?.optionKey || '');
	}, []);


	const handleClearFilters = useCallback(() => {
		setGenreIds([]);
		setTvStatuses([]);
		setLanguage('');
		setMinRating('');
		setMinVotes('');
		setRuntime('');
		setReleased('');
	}, []);

	const filterState = {genreIds, tvStatuses, language, minRating, minVotes, runtime, released};

	// Each group is one thing that can be set, listed on the left of the popup with what it is set
	// to now, and its options show beside it in columns.
	const optionLabel = (options, value) => (value ? options.find((option) => option.key === value)?.label : null);
	const countOf = (list) => (list.length > 0 ? String(list.length) : null);
	const singleOptions = (options, value, onSelect) => options.map((option) => (
		<FilterOption
			key={option.key || 'any'}
			label={option.label}
			selected={value === option.key}
			onClick={onSelect}
			data-option-key={option.key}
		/>
	));
	const sortOptions = getSeerrSortOptions(mediaType);
	const activeSort = sortOptions.find((option) => sortBy.startsWith(option.key + '.'));
	const sortDirection = sortBy.endsWith('.asc') ? '↑' : '↓';
	const filterGroups = [
		{
			key: 'sort',
			title: $L('Sort By'),
			summary: activeSort ? `${activeSort.label} ${sortDirection}` : null,
			body: () => sortOptions.map((option) => {
				const active = sortBy.startsWith(option.key + '.');
				return (
					<FilterOption
						key={option.key}
						label={active ? `${option.label} ${sortDirection}` : option.label}
						selected={active}
						onClick={handleSortSelect}
						data-sort-key={option.key}
					/>
				);
			})
		},
		filterGenres.length > 0 && {
			key: 'genres',
			title: $L('Genres'),
			summary: countOf(genreIds),
			body: () => filterGenres.map((genre) => (
				<FilterOption
					key={genre.id}
					multi
					label={genre.name}
					selected={genreIds.includes(genre.id)}
					onClick={handleGenreToggle}
					data-genre-id={genre.id}
				/>
			))
		},
		mediaType === 'tv' && {
			key: 'status',
			title: $L('Series Status'),
			summary: countOf(tvStatuses),
			body: () => getSeerrTvStatusOptions().map((option) => (
				<FilterOption
					key={option.key}
					multi
					label={option.label}
					selected={tvStatuses.includes(option.key)}
					onClick={handleTvStatusToggle}
					data-status-key={option.key}
				/>
			))
		},
		{
			key: 'released',
			title: $L('Released'),
			summary: optionLabel(getSeerrReleaseOptions(), released),
			body: () => singleOptions(getSeerrReleaseOptions(), released, handleReleasedSelect)
		},
		{
			key: 'rating',
			title: $L('Minimum Rating'),
			summary: optionLabel(getSeerrMinRatingOptions(), minRating),
			body: () => singleOptions(getSeerrMinRatingOptions(), minRating, handleMinRatingSelect)
		},
		{
			key: 'votes',
			title: $L('Minimum Votes'),
			summary: optionLabel(getSeerrMinVoteOptions(), minVotes),
			body: () => singleOptions(getSeerrMinVoteOptions(), minVotes, handleMinVotesSelect)
		},
		{
			key: 'runtime',
			title: $L('Runtime'),
			summary: optionLabel(getSeerrRuntimeOptions(), runtime),
			body: () => singleOptions(getSeerrRuntimeOptions(), runtime, handleRuntimeSelect)
		},
		filterLanguages.length > 0 && {
			key: 'language',
			title: $L('Original Language'),
			summary: language ? filterLanguages.find((option) => option.code === language)?.name : null,
			body: () => [
				<FilterOption
					key="any"
					label={$L('Any')}
					selected={language === ''}
					onClick={handleLanguageSelect}
					data-language-code=""
				/>,
				...filterLanguages.map((option) => (
					<FilterOption
						key={option.code}
						label={option.name}
						selected={language === option.code}
						onClick={handleLanguageSelect}
						data-language-code={option.code}
					/>
				))
			]
		}
	];

	// What the Display button sets, the library's own settings for its cards
	const sizeLabels = {small: $L('Small'), medium: $L('Medium'), large: $L('Large'), extraLarge: $L('Extra Large')};
	const typeLabels = {poster: $L('Poster'), thumbnail: $L('Thumbnail')};
	const directionLabels = {vertical: $L('Vertical'), horizontal: $L('Horizontal')};
	const pick = (group, values, labels, current) => () => values.map((value) => (
		<FilterOption key={value} label={labels[value]} selected={current === value} onClick={handleDisplayPick} data-display-group={group} data-display-value={value} />
	));
	const displayGroups = [
		{key: 'size', title: $L('Image size'), summary: sizeLabels[imageSize], body: pick('size', IMAGE_SIZES, sizeLabels, imageSize)},
		{key: 'type', title: $L('Image Type'), summary: typeLabels[imageType], body: pick('type', IMAGE_TYPES, typeLabels, imageType)},
		{key: 'direction', title: $L('Grid direction'), summary: directionLabels[gridDirection], body: pick('direction', GRID_DIRECTIONS, directionLabels, gridDirection)},
		{
			key: 'text',
			title: $L('Titles under posters'),
			summary: showCardText ? $L('On') : $L('Off'),
			body: () => ['on', 'off'].map((value) => (
				<FilterOption key={value} label={value === 'on' ? $L('On') : $L('Off')} selected={(cardText !== 'off') === (value === 'on')} onClick={handleDisplayPick} data-display-group="text" data-display-value={value} />
			))
		}
	];
	const activeFilterCount = genreIds.length + tvStatuses.length + [language, minRating, minVotes, runtime, released].filter(Boolean).length;

	// Channel Up and Down go between the header and the cards, so a long grid is not scrolled back up to reach it
	const handleChannelKeys = useHeaderGridKeys(
		libraryStyle === 'docked' ? 'library-dock' : libraryStyle === 'modern' ? 'library-bar' : 'seerr-browse-toolbar',
		'seerr-browse-grid-area',
		!showFilterModal && !showDisplay
	);

	if (!item) {
		return (
			<div className={css.page}>
				<div className={css.empty}>{$L('Nothing selected')}</div>
			</div>
		);
	}

	if (!isEnabled) {
		return (
			<div className={css.page}>
				<div className={css.empty}>{$L('Seerr is not configured')}</div>
			</div>
		);
	}

	// What the header shows, the same in the three styles
	const sortLabelText = activeSort?.label;
	const sortAscending = sortBy.endsWith('.asc');
	const filtersValue = activeFilterCount > 0 ? String(activeFilterCount) : $L('All');
	const searchPlaceholder = $L('Search these titles...');
	const shownCount = remoteSearch ? shownItems.length : (totalCount || items.length);
	const filterLabel = activeFilterCount > 0 ? `${$L('Filters')}: ${activeFilterCount}` : $L('All items');
	const statusText = $L("Showing {filterLabel} from '{genreFilter}' sorted by {sortLabel}")
		.replace('{filterLabel}', filterLabel).replace('{genreFilter}', item.name).replace('{sortLabel}', sortLabelText || '');
	// The title the focus is on, drawn under the header the way the library draws its focused title
	// Only a title that is in the list: a search can take the one that was focused out of it
	const focusedTitle = backdropItem && shownItems.includes(backdropItem) ? backdropItem : null;
	const focusedYear = focusedTitle?.releaseDate?.substring(0, 4) || focusedTitle?.firstAirDate?.substring(0, 4);
	const focusedStatus = {5: $L('Available'), 4: $L('Partially Available'), 3: $L('Processing'), 2: $L('Pending')}[focusedTitle?.mediaInfo?.status];
	const focusedRating = {CommunityRating: focusedTitle?.voteAverage > 0 ? focusedTitle.voteAverage : null};

	return (
		<div className={libraryCss.page} onKeyDown={handleChannelKeys}>
			<ScreenBackdrop item={focusedTitle} />
			{isDocked && (
				<LibraryDock
					isFolderView={false}
					folderStack={[]}
					rootName={item.name}
					displayName={item.name}
					shownCount={shownCount}
					sortLabel={sortLabelText}
					sortAscending={sortAscending}
					showTitle={$L('Filters')}
					showLabel={filtersValue}
					displayLabel={sizeLabels[imageSize]}
					searchQuery={searchQuery}
					searchPlaceholder={searchPlaceholder}
					onSearchChange={handleSearchChange}
					onHome={onHome}
					onSort={handleOpenFilterModal}
					onShow={handleOpenFilters}
					onSettings={handleOpenDisplay}
				/>
			)}
			<div className={isDocked ? `${libraryCss.content} ${libraryCss.contentDocked}` : libraryCss.content}>
				{libraryStyle === 'classic' && (
					<div className={libraryCss.header}>
						<div className={libraryCss.headerSide} />
						<div className={libraryCss.headerTitle}>
							<LibraryTitle isFolderView={false} folderStack={[]} displayName={item.name} shownCount={shownCount} />
						</div>
						<div className={libraryCss.headerSide}>
							<HeaderSearch value={searchQuery} onChange={handleSearchChange} placeholder={searchPlaceholder} />
						</div>
					</div>
				)}
				{libraryStyle === 'modern' && (
					<>
						<div className={libraryCss.modernTitle}>
							<LibraryTitle isFolderView={false} folderStack={[]} displayName={item.name} shownCount={shownCount} />
						</div>
						<ModernBar
							sortLabel={sortLabelText}
							sortAscending={sortAscending}
							showTitle={$L('Filters')}
							showLabel={filtersValue}
							searchQuery={searchQuery}
							searchPlaceholder={searchPlaceholder}
							onSearchChange={handleSearchChange}
							onHome={onHome}
							onSort={handleOpenFilterModal}
							onShow={handleOpenFilters}
							onSettings={handleOpenDisplay}
						/>
					</>
				)}

				{settings?.showMediaDetailsOnLibraryPage !== false && (
					<div className={libraryCss.focusedInfo}>
						{focusedTitle && (
							<>
								<div className={libraryCss.focusedName}>{focusedTitle.title || focusedTitle.name}</div>
								<div className={libraryCss.focusedMeta}>
									{focusedYear && <span className={libraryCss.metaItem}>{focusedYear}</span>}
									{focusedStatus && <span className={`${libraryCss.metaPill} ${libraryCss.metaPillLive}`}>{focusedStatus}</span>}
								</div>
								<RatingsRow item={focusedRating} pluginEnabled={false} />
							</>
						)}
					</div>
				)}

				{libraryStyle === 'classic' && (
					<ToolbarContainer className={libraryCss.toolbar} spotlightId="seerr-browse-toolbar">
						<SpottableButton className={libraryCss.toolbarBtn} onClick={onHome} spotlightId="library-home-btn">
							<svg className={libraryCss.toolbarIcon} viewBox="0 0 24 24">
								<path d={HOME_ICON} />
							</svg>
						</SpottableButton>
						<SpottableButton className={libraryCss.toolbarBtn} onClick={handleOpenFilterModal} spotlightId="seerr-browse-sort-btn">
							<svg className={libraryCss.toolbarIcon} viewBox="0 -960 960 960">
								<path d={SORT_ICON} />
							</svg>
						</SpottableButton>
						<SpottableButton className={libraryCss.toolbarBtn} onClick={handleOpenFilters} spotlightId="seerr-browse-filters-btn">
							<svg className={libraryCss.toolbarIcon} viewBox="0 0 24 24">
								<path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z" />
							</svg>
						</SpottableButton>
						<SpottableButton className={libraryCss.toolbarBtn} onClick={handleOpenDisplay} spotlightId="seerr-browse-display-btn">
							<svg className={libraryCss.toolbarIcon} viewBox="0 -960 960 960">
								<path d={SETTINGS_ICON} />
							</svg>
						</SpottableButton>
					</ToolbarContainer>
				)}

				<GridContainer className={libraryCss.gridContainer} spotlightId="seerr-browse-grid-area">
					{(isLoading && items.length === 0) || !layoutLoaded || (remoteSearch && searchHits === null) ? (
						<div className={css.loading}>
							<LoadingSpinner />
						</div>
					) : shownItems.length === 0 ? (
						<div className={css.empty}>{$L('No items found')}</div>
					) : (
						<div className={libraryCss.gridWrapper}>
							<VirtualGridList
								key={searchQuery.trim()}
								className={libraryCss.grid}
								cbScrollTo={getScrollTo}
								dataSize={shownItems.length}
								itemRenderer={renderItem}
								itemSize={gridItemSize}
								direction={gridDirection}
								horizontalScrollbar="hidden"
								verticalScrollbar="hidden"
								spacing={0}
								spotlightId="seerr-browse-grid"
							/>
						</div>
					)}
				</GridContainer>

				<div className={libraryCss.statusBar}>
					<div className={libraryCss.statusText}>{statusText}</div>
					<div className={libraryCss.statusCount}>{shownItems.length} | {shownCount}</div>
				</div>
			</div>

			{showFilterModal && (
				<FilterPopup
					title={$L('Sort & Filter')}
					spotlightId="seerr-filter-popup"
					groups={filterGroups}
					defaultGroup={popupGroup}
					canClear={hasSeerrDiscoverFilters(filterState)}
					onClear={handleClearFilters}
					onClose={handleCloseModal}
				/>
			)}

			{showDisplay && (
				<FilterPopup
					title={$L('Display')}
					spotlightId="seerr-display-popup"
					groups={displayGroups}
					onClose={handleCloseDisplay}
				/>
			)}
		</div>
	);
};

export default SeerrBrowse;
