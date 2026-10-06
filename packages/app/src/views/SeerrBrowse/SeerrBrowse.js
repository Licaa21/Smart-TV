import {useState, useEffect, useCallback, useRef, useMemo} from 'react';
import Spottable from '@enact/spotlight/Spottable';
import {VirtualGridList} from '@enact/sandstone/VirtualList';
import $L from '@enact/i18n/$L';
import {useSeerr} from '../../context/SeerrContext';
import {useSettings} from '../../context/SettingsContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import FilterPopup, {FilterOption} from '../../components/FilterPopup';
import {useStorage} from '../../hooks/useStorage';
import {IMAGE_SIZES, GRID_DIRECTIONS, capitalize, focusOverhang, horizontalCellPad} from '../../utils/gridChrome';
import * as seerrApi from '../../services/seerrApi';
import {buildSeerrDiscoverParams, getSeerrSortOptions, getSeerrTvStatusOptions, getSeerrMinRatingOptions, getSeerrMinVoteOptions, getSeerrRuntimeOptions, getSeerrReleaseOptions, hasSeerrDiscoverFilters} from '../../utils/seerrBrowseFilters';
import {browseStateKey, readBrowseState, writeBrowseState} from './seerrBrowseState';

import css from './SeerrBrowse.module.less';

const SpottableDiv = Spottable('div');
const SpottableButton = Spottable('button');

let _filterOptions;
const getFilterOptions = () => (_filterOptions ??= [
	{key: 'movie', label: $L('Movies')},
	{key: 'tv', label: $L('TV Shows')}
]);

// The room the grid leaves at its sides, and the least gap kept between rows, as in the library.
const GRID_INSET = 174;
const MIN_ROW_GAP = 6;
const MAX_PAGES = 25;

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
const SeerrBrowse = ({browseType, item, mediaType: initialMediaType, onSelectItem, backHandlerRef}) => {
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
	const [mediaType, setMediaType] = useState(() => {
		if (saved?.mediaType) return saved.mediaType;
		// Studios are movies only, networks are TV only
		if (browseType === 'studio') return 'movie';
		if (browseType === 'network') return 'tv';
		return initialMediaType || 'movie';
	});
	const [initialLoadDone, setInitialLoadDone] = useState(false);
	const [showFilterModal, setShowFilterModal] = useState(false);
	const [showViewSettings, setShowViewSettings] = useState(false);
	// How the grid is laid out, kept the way the library keeps its own.
	const [imageSize, setImageSize] = useStorage('seerr_browse_imageSize', 'medium');
	const [imageType, setImageType] = useStorage('seerr_browse_imageType', 'poster');
	const [gridDirection, setGridDirection] = useStorage('seerr_browse_gridDirection', 'vertical');
	const [cardText, setCardText] = useStorage('seerr_browse_cardText', 'on');
	const showCardText = cardText !== 'off';
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

			const newItems = result.results || [];
			totalPagesRef.current = result.totalPages || 1;

			setItems(prev => {
				const updatedItems = append ? [...prev, ...newItems] : newItems;
				itemsRef.current = updatedItems;
				return updatedItems;
			});
			setTotalCount(result.totalResults || 0);
			currentPageRef.current = page;

		} catch (err) {
			console.error('Failed to load items:', err);
		} finally {
			setIsLoading(false);
			loadingMoreRef.current = false;
			if (append) {
				loadCooldownRef.current = true;
				setTimeout(() => { loadCooldownRef.current = false; }, 500);
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
		if (!focusedId) return;
		const index = itemsRef.current.findIndex((i) => i.id === focusedId);
		if (index < 0 || !scrollToRef.current) return;
		scrollToRef.current({index, animate: false, focus: true});
	}, [initialLoadDone]);

	const handleItemClick = useCallback((ev) => {
		const itemIndex = ev.currentTarget?.dataset?.index;
		if (itemIndex === undefined) return;

		const mediaItem = itemsRef.current[parseInt(itemIndex, 10)];
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
		setShowViewSettings(false);
	}, []);

	const handleOpenViewSettings = useCallback(() => setShowViewSettings(true), []);
	const handleSizeSelect = useCallback((ev) => setImageSize(ev.currentTarget.dataset.optionKey), [setImageSize]);
	const handleTypeSelect = useCallback((ev) => setImageType(ev.currentTarget.dataset.optionKey), [setImageType]);
	const handleDirectionSelect = useCallback((ev) => setGridDirection(ev.currentTarget.dataset.optionKey), [setGridDirection]);
	const handleTextSelect = useCallback((ev) => setCardText(ev.currentTarget.dataset.optionKey), [setCardText]);

	// The genre and language lists are only read once the panel opens, so a
	// browse that never opens it costs nothing extra.
	const loadFilterOptions = useCallback(async () => {
		if (filterOptionsRequestedRef.current) return;
		filterOptionsRequestedRef.current = true;
		const [genres, languages] = await Promise.all([
			(mediaType === 'tv' ? seerrApi.getGenreSliderTv() : seerrApi.getGenreSliderMovies()).catch(() => []),
			seerrApi.getLanguages().catch(() => [])
		]);
		setFilterGenres(genres || []);
		setFilterLanguages((languages || [])
			.filter((l) => l.iso_639_1)
			.map((l) => ({code: l.iso_639_1, name: l.english_name || l.name || l.iso_639_1}))
			.sort((a, b) => a.name.localeCompare(b.name)));
	}, [mediaType]);

	const handleOpenFilterModal = useCallback(() => {
		loadFilterOptions();
		setShowFilterModal(true);
	}, [loadFilterOptions]);

	useEffect(() => {
		if (!backHandlerRef) return;
		const handler = () => {
			if (showFilterModal || showViewSettings) {
				setShowFilterModal(false);
				setShowViewSettings(false);
				return true;
			}
			return false;
		};
		backHandlerRef.current = handler;
		return () => { if (backHandlerRef.current === handler) backHandlerRef.current = null; };
	}, [backHandlerRef, showFilterModal, showViewSettings]);

	const handleFilterSelect = useCallback((ev) => {
		const key = ev.currentTarget?.dataset?.filterKey;
		if (key) {
			setMediaType(key);
			setShowFilterModal(false);
		}
	}, []);

	// Genres and statuses belong to one media type, so switching type drops
	// them and refetches the genre list on the next panel open.
	useEffect(() => {
		filterOptionsRequestedRef.current = false;
		setFilterGenres([]);
		setGenreIds([]);
		setTvStatuses([]);
	}, [mediaType]);

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
	const cellPadX = horizontalCellPad(cardWidth, window.innerWidth - GRID_INSET);
	const cellPadY = Math.max(MIN_ROW_GAP, focusOverhang(cardHeight));
	const gridItemSize = useMemo(
		() => ({minWidth: cardWidth + cellPadX * 2, minHeight: cardHeight + cellPadY * 2}),
		[cardWidth, cardHeight, cellPadX, cellPadY]
	);
	const cellPadding = `${cellPadY}px ${cellPadX}px`;

	const renderItem = useCallback(({index, ...rest}) => {
		const mediaItem = itemsRef.current[index];

		const itemsLoaded = itemsRef.current.length;
		const nearEnd = index >= itemsLoaded - 10;
		const hasMorePages = currentPageRef.current < totalPagesRef.current;
		const underMaxPages = currentPageRef.current < MAX_PAGES;

		if (nearEnd && hasMorePages && underMaxPages && !loadingMoreRef.current && !loadCooldownRef.current) {
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
		const itemMediaType = mediaItem.media_type || mediaItem.mediaType || mediaType;
		const status = mediaItem.mediaInfo?.status;

		return (
			<SpottableDiv
				{...rest}
				className={css.itemCard}
				style={{padding: cellPadding}}
				onClick={handleItemClick}
				data-index={index}
			>
				<div className={css.itemBody} style={{width: cardWidth}}>
				<div className={css.posterWrapper} style={{height: posterHeight}}>
					{imageUrl ? (
						<img
							className={css.poster}
							src={imageUrl}
							alt={title}
							loading="lazy"
						/>
					) : (
						<div className={css.posterPlaceholder}>
							<svg viewBox="0 0 24 24" className={css.placeholderIcon}>
								<path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z" />
							</svg>
						</div>
					)}
					{/* Media type badge - top left */}
					{itemMediaType && (
						<div className={`${css.mediaTypeBadge} ${itemMediaType === 'movie' ? css.movieBadge : css.seriesBadge}`}>
							{itemMediaType === 'movie' ? $L('Movie') : $L('Series')}
						</div>
					)}
					{/* Availability badge - top right */}
					{status && [3, 4, 5].includes(status) && (
						<div className={`${css.availabilityBadge} ${css[`availability${status}`]}`} />
					)}
				</div>
				{showCardText && (
					<div className={css.itemInfo}>
						<div className={css.itemName}>{title}</div>
						{year && (
							<div className={css.itemYear}>{year}</div>
						)}
					</div>
				)}
				</div>
			</SpottableDiv>
		);
	}, [handleItemClick, loadItems, mediaType, isWideImage, cardWidth, posterHeight, cellPadding, showCardText]);

	const currentFilter = getFilterOptions().find(o => o.key === mediaType);

	// Check if we should show the filter (not for studio/network which are media-type specific)
	const showMediaTypeFilter = browseType === 'genre' || browseType === 'keyword' || browseType === 'all';

	const getBrowseTypeLabel = () => {
		switch (browseType) {
			case 'genre': return $L('Genre');
			case 'studio': return $L('Studio');
			case 'network': return $L('Network');
			case 'keyword': return $L('Keyword');
			default: return $L('Browse');
		}
	};

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
		showMediaTypeFilter && {
			key: 'type',
			title: $L('Media Type'),
			summary: optionLabel(getFilterOptions(), mediaType),
			body: () => getFilterOptions().map((option) => (
				<FilterOption
					key={option.key}
					label={option.label}
					selected={mediaType === option.key}
					onClick={handleFilterSelect}
					data-filter-key={option.key}
				/>
			))
		},
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

	// The grid settings the library has in its gear panel, listed down the left of the popup.
	const choose = (options, value, onSelect) => options.map(([key, label]) => (
		<FilterOption key={key} label={label} selected={value === key} onClick={onSelect} data-option-key={key} />
	));
	const sizeLabels = {small: $L('Small'), medium: $L('Medium'), large: $L('Large'), extraLarge: $L('Extra Large')};
	const viewGroups = [
		{
			key: 'size',
			title: $L('Image size'),
			summary: sizeLabels[imageSize],
			body: () => choose(IMAGE_SIZES.map((key) => [key, sizeLabels[key]]), imageSize, handleSizeSelect)
		},
		{
			key: 'type',
			title: $L('Image Type'),
			summary: $L(capitalize(imageType)),
			body: () => choose([['poster', $L('Poster')], ['thumbnail', $L('Thumbnail')]], imageType, handleTypeSelect)
		},
		{
			key: 'direction',
			title: $L('Grid direction'),
			summary: $L(capitalize(gridDirection)),
			body: () => choose(GRID_DIRECTIONS.map((key) => [key, $L(capitalize(key))]), gridDirection, handleDirectionSelect)
		},
		{
			key: 'text',
			title: $L('Titles under posters'),
			summary: showCardText ? $L('On') : $L('Off'),
			body: () => choose([['on', $L('On')], ['off', $L('Off')]], showCardText ? 'on' : 'off', handleTextSelect)
		}
	];

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

	return (
		<div className={`${css.page} ${settings.navbarPosition === 'left' ? css.pageLeftNav : ''}`}>
			<div className={css.content}>
				<div className={css.header}>
					<div className={css.titleSection}>
						<div className={css.browseTypeLabel}>{getBrowseTypeLabel()}</div>
						<div className={css.title}>{item.name}</div>
						<div className={css.subtitle}>
							{currentFilter?.label}
							{totalCount > 0 && ` • ${totalCount} ${$L('items')}`}
						</div>
					</div>
				</div>

				<div className={css.toolbar}>
					<SpottableButton
						className={css.filterButton}
						onClick={handleOpenFilterModal}
					>
						<svg viewBox="0 0 24 24">
							<path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z" />
						</svg>
						{$L('Sort & Filter')}
					</SpottableButton>
					<SpottableButton
						className={css.filterButton}
						onClick={handleOpenViewSettings}
						spotlightId="seerr-browse-view-btn"
						aria-label={$L('Settings')}
					>
						<svg viewBox="0 -960 960 960">
							<path d="m388-80-20-126q-19-7-40-19t-37-25l-118 54-93-164 108-79q-2-9-2.5-20.5T185-480q0-9 .5-20.5T188-521L80-600l93-164 118 54q16-13 37-25t40-18l20-127h184l20 126q19 7 40.5 18.5T669-710l118-54 93 164-108 77q2 10 2.5 21.5t.5 21.5q0 10-.5 21t-2.5 21l108 78-93 164-118-54q-16 13-36.5 25.5T592-206L572-80H388Zm48-60h88l14-112q33-8 62.5-25t53.5-41l106 46 40-72-94-69q4-17 6.5-33.5T715-480q0-17-2-33.5t-7-33.5l94-69-40-72-106 46q-23-26-52-43.5T538-708l-14-112h-88l-14 112q-34 7-63.5 24T306-642l-106-46-40 72 94 69q-4 17-6.5 33.5T245-480q0 17 2.5 33.5T254-413l-94 69 40 72 106-46q24 24 53.5 41t62.5 25l14 112Zm44-210q54 0 92-38t38-92q0-54-38-92t-92-38q-54 0-92 38t-38 92q0 54 38 92t92 38Zm0-130Z" />
						</svg>
					</SpottableButton>
				</div>

				<div className={css.gridContainer}>
					{isLoading && items.length === 0 ? (
						<div className={css.loading}>
							<LoadingSpinner />
						</div>
					) : items.length === 0 ? (
						<div className={css.empty}>{$L('No items found')}</div>
					) : (
						<div className={css.gridWrapper}>
						<VirtualGridList
							className={css.grid}
							cbScrollTo={getScrollTo}
							dataSize={items.length}
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
				</div>
			</div>

			{showViewSettings && (
				<FilterPopup
					title={$L('Settings')}
					spotlightId="seerr-view-popup"
					groups={viewGroups}
					onClose={handleCloseModal}
				/>
			)}

			{showFilterModal && (
				<FilterPopup
					title={$L('Sort & Filter')}
					spotlightId="seerr-filter-popup"
					groups={filterGroups}
					canClear={hasSeerrDiscoverFilters(filterState)}
					onClear={handleClearFilters}
					onClose={handleCloseModal}
				/>
			)}
		</div>
	);
};

export default SeerrBrowse;
