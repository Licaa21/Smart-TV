import {useState, useEffect, useCallback, useRef, useMemo} from 'react';
import Spottable from '@enact/spotlight/Spottable';
import Spotlight from '@enact/spotlight';
import $L from '@enact/i18n/$L';
import {useAuth} from '../../context/AuthContext';
import {useSeerr} from '../../context/SeerrContext';
import {useSettings} from '../../context/SettingsContext';
import seerrApi from '../../services/seerrApi';
import LoadingSpinner from '../../components/LoadingSpinner';
import {ClassicMediaRow, ModernMediaRow} from '../../components/MediaRow';
import SeerrTileRow from '../../components/SeerrTileRow';
import {KEYS} from '../../utils/keys';
import hydrateRequestMediaItems from '../../utils/seerrHydration';
import {
	STREAMING_NETWORKS, MOVIE_STUDIOS, SEERR_SHORTCUTS, pickShortcutBackdrops,
	normalizeMediaItem, normalizeRequestItem, normalizeShortcutItem, normalizeGenreItem,
	normalizeStudioItem, normalizeNetworkItem
} from '../../utils/seerrHomeRows';
import {isScrolledAway} from '../../utils/quickReturn';
import {focusedCardIndex, cardToRestore} from '../../utils/rowFocusMemory';

import css from './SeerrDiscover.module.less';

const SpottableDiv = Spottable('div');
const ITEMS_PER_PAGE = 9;

// The rows are the same ones Home draws for Seerr, so each is shown with the cards Home uses for
// its kind: posters for titles and requests, landscape tiles for the shortcuts and genres, and
// logos for the studios and networks.
let _rowConfigs;
const getRowConfigs = () => (_rowConfigs ??= [
	{id: 'shortcuts', title: $L('Seerr Browse'), type: 'shortcut', cardType: 'landscape', tile: true},
	{id: 'myRequests', title: $L('Recent Requests'), type: 'request', cardType: 'portrait'},
	{id: 'trending', title: $L('Trending Now'), type: 'media', cardType: 'portrait', fetchFn: 'trending'},
	{id: 'popularMovies', title: $L('Popular Movies'), type: 'media', cardType: 'portrait', fetchFn: 'trendingMovies'},
	{id: 'popularTv', title: $L('Popular TV Shows'), type: 'media', cardType: 'portrait', fetchFn: 'trendingTv'},
	{id: 'genreMovies', title: $L('Browse Movies by Genre'), type: 'genre', mediaType: 'movie', cardType: 'landscape', tile: true},
	{id: 'genreTv', title: $L('Browse TV by Genre'), type: 'genre', mediaType: 'tv', cardType: 'landscape', tile: true},
	{id: 'studios', title: $L('Browse by Studio'), type: 'studio', cardType: 'logo', tile: true},
	{id: 'networks', title: $L('Browse by Network'), type: 'network', cardType: 'logo', tile: true},
	{id: 'upcomingMovies', title: $L('Upcoming Movies'), type: 'media', cardType: 'portrait', fetchFn: 'upcomingMovies'},
	{id: 'upcomingTv', title: $L('Upcoming TV Shows'), type: 'media', cardType: 'portrait', fetchFn: 'upcomingTv'}
]);

// Discover stays off this copy of the row, since this screen is the
// destination it would point at.
const getShortcuts = (trendingResults = []) => {
	const shortcuts = SEERR_SHORTCUTS.filter((shortcut) => shortcut.key !== 'discover');
	const shuffled = trendingResults.slice().sort(() => Math.random() - 0.5);
	const backdrops = pickShortcutBackdrops(shortcuts, shuffled);
	return shortcuts.map((shortcut) => normalizeShortcutItem(shortcut, backdrops[shortcut.key]));
};

let lastFocusedRowIndex = null;
let lastFocusedCardIndex = -1;

// Badge count survives panel switches for a short while so revisiting
// discover doesn't refetch the counts every time.
let cachedBadge = {count: 0, at: 0};
const BADGE_TTL_MS = 60000;

const SeerrDiscover = ({onSelectItem, onSelectGenre, onSelectNetwork, onSelectStudio, onOpenRequests, onOpenShortcut, backHandlerRef}) => {
	const {isAuthenticated, isEnabled, user: contextUser} = useSeerr();
	const {serverUrl} = useAuth();
	const {settings} = useSettings();
	// Drawn with the rows and cards Home uses, so it follows the Home settings for style and artwork.
	const useModernRows = settings.homeRowsStyle !== 'v1';
	const RowComponent = useModernRows ? ModernMediaRow : ClassicMediaRow;
	// Home only puts the focused title's info above the rows in the classic layout, where the modern
	// cards carry their own, so this follows it.
	const showDetailSection = !useModernRows && settings.homeRowOverlay !== false;
	const rowSpacing = settings.fullScreenRows ? null : useModernRows
		? Math.max(0, Math.min(Math.max((settings.modernHomeRowsPadding ?? 460) - 400, -40), 200) - 34)
		: Math.max(0, settings.classicHomeRowsPadding ?? 30);
	const [rows, setRows] = useState({});
	const [rowPages, setRowPages] = useState({});
	const [rowHasMore, setRowHasMore] = useState({});
	const [rowLoading, setRowLoading] = useState({});
	const [isLoading, setIsLoading] = useState(true);
	const [backdropUrl, setBackdropUrl] = useState('');
	const [focusedItem, setFocusedItem] = useState(null);
	const [requestsBadge, setRequestsBadge] = useState(cachedBadge.count);
	const backdropTimeoutRef = useRef(null);
	const rowsContainerRef = useRef(null);

	// Back on a scrolled discover list returns it to the first row before it leaves
	useEffect(() => {
		if (!backHandlerRef) return undefined;
		const handler = () => {
			const container = rowsContainerRef.current;
			if (!isScrolledAway(container)) return false;
			container.scrollTop = 0;
			Spotlight.focus('discover-row-0');
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

	useEffect(() => {
		return () => {
			if (backdropTimeoutRef.current) {
				clearTimeout(backdropTimeoutRef.current);
			}
		};
	}, []);

	useEffect(() => {
		const loadInitialData = async () => {
			if (!isAuthenticated) return;
			setIsLoading(true);
			try {
				// Prefer context user (Moonfin) or fall back to API user
				const apiUser = await seerrApi.getUser().catch(() => null);
				const currentUser = contextUser?.seerrUserId
					? {id: contextUser.seerrUserId, ...apiUser}
					: apiUser;

				const [
					myRequestsData,
					trendingData,
					moviesData,
					tvData,
					genreMovies,
					genreTv,
					upcomingMoviesData,
					upcomingTvData
				] = await Promise.all([
					currentUser?.id ? seerrApi.getMyRequests(currentUser.id, 50).catch((e) => { console.error('[SeerrDiscover] myRequests error:', e); return {results: []}; }) : {results: []},
					seerrApi.trending().catch(() => ({results: []})),
					seerrApi.trendingMovies(1).catch(() => ({results: []})),
					seerrApi.trendingTv(1).catch(() => ({results: []})),
					seerrApi.getGenreSliderMovies().catch(() => []),
					seerrApi.getGenreSliderTv().catch(() => []),
					seerrApi.upcomingMovies(1).catch(() => ({results: []})),
					seerrApi.upcomingTv(1).catch(() => ({results: []}))
				]);

				const hydratedMyRequests = await hydrateRequestMediaItems(myRequestsData.results || []);

				setRows({
					shortcuts: getShortcuts(trendingData.results || []),
					myRequests: hydratedMyRequests,
					trending: (trendingData.results || []).slice(0, ITEMS_PER_PAGE),
					popularMovies: (moviesData.results || []).slice(0, ITEMS_PER_PAGE),
					popularTv: (tvData.results || []).slice(0, ITEMS_PER_PAGE),
					genreMovies: genreMovies || [],
					genreTv: genreTv || [],
					studios: MOVIE_STUDIOS,
					networks: STREAMING_NETWORKS,
					upcomingMovies: (upcomingMoviesData.results || []).slice(0, ITEMS_PER_PAGE),
					upcomingTv: (upcomingTvData.results || []).slice(0, ITEMS_PER_PAGE)
				});

				// Track pagination state
				setRowPages({
					trending: 1,
					popularMovies: 1,
					popularTv: 1,
					upcomingMovies: 1,
					upcomingTv: 1
				});

				// Track if more items available (API returns 20 per page, so if we got 20, there's likely more)
				setRowHasMore({
					trending: (trendingData.results || []).length >= 20,
					popularMovies: (moviesData.results || []).length >= 20,
					popularTv: (tvData.results || []).length >= 20,
					upcomingMovies: (upcomingMoviesData.results || []).length >= 20,
					upcomingTv: (upcomingTvData.results || []).length >= 20
				});
			} catch (err) {
				console.error('Failed to load Seerr data:', err);
			} finally {
				setIsLoading(false);
			}
		};

		if (isAuthenticated) {
			loadInitialData();
		} else {
			setIsLoading(false);
		}
	}, [isAuthenticated, contextUser]);

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
					const existingIds = new Set(prev[rowId].map(item => item.id));
					const uniqueNew = newItems.filter(item => !existingIds.has(item.id));
					return {...prev, [rowId]: [...prev[rowId], ...uniqueNew.slice(0, ITEMS_PER_PAGE)]};
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

	// What each card stands for, shaped like Home's cards. Ids carry the row they sit in, since the
	// same title is in several rows, and what Seerr sent is kept beside for the detail panel.
	const model = useMemo(() => {
		const detail = new Map();
		const list = [];
		getRowConfigs().forEach((config) => {
			const data = rows[config.id];
			if (!data?.length) return;
			let items;
			let infoOf = () => null;
			switch (config.type) {
				case 'shortcut':
					items = data;
					break;
				case 'request': {
					const usable = data.filter((request) => request?.media?.tmdbId);
					items = usable.map(normalizeRequestItem);
					infoOf = (index) => {
						const media = usable[index].media;
						return {title: media.title, name: media.name, overview: media.overview, backdrop_path: media.backdropPath};
					};
					break;
				}
				case 'genre':
					items = data.map((genre) => normalizeGenreItem(genre, config.mediaType));
					infoOf = (index) => ({backdrops: data[index].backdrops});
					break;
				case 'studio':
					items = data.map(normalizeStudioItem);
					break;
				case 'network':
					items = data.map(normalizeNetworkItem);
					break;
				default:
					items = data.map(normalizeMediaItem);
					infoOf = (index) => data[index];
			}
			const own = items.map((item) => ({...item, Id: `${config.id}-${item.Id}`}));
			own.forEach((item, index) => {
				detail.set(item.Id, {rowId: config.id, index, count: own.length, info: infoOf(index)});
			});
			if (own.length > 0) list.push({config, items: own});
		});
		return {list, detail};
	}, [rows]);
	const modelRef = useRef(model);
	modelRef.current = model;
	const loadMoreRef = useRef(loadMoreForRow);
	loadMoreRef.current = loadMoreForRow;

	// Read through refs, so the rows can keep one set of handlers while the data underneath changes.
	const handleItemFocus = useCallback((item) => {
		const entry = modelRef.current.detail.get(item.Id);
		if (!entry) return;
		const info = entry.info;
		setFocusedItem(info);
		if (backdropTimeoutRef.current) {
			clearTimeout(backdropTimeoutRef.current);
		}
		backdropTimeoutRef.current = setTimeout(() => {
			if (info?.backdrop_path || info?.backdropPath) {
				const path = info.backdrop_path || info.backdropPath;
				setBackdropUrl(seerrApi.getImageUrl(path, 'w1280'));
			} else if (info?.backdrops?.length > 0) {
				setBackdropUrl(seerrApi.getImageUrl(info.backdrops[0], 'w1280'));
			}
		}, 150);
		// Near the end of a row that can go on, the next page is asked for.
		if (entry.index >= entry.count - 3) loadMoreRef.current(entry.rowId);
	}, []);

	const handleSelect = useCallback((item) => {
		const raw = item._seerrRaw || {};
		switch (item._seerrType) {
			case 'shortcut':
				onOpenShortcut?.(raw.shortcut);
				break;
			case 'genre':
				onSelectGenre?.(raw.genreId, raw.genreName, raw.mediaType);
				break;
			case 'studio':
				onSelectStudio?.(raw.studioId, raw.studioName);
				break;
			case 'network':
				onSelectNetwork?.(raw.networkId, raw.networkName);
				break;
			default:
				lastFocusedCardIndex = focusedCardIndex(`discover-row-${lastFocusedRowIndex}`, document.activeElement);
				onSelectItem?.({
					mediaId: raw.mediaId,
					mediaType: raw.mediaType,
					libraryId: item._seerrLibraryId
				});
		}
	}, [onSelectItem, onSelectGenre, onSelectNetwork, onSelectStudio, onOpenShortcut]);

	const visibleRows = model.list;

	const handleRequestsPillKeyDown = useCallback((e) => {
		if (e.keyCode === KEYS.UP || e.keyCode === KEYS.LEFT) {
			e.preventDefault();
			e.stopPropagation();
			Spotlight.focus('navbar');
		} else if (e.keyCode === KEYS.DOWN) {
			e.preventDefault();
			e.stopPropagation();
			Spotlight.focus('discover-row-0');
		}
	}, []);

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
		Spotlight.focus(`discover-row-${targetIndex}`);
		const targetRow = document.querySelector(`[data-row-index="${targetIndex}"]`);
		if (targetRow) {
			// With the detail band above, the row belongs at the top of the list. Without it the
			// focused modern card is tall enough that centering keeps it clear of the navbar.
			targetRow.scrollIntoView({behavior: 'smooth', block: showDetailSection ? 'start' : 'center'});
		}
	}, [showDetailSection]);

	const handleNavigateDown = useCallback((fromRowIndex) => {
		const targetIndex = fromRowIndex + 1;
		if (targetIndex >= visibleRows.length) return;
		Spotlight.focus(`discover-row-${targetIndex}`);
		const targetRow = document.querySelector(`[data-row-index="${targetIndex}"]`);
		if (targetRow) {
			targetRow.scrollIntoView({behavior: 'smooth', block: 'center'});
		}
	}, [visibleRows.length]);

	const handleRowFocus = useCallback((rowIndex) => {
		if (typeof rowIndex === 'number') {
			// A card index only means anything in the row it came from.
			if (rowIndex !== lastFocusedRowIndex) lastFocusedCardIndex = -1;
			lastFocusedRowIndex = rowIndex;
		}
	}, []);

	useEffect(() => {
		if (!isLoading && visibleRows.length > 0) {
			setTimeout(() => {
				if (lastFocusedRowIndex !== null && lastFocusedRowIndex < visibleRows.length) {
					const rowId = `discover-row-${lastFocusedRowIndex}`;
					const card = cardToRestore(rowId, lastFocusedCardIndex);
					if (!card || !Spotlight.focus(card)) {
						Spotlight.focus(rowId);
					}
					const targetRow = document.querySelector(`[data-row-index="${lastFocusedRowIndex}"]`);
					if (targetRow) {
						targetRow.scrollIntoView({block: 'center'});
					}
				} else {
					Spotlight.focus('discover-row-0');
				}
			}, 100);
		}
	}, [isLoading, visibleRows.length]);

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
			{settings.showHomeBackdrop !== false && (
				<div className={css.backdrop}>
					{backdropUrl && (
						<div
							className={css.backdropImage}
							style={{
								backgroundImage: `url(${backdropUrl})`,
								filter: settings.backdropBlurHome > 0 ? `blur(${settings.backdropBlurHome}px)` : 'none'
							}}
						/>
					)}
					<div className={css.backdropOverlay} />
				</div>
			)}
			{!isLoading && isAuthenticated && onOpenRequests && (
				<SpottableDiv
					className={`${css.requestsPill} ${settings.navbarPosition === 'left' ? '' : css.requestsPillBelowNav}`}
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
						{visibleRows.map(({config, items}, index) => (
							config.tile ? (
								<SeerrTileRow
									key={config.id}
									rowId={config.id}
									title={config.title}
									items={items}
									cardType={config.cardType}
									spotlightId={`discover-row-${index}`}
									rowIndex={index}
									onSelectItem={handleSelect}
									onFocus={handleRowFocus}
									onFocusItem={handleItemFocus}
									onNavigateUp={handleNavigateUp}
									onNavigateDown={handleNavigateDown}
								/>
							) : (
								<RowComponent
									key={config.id}
									rowId={config.id}
									title={config.title}
									items={items}
									serverUrl={serverUrl}
									cardType={config.cardType}
									rowImageType={settings.homeRowsImageType}
									spotlightId={`discover-row-${index}`}
									rowIndex={index}
									rowSpacing={rowSpacing}
									onSelectItem={handleSelect}
									onFocus={handleRowFocus}
									onFocusItem={handleItemFocus}
									onNavigateUp={handleNavigateUp}
									onNavigateDown={handleNavigateDown}
								/>
							)
						))}
					</div>
				</div>
			)}
		</div>
	);
};

export default SeerrDiscover;
