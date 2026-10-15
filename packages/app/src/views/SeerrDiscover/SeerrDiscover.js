import {useState, useEffect, useCallback, useRef, useMemo, memo} from 'react';
import Spottable from '@enact/spotlight/Spottable';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import Spotlight from '@enact/spotlight';
import $L from '@enact/i18n/$L';
import MediaCard, {ModernMediaCard} from '../../components/MediaCard';
import LogoTile from '../../components/LogoTile';
import {useAuth} from '../../context/AuthContext';
import {useSeerr} from '../../context/SeerrContext';
import {pointerHover} from '../../utils/focusScroll';
import {useSettings} from '../../context/SettingsContext';
import seerrApi from '../../services/seerrApi';
import {seerrGenreBackdrop} from '../../utils/seerrGenreArt';
import LoadingSpinner from '../../components/LoadingSpinner';
import ScreenBackdrop from '../../components/ScreenBackdrop';
import {KEYS} from '../../utils/keys';
import hydrateRequestMediaItems from '../../utils/seerrHydration';
import {STREAMING_NETWORKS, MOVIE_STUDIOS, SEERR_SHORTCUTS, pickShortcutBackdrops, normalizeMediaItem, normalizeRequestItem} from '../../utils/seerrHomeRows';
import {libraryIdOf} from '../../utils/seerrTarget';
import {isScrolledAway} from '../../utils/quickReturn';
import {focusedCardIndex, cardToRestore, rowEntryCardIndex} from '../../utils/rowFocusMemory';
import {rememberedRowCount, rememberRowCount} from '../../utils/rowCap';

import css from './SeerrDiscover.module.less';

const SpottableDiv = Spottable('div');
const RowContainer = SpotlightContainerDecorator({
	enterTo: 'last-focused',
	restrict: 'self-first'
}, 'div');

// A row draws this many of the titles it holds, and as many more each time focus nears the last of them. Every title
// a page brings is kept, so none is skipped, and only the drawing is spread out.
const ITEMS_DRAWN = 9;
// Nearer than this to the last drawn card, the next ones are drawn
const NEAR_END = 3;

let _rowConfigs;
const getRowConfigs = () => (_rowConfigs ??= [
	{id: 'shortcuts', title: $L('Seerr Browse'), type: 'shortcut'},
	{id: 'myRequests', title: $L('Recent Requests'), type: 'request'},
	{id: 'trending', title: $L('Trending Now'), type: 'media', fetchFn: 'trending'},
	{id: 'popularMovies', title: $L('Popular Movies'), type: 'media', fetchFn: 'trendingMovies'},
	{id: 'popularTv', title: $L('Popular TV Shows'), type: 'media', fetchFn: 'trendingTv'},
	{id: 'genreMovies', title: $L('Browse Movies by Genre'), type: 'genre', mediaType: 'movie'},
	{id: 'genreTv', title: $L('Browse TV by Genre'), type: 'genre', mediaType: 'tv'},
	{id: 'studios', title: $L('Browse by Studio'), type: 'studio'},
	{id: 'networks', title: $L('Browse by Network'), type: 'network'},
	{id: 'upcomingMovies', title: $L('Upcoming Movies'), type: 'media', fetchFn: 'upcomingMovies'},
	{id: 'upcomingTv', title: $L('Upcoming TV Shows'), type: 'media', fetchFn: 'upcomingTv'}
]);

// Discover stays off this copy of the row, since this screen is the
// destination it would point at.
const getShortcuts = (trendingResults = []) => {
	const shortcuts = SEERR_SHORTCUTS.filter((shortcut) => shortcut.key !== 'discover');
	const shuffled = trendingResults.slice().sort(() => Math.random() - 0.5);
	const backdrops = pickShortcutBackdrops(shortcuts, shuffled);
	return shortcuts.map((shortcut) => ({
		key: shortcut.key,
		name: shortcut.name(),
		backdrop: backdrops[shortcut.key]
	}));
};

// Where a request stands, as its card words it. Request status wins only for declined and failed.
const requestStatusText = (request) => {
	const requestStatus = request.status;
	const mediaStatus = request.media?.status;
	if (requestStatus === 1) return $L('Pending');
	if (requestStatus === 3) return $L('Declined');
	if (requestStatus === 4) return $L('Failed');
	if (requestStatus === 5 || mediaStatus === 5) return $L('Available');
	if (mediaStatus === 4) return $L('Partial');
	if (mediaStatus === 3) return $L('Requested');
	if (requestStatus === 2) return $L('Approved');
	return $L('Unknown');
};

// The rows that are showing, in order. Rows arrive one at a time and the ones above push the rest
// down, so a row's focus id is its own name: ids by position were forgotten by Spotlight when the
// row that had registered them was replaced by the one that arrived above it.
let shownRowIds = [];
const rowSpotlightId = (rowIndex) => `discover-row-${shownRowIds[rowIndex]}`;

let lastFocusedRowId = null;
let lastFocusedCardIndex = -1;

// The poster cards are Home's own, in whichever style Home is set to, so they follow its card size,
// image type and focus behaviour. Each is handed what Seerr sent and shaped like a library item here.
const HomeCard = memo(function HomeCard({entry, index, isRequest, mediaType, modern, serverUrl, isFocused, onSelect, onFocusItem, onFocused}) {
	const item = useMemo(() => (isRequest ? {
		...normalizeRequestItem(entry),
		// One title can carry more than one request, and each keeps a card of its own
		Id: `seerr-request-${entry.id}`,
		Subtitle: requestStatusText(entry)
	} : normalizeMediaItem(entry)), [entry, isRequest]);

	const handleSelect = useCallback(() => {
		if (!isRequest) {
			onSelect?.(entry, mediaType);
			return;
		}
		const media = entry.media;
		onSelect?.({
			id: media?.tmdbId,
			tmdbId: media?.tmdbId,
			title: media?.title,
			name: media?.name,
			poster_path: media?.posterPath,
			backdrop_path: media?.backdropPath,
			overview: media?.overview,
			media_type: entry.type,
			mediaType: entry.type,
			_seerrLibraryId: libraryIdOf(media)
		}, entry.type);
	}, [entry, isRequest, mediaType, onSelect]);

	const handleFocusItem = useCallback(() => {
		const media = entry.media;
		onFocusItem?.(isRequest
			? {backdrop_path: media?.backdropPath, title: media?.title || media?.name, overview: media?.overview}
			: entry, index);
	}, [entry, index, isRequest, onFocusItem]);

	const Card = modern ? ModernMediaCard : MediaCard;
	return (
		<Card
			item={item}
			serverUrl={serverUrl}
			cardType="portrait"
			isFocused={isFocused}
			onFocused={onFocused}
			onSelect={handleSelect}
			onFocusItem={handleFocusItem}
		/>
	);
});

// A tile stands for a way of browsing and not a title, so focusing one takes the backdrop of the last card away.
const ShortcutCard = memo(function ShortcutCard({shortcut, onSelect, onFocus}) {
	const backdropUrl = shortcut.backdrop ? seerrApi.getImageUrl(shortcut.backdrop, 'w780') : '';

	const handleClick = useCallback(() => {
		onSelect?.(shortcut.key);
	}, [shortcut.key, onSelect]);

	const handleFocus = useCallback(() => onFocus?.(null), [onFocus]);

	return (
		<SpottableDiv className={css.genreCard} onClick={handleClick} onFocus={handleFocus}>
			{backdropUrl && <img className={css.genreBackdrop} src={backdropUrl} alt={shortcut.name} loading="lazy" />}
			<div className={css.genreOverlay}>
				<span className={css.genreTitle}>{shortcut.name}</span>
			</div>
		</SpottableDiv>
	);
});

const GenreCard = memo(function GenreCard({genre, mediaType, onSelect, onFocus}) {
	const art = seerrGenreBackdrop(genre.id, genre.backdrops);
	const backdropUrl = art ? seerrApi.getImageUrl(art.path, art.size) : '';

	const handleClick = useCallback(() => {
		onSelect?.(genre.id, genre.name, mediaType);
	}, [genre.id, genre.name, mediaType, onSelect]);

	const handleFocus = useCallback(() => onFocus?.(null), [onFocus]);

	return (
		<SpottableDiv className={css.genreCard} onClick={handleClick} onFocus={handleFocus}>
			{backdropUrl && <img className={css.genreBackdrop} src={backdropUrl} alt={genre.name} loading="lazy" />}
			<div className={css.genreOverlayFlat}>
				<span className={css.genreTitleSeerr}>{genre.name}</span>
			</div>
		</SpottableDiv>
	);
});

const NetworkCard = memo(function NetworkCard({network, onSelect, onFocus}) {
	const logoUrl = seerrApi.getImageUrl('/' + network.logo, 'w185');

	const handleClick = useCallback(() => {
		onSelect?.(network.id, network.name);
	}, [network.id, network.name, onSelect]);

	const handleFocus = useCallback(() => onFocus?.(null), [onFocus]);

	return <LogoTile url={logoUrl} name={network.name} onClick={handleClick} onFocus={handleFocus} />;
});

const StudioCard = memo(function StudioCard({studio, onSelect, onFocus}) {
	const logoUrl = seerrApi.getImageUrl('/' + studio.logo, 'w185');

	const handleClick = useCallback(() => {
		onSelect?.(studio.id, studio.name);
	}, [studio.id, studio.name, onSelect]);

	const handleFocus = useCallback(() => onFocus?.(null), [onFocus]);

	return <LogoTile url={logoUrl} name={studio.name} onClick={handleClick} onFocus={handleFocus} />;
});

// Memoized row component
const DiscoverRow = memo(function DiscoverRow({
	config,
	items,
	rowIndex,
	isLoading,
	onSelectItem,
	onSelectGenre,
	onSelectNetwork,
	onSelectStudio,
	onOpenShortcut,
	onFocusItem,
	onNavigateUp,
	onNavigateDown,
	onLoadMore,
	onRowFocus,
	onRowInView,
	spotlightId,
	modern,
	serverUrl,
	rowSpacing
}) {
	const scrollerRef = useRef(null);
	// How many of the titles are drawn. A row that comes back, as they do after a details screen, starts where
	// it left off, so the card focus is put back on is drawn.
	const countKey = `discover-${config.id}`;
	const [drawn, setDrawn] = useState(() => rememberedRowCount(countKey) ?? ITEMS_DRAWN);
	useEffect(() => {
		rememberRowCount(countKey, drawn);
	}, [countKey, drawn]);
	const visibleItems = config.type === 'media' ? items.slice(0, drawn) : items;
	// A modern card opens up to show its details while it holds focus, which the row has to know.
	const [focusedId, setFocusedId] = useState(null);
	const handleBlur = useCallback((e) => {
		if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget)) return;
		setFocusedId(null);
	}, []);

	// Near the last drawn card the next ones are drawn, and near the last one held the next page is asked for.
	const handleCardFocus = useCallback((info, index) => {
		onFocusItem?.(info);
		if (config.type === 'media' && index >= drawn - NEAR_END) {
			setDrawn((current) => (current < items.length ? Math.min(items.length, current + ITEMS_DRAWN) : current));
		}
		if (index >= items.length - NEAR_END) onLoadMore?.(config.id);
	}, [onFocusItem, onLoadMore, items.length, config.id, config.type, drawn]);

	const handleKeyDown = useCallback((e) => {
		if (e.keyCode === KEYS.UP) {
			e.preventDefault();
			e.stopPropagation();
			onNavigateUp?.(rowIndex);
		} else if (e.keyCode === KEYS.DOWN) {
			e.preventDefault();
			e.stopPropagation();
			onNavigateDown?.(rowIndex);
		} else if (e.keyCode === KEYS.LEFT) {
			const firstSpottable = e.currentTarget.querySelector('.spottable');
			if (firstSpottable && firstSpottable.contains(document.activeElement)) {
				e.preventDefault();
				e.stopPropagation();
				Spotlight.focus('navbar');
			}
		}
	}, [rowIndex, onNavigateUp, onNavigateDown]);

	const handleFocus = useCallback((e) => {
		onRowFocus?.(rowIndex);

		const card = e.target.closest('.spottable');
		const scroller = scrollerRef.current;
		const hover = pointerHover();
		if (card && scroller && !hover) {
			const cardRect = card.getBoundingClientRect();
			const scrollerRect = scroller.getBoundingClientRect();
			if (cardRect.left < scrollerRect.left) {
				scroller.scrollLeft -= (scrollerRect.left - cardRect.left + 50);
			} else if (cardRect.right > scrollerRect.right) {
				scroller.scrollLeft += (cardRect.right - scrollerRect.right + 50);
			}
		}

		if (!hover) onRowInView?.(rowIndex);
	}, [rowIndex, onRowFocus, onRowInView]);

	const renderCards = useMemo(() => {
		switch (config.type) {
			case 'shortcut':
				return items.map(item => (
					<ShortcutCard key={item.key} shortcut={item} onSelect={onOpenShortcut} onFocus={onFocusItem} />
				));
			case 'request':
				return items.filter((entry) => entry?.media?.tmdbId).map((entry, index) => (
					<HomeCard
						key={entry.id}
						entry={entry}
						index={index}
						isRequest
						modern={modern}
						serverUrl={serverUrl}
						isFocused={focusedId === `seerr-request-${entry.id}`}
						onSelect={onSelectItem}
						onFocusItem={handleCardFocus}
						onFocused={setFocusedId}
					/>
				));
			case 'genre':
				return items.map(item => (
					<GenreCard
						key={item.id}
						genre={item}
						mediaType={config.mediaType}
						onSelect={onSelectGenre}
						onFocus={onFocusItem}
					/>
				));
			case 'network':
				return items.map(item => (
					<NetworkCard key={item.id} network={item} onSelect={onSelectNetwork} onFocus={onFocusItem} />
				));
			case 'studio':
				return items.map(item => (
					<StudioCard key={item.id} studio={item} onSelect={onSelectStudio} onFocus={onFocusItem} />
				));
			default:
				return visibleItems.map((entry, index) => (
					<HomeCard
						key={entry.id}
						entry={entry}
						index={index}
						mediaType={config.mediaType}
						modern={modern}
						serverUrl={serverUrl}
						isFocused={focusedId === `seerr-${entry.media_type || entry.mediaType || (entry.title ? 'movie' : 'tv')}-${entry.id}`}
						onSelect={onSelectItem}
						onFocusItem={handleCardFocus}
						onFocused={setFocusedId}
					/>
				));
		}
	}, [config.type, config.mediaType, items, visibleItems, onSelectItem, onSelectGenre, onSelectNetwork, onSelectStudio, onOpenShortcut, onFocusItem, handleCardFocus, focusedId, modern, serverUrl]);

	return (
		<div
			className={css.contentRow}
			data-row-index={rowIndex}
			style={typeof rowSpacing === 'number' ? {marginBottom: rowSpacing} : undefined}
		>
			<h2 className={css.rowTitle}>{config.title}</h2>
			<div className={css.rowScroller} ref={scrollerRef}>
				<RowContainer
					className={css.rowItems}
					spotlightId={spotlightId}
					onKeyDown={handleKeyDown}
					onFocus={handleFocus}
					onBlur={handleBlur}
				>
					{renderCards}
					{isLoading && (
						<div className={css.rowLoadingIndicator}>
							<span>{$L('Loading...')}</span>
						</div>
					)}
				</RowContainer>
			</div>
		</div>
	);
});

// Badge count survives panel switches for a short while so revisiting
// discover doesn't refetch the counts every time.
let cachedBadge = {count: 0, at: 0};
const BADGE_TTL_MS = 60000;

const SeerrDiscover = ({onSelectItem, onSelectGenre, onSelectNetwork, onSelectStudio, onOpenRequests, onOpenShortcut, backHandlerRef}) => {
	const {isAuthenticated, isEnabled, user: contextUser} = useSeerr();
	const {serverUrl} = useAuth();
	const {settings} = useSettings();
	const useModernCards = settings.homeRowsStyle !== 'v1';
	// Home puts the focused title's details above the rows only in its classic layout, and a modern
	// card carries its own. With the band in the way a screen holds one row, so this follows Home.
	const showDetailSection = !useModernCards && settings.homeRowOverlay !== false;
	// The other clients size these sliders in their own units, so the stored value lands here as the
	// space below each row, the way Home works it out.
	const rowSpacing = settings.fullScreenRows ? null : useModernCards
		? Math.max(0, Math.min(Math.max((settings.modernHomeRowsPadding ?? 460) - 400, -40), 200) - 34)
		: Math.max(0, settings.classicHomeRowsPadding ?? 30);
	const [rows, setRows] = useState({});
	const [rowPages, setRowPages] = useState({});
	const [rowHasMore, setRowHasMore] = useState({});
	const [rowLoading, setRowLoading] = useState({});
	const [isLoading, setIsLoading] = useState(true);
	const [focusedItem, setFocusedItem] = useState(null);
	const [requestsBadge, setRequestsBadge] = useState(cachedBadge.count);
	const initialFocusDoneRef = useRef(false);
	const rowsRef = useRef({});
	// Set when the rows have taken long enough that focus goes to what is there rather than waiting.
	const [gaveUpWaiting, setGaveUpWaiting] = useState(false);
	// Pressing Discover in the navigation while it is open brings its rows in again.
	const [reloadKey, setReloadKey] = useState(0);
	useEffect(() => {
		const handleRefresh = () => setReloadKey((key) => key + 1);
		window.addEventListener('moonfin:seerrDiscoverRefresh', handleRefresh);
		return () => window.removeEventListener('moonfin:seerrDiscoverRefresh', handleRefresh);
	}, []);
	const rowsContainerRef = useRef(null);

	// Back on a scrolled discover list returns it to the first row before it leaves
	useEffect(() => {
		if (!backHandlerRef) return undefined;
		const handler = () => {
			const container = rowsContainerRef.current;
			if (!isScrolledAway(container)) return false;
			container.scrollTop = 0;
			Spotlight.focus(rowSpotlightId(0));
			return true;
		};
		backHandlerRef.current = handler;
		return () => {
			if (backHandlerRef.current === handler) backHandlerRef.current = null;
		};
	}, [backHandlerRef]);

	useEffect(() => {
		if (!isAuthenticated) return;
		if (Date.now() - cachedBadge.at < BADGE_TTL_MS) {
			setRequestsBadge(cachedBadge.count);
			return;
		}
		let stale = false;
		seerrApi.getUser().catch(() => null).then(async (u) => {
			if (stale) return;
			const perms = u?.permissions;
			let count = 0;
			if (seerrApi.canManageRequests(perms)) {
				count += await seerrApi.getRequestCount().then(c => c?.pending || 0).catch(() => 0);
			}
			if (seerrApi.canManageIssues(perms)) {
				count += await seerrApi.getIssueCount().then(c => c?.open || 0).catch(() => 0);
			}
			if (!stale) {
				cachedBadge = {count, at: Date.now()};
				setRequestsBadge(count);
			}
		});
		return () => {
			stale = true;
		};
	}, [isAuthenticated]);

	// Each row is drawn as its own answer arrives, so the screen is up with the first of them
	// instead of waiting for the slowest of eleven requests.
	useEffect(() => {
		if (!isAuthenticated) {
			setIsLoading(false);
			return undefined;
		}
		let stale = false;
		setIsLoading(Object.keys(rowsRef.current).length === 0);
		const put = (patch) => {
			if (stale) return;
			setRows((prev) => ({...prev, ...patch}));
			setIsLoading(false);
		};
		const paged = (id, response) => {
			if (stale) return;
			const results = response?.results || [];
			put({[id]: results});
			setRowPages((prev) => ({...prev, [id]: 1}));
			// The API returns 20 per page, so a full page means there is probably more.
			setRowHasMore((prev) => ({...prev, [id]: results.length >= 20}));
		};
		const empty = {results: []};

		seerrApi.trending().catch(() => empty).then((data) => {
			paged('trending', data);
			// The studio and network rows need no request, but they are shown with the first row that
			// does, so the screen is never up with only them and focus does not land on them.
			put({shortcuts: getShortcuts(data.results || []), studios: MOVIE_STUDIOS, networks: STREAMING_NETWORKS});
		});
		seerrApi.trendingMovies(1).catch(() => empty).then((data) => paged('popularMovies', data));
		seerrApi.trendingTv(1).catch(() => empty).then((data) => paged('popularTv', data));
		seerrApi.upcomingMovies(1).catch(() => empty).then((data) => paged('upcomingMovies', data));
		seerrApi.upcomingTv(1).catch(() => empty).then((data) => paged('upcomingTv', data));
		seerrApi.getGenreSliderMovies().catch(() => []).then((genres) => put({genreMovies: genres || []}));
		seerrApi.getGenreSliderTv().catch(() => []).then((genres) => put({genreTv: genres || []}));

		// Prefer the context user (Moonfin) or fall back to the API user. The requests are drawn as they
		// come, and again once their missing details have been filled in.
		(async () => {
			const apiUser = await seerrApi.getUser().catch(() => null);
			const currentUser = contextUser?.seerrUserId ? {id: contextUser.seerrUserId, ...apiUser} : apiUser;
			if (!currentUser?.id) return;
			const mine = await seerrApi.getMyRequests(currentUser.id, 50).catch((e) => { console.error('[SeerrDiscover] myRequests error:', e); return empty; });
			put({myRequests: mine.results || []});
			const hydrated = await hydrateRequestMediaItems(mine.results || []).catch(() => null);
			if (hydrated) put({myRequests: hydrated});
		})();

		return () => { stale = true; };
	}, [isAuthenticated, contextUser?.seerrUserId, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

	// Load more items for a specific row
	const loadMoreForRow = useCallback(async (rowId) => {
		if (rowLoading[rowId] || !rowHasMore[rowId]) return;

		const config = getRowConfigs().find(r => r.id === rowId);
		if (!config || !config.fetchFn) return;

		setRowLoading(prev => ({...prev, [rowId]: true}));

		try {
			const currentPage = rowPages[rowId] || 1;
			const nextPage = currentPage + 1;

			let data;
			switch (config.fetchFn) {
				case 'trending':
					data = await seerrApi.trending(nextPage);
					break;
				case 'trendingMovies':
					data = await seerrApi.trendingMovies(nextPage);
					break;
				case 'trendingTv':
					data = await seerrApi.trendingTv(nextPage);
					break;
				case 'upcomingMovies':
					data = await seerrApi.upcomingMovies(nextPage);
					break;
				case 'upcomingTv':
					data = await seerrApi.upcomingTv(nextPage);
					break;
				default:
					return;
			}

			const newItems = data.results || [];
			if (newItems.length > 0) {
				setRows(prev => {
					const existingIds = new Set((prev[rowId] || []).map(item => item.id));
					const uniqueNew = newItems.filter(item => !existingIds.has(item.id));
					return {...prev, [rowId]: [...(prev[rowId] || []), ...uniqueNew]};
				});
				setRowPages(prev => ({...prev, [rowId]: nextPage}));
				setRowHasMore(prev => ({...prev, [rowId]: newItems.length >= 20}));
			} else {
				setRowHasMore(prev => ({...prev, [rowId]: false}));
			}
		} catch (err) {
			console.error(`Failed to load more for ${rowId}:`, err);
		} finally {
			setRowLoading(prev => ({...prev, [rowId]: false}));
		}
	}, [rowLoading, rowHasMore, rowPages]);

	// The detail panel and the backdrop behind the rows follow the card in focus.
	const handleItemFocus = useCallback((item) => {
		setFocusedItem(item);
	}, []);

	// A row rests at the top of the list, the way Home rests its rows, with the details of the focused card
	// growing below it. Focus scrolling lands wherever the engine likes and after the handler, and the card
	// that just lost focus is still shrinking, so the row is put back on the frames behind it too.
	const keepRowInView = useCallback((rowIndex) => {
		const rest = () => {
			const container = rowsContainerRef.current;
			const row = container && container.querySelector(`[data-row-index="${rowIndex}"]`);
			if (!container || !row) return;
			const offset = showDetailSection && settings.navbarPosition !== 'left' ? 20 : 0;
			// the first row sits under a margin of its own, which is not scrolled away
			const top = rowIndex === 0 ? 0 : row.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - offset;
			if (Math.abs(container.scrollTop - top) > 1) container.scrollTop = Math.max(0, top);
		};
		rest();
		window.requestAnimationFrame(rest);
		window.requestAnimationFrame(() => window.requestAnimationFrame(rest));
	}, [showDetailSection, settings.navbarPosition]);

	const handleSelectItem = useCallback((item, mediaType) => {
		const type = mediaType || item.media_type || item.mediaType || (item.title ? 'movie' : 'tv');
		lastFocusedCardIndex = focusedCardIndex(`discover-row-${lastFocusedRowId}`, document.activeElement);
		onSelectItem?.({
			mediaId: item.id,
			mediaType: type,
			libraryId: item._seerrLibraryId || libraryIdOf(item.mediaInfo)
		});
	}, [onSelectItem]);

	rowsRef.current = rows;
	const visibleRows = useMemo(() => {
		const shown = getRowConfigs().filter(r => rows[r.id]?.length > 0);
		shownRowIds = shown.map((row) => row.id);
		return shown;
	}, [rows]);

	const handleRequestsPillKeyDown = useCallback((e) => {
		if (e.keyCode === KEYS.UP || e.keyCode === KEYS.LEFT) {
			e.preventDefault();
			e.stopPropagation();
			Spotlight.focus('navbar');
		} else if (e.keyCode === KEYS.DOWN) {
			e.preventDefault();
			e.stopPropagation();
			Spotlight.focus(rowSpotlightId(0));
		}
	}, []);

	// Focus moves into a row by the settings: the card the row remembers, its first card, or the one at the same spot
	const enterRow = useCallback((targetIndex) => {
		const rowId = rowSpotlightId(targetIndex);
		const index = rowEntryCardIndex(settings);
		const card = typeof index === 'number' ? cardToRestore(rowId, index) : null;
		if (!card || !Spotlight.focus(card)) Spotlight.focus(rowId);
	}, [settings]);

	const handleNavigateUp = useCallback((fromRowIndex) => {
		if (fromRowIndex === 0) {
			// The requests pill sits between the rows and the navbar.
			if (Spotlight.focus('discover-requests-pill')) {
				return;
			}
			Spotlight.focus('navbar');
			return;
		}
		const targetIndex = fromRowIndex - 1;
		enterRow(targetIndex);
		keepRowInView(targetIndex);
	}, [keepRowInView, enterRow]);

	const handleNavigateDown = useCallback((fromRowIndex) => {
		const targetIndex = fromRowIndex + 1;
		if (targetIndex >= visibleRows.length) return;
		enterRow(targetIndex);
		keepRowInView(targetIndex);
	}, [visibleRows.length, keepRowInView, enterRow]);

	const handleRowFocus = useCallback((rowIndex) => {
		if (typeof rowIndex === 'number') {
			// A card index only means anything in the row it came from.
			const rowId = shownRowIds[rowIndex];
			if (rowId !== lastFocusedRowId) lastFocusedCardIndex = -1;
			lastFocusedRowId = rowId;
		}
	}, []);

	// Focus goes to the row it was left on, or to the first row, once that row is up. Rows come in as
	// they are answered, so it waits for it a few seconds and otherwise takes what is there. Rows that
	// arrive after that are not allowed to pull it back.
	useEffect(() => {
		const timer = window.setTimeout(() => setGaveUpWaiting(true), 4000);
		return () => window.clearTimeout(timer);
	}, []);

	useEffect(() => {
		if (isLoading || visibleRows.length === 0 || initialFocusDoneRef.current) return;
		const wanted = lastFocusedRowId || 'shortcuts';
		if (!shownRowIds.includes(wanted) && !gaveUpWaiting) return;
		initialFocusDoneRef.current = true;
		setTimeout(() => {
			const savedIndex = lastFocusedRowId ? shownRowIds.indexOf(lastFocusedRowId) : -1;
			if (savedIndex >= 0) {
				const rowId = rowSpotlightId(savedIndex);
				const card = cardToRestore(rowId, lastFocusedCardIndex);
				if (!card || !Spotlight.focus(card)) {
					Spotlight.focus(rowId);
				}
				keepRowInView(savedIndex);
			} else {
				Spotlight.focus(rowSpotlightId(0));
			}
		}, 100);
	}, [isLoading, visibleRows.length, gaveUpWaiting, keepRowInView]);

	if (!isEnabled) {
		return (
			<div className={css.container}>
				<div className={css.notConfigured}>
					<p>{$L('Seerr is not enabled.')}</p>
					<p>{$L('Go to Settings to configure Seerr.')}</p>
				</div>
			</div>
		);
	}

	if (!isAuthenticated) {
		return (
			<div className={css.container}>
				<div className={css.notConfigured}>
					<p>{$L('Seerr is not authenticated.')}</p>
					<p>{$L('Go to Settings to log in to Seerr.')}</p>
				</div>
			</div>
		);
	}

	return (
		<div className={css.container}>
			<ScreenBackdrop item={focusedItem} />
			{!isLoading && isAuthenticated && onOpenRequests && (
				<SpottableDiv
					className={`${css.requestsPill} ${settings.navbarPosition === 'left' ? '' : (showDetailSection ? css.requestsPillBelowNav : css.requestsPillInBar)}`}
					spotlightId="discover-requests-pill"
					onClick={onOpenRequests}
					onKeyDown={handleRequestsPillKeyDown}
				>
					{$L('Requests')}
					{requestsBadge > 0 && <span className={css.requestsPillBadge}>{requestsBadge}</span>}
				</SpottableDiv>
			)}
			{isLoading ? (
				<LoadingSpinner />
			) : (
				<div className={`${css.mainContent} ${settings.navbarPosition === 'left' ? css.sidebarOffset : ''}`}>
					{showDetailSection && <div className={css.detailSection}>
						{focusedItem && (focusedItem.title || focusedItem.name) ? (
							<>
								<h2 className={css.detailTitle}>{focusedItem.title || focusedItem.name}</h2>
								<div className={css.detailMeta}>
									{focusedItem.vote_average > 0 && (
										<span className={css.detailRating}>★ {focusedItem.vote_average?.toFixed(1)}</span>
									)}
									{(focusedItem.release_date || focusedItem.first_air_date) && (
										<span className={css.detailYear}>
											{(focusedItem.release_date || focusedItem.first_air_date)?.substring(0, 4)}
										</span>
									)}
								</div>
								{focusedItem.overview && (
									<p className={css.detailOverview}>{focusedItem.overview}</p>
								)}
							</>
						) : (
							<h2 className={css.detailTitle}>{$L('Discover')}</h2>
						)}
					</div>}
					<div
						className={`${css.rowsContainer} ${showDetailSection || settings.navbarPosition === 'left' ? '' : css.rowsBelowNav}`}
						ref={rowsContainerRef}
					>
						{visibleRows.map((config, index) => (
							<DiscoverRow
								key={config.id}
								config={config}
								items={rows[config.id] || []}
								rowIndex={index}
								isLoading={rowLoading[config.id]}
								onSelectItem={handleSelectItem}
								onSelectGenre={onSelectGenre}
								onSelectNetwork={onSelectNetwork}
								onSelectStudio={onSelectStudio}
								onOpenShortcut={onOpenShortcut}
								onFocusItem={handleItemFocus}
								onNavigateUp={handleNavigateUp}
								onNavigateDown={handleNavigateDown}
								onLoadMore={loadMoreForRow}
								onRowFocus={handleRowFocus}
								onRowInView={keepRowInView}
								spotlightId={`discover-row-${config.id}`}
								modern={useModernCards}
								serverUrl={serverUrl}
								rowSpacing={rowSpacing}
							/>
						))}
					</div>
				</div>
			)}
		</div>
	);
};

export default SeerrDiscover;
