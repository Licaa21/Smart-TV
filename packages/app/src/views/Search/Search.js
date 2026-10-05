import {useState, useCallback, useRef, useEffect, useMemo} from 'react';
import $L from '@enact/i18n/$L';
import Spottable from '@enact/spotlight/Spottable';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import Spotlight from '@enact/spotlight';
import {isPaused} from '@enact/spotlight/Pause';
import {useAuth} from '../../context/AuthContext';
import {keepFocusInView, pointerHover} from '../../utils/focusScroll';
import {isKidsMode} from '../../utils/kidsMode';
import {withoutBlockedItems} from '../../services/parentalControls';
import {useSettings} from '../../context/SettingsContext';
import {useSeerr} from '../../context/SeerrContext';
import * as connectionPool from '../../services/connectionPool';
import * as gamesApi from '../../services/gamesApi';
import LoadingSpinner from '../../components/LoadingSpinner';
import {ClassicMediaRow, ModernMediaRow} from '../../components/MediaRow';
import DetailsTabBar from '../../components/DetailsTabBar';
import GameCard from '../../components/GameCard';
import {KEYS} from '../../utils/keys';
import {normalizeMediaItem as normalizeSeerrItem} from '../../utils/seerrHomeRows';
import {isGameLibrary, resolveGameLibraryId} from '../../utils/gameLibrary';
import {groupSearchResults, aspectClassForType, isCircleType, filterByName, fetchAllGames, filterGames, rankMostRelevant} from '../../utils/searchGroups';
import {foldForSearch} from '../../utils/accentFolding';
import SpottableInput from '../../components/SpottableInput/SpottableInput';
import {closeTvKeyboard} from '../../components/TVKeyboard/keyboardBus';
import useStorage from '../../hooks/useStorage';
import {
	initialCardCount,
	expandedCardCount,
	shouldMountSearchRow
} from './searchWindow';

import css from './Search.module.less';

const SpottableButton = Spottable('button');
const ACTIVE_SEARCH_TAB_ID = 'search-active-tab';
const ACTIVE_SEARCH_TAB_SELECTOR = `[data-spotlight-id="${ACTIVE_SEARCH_TAB_ID}"]`;
const RowContainer = SpotlightContainerDecorator({enterTo: 'last-focused', restrict: 'self-first'}, 'div');
const GridContainer = SpotlightContainerDecorator({enterTo: 'last-focused', leaveFor: {up: ACTIVE_SEARCH_TAB_SELECTOR}}, 'div');
// Without a default element, entering the container lands on Clear, since that
// is first in the DOM. Point it at the chips so arriving here offers a search.
const RecentContainer = SpotlightContainerDecorator({
	enterTo: 'last-focused',
	defaultElement: '[data-recent-chip]'
}, 'div');

const SEARCH_DEBOUNCE_MS = 400;
const MIN_SEARCH_LENGTH = 2;
const GLOBAL_FETCH_LIMIT = 240;
const PEOPLE_FETCH_LIMIT = 24;
// How long the rest of the results wait for people before showing without them.
// The People row fills in when the answer lands.
const PEOPLE_GRACE_MS = 1000;
const SEERR_CAP = 24;
const RECENT_SEARCHES_KEY = 'search_recentQueries';
const RECENT_SEARCHES_MAX = 10;
const ROW_SCROLL_MARGIN = 50;
// The space below each row of results.
const ROW_SPACING = 16;
// How far above the bottom edge the last of a focused row has to sit.
const ROW_BOTTOM_MARGIN = 40;
// How far below the top edge the title of a focused row has to sit, clear of a top navigation bar.
const ROW_TOP_MARGIN = 100;

const VoiceIcon = () => (
	<svg viewBox="0 0 24 24" fill="currentColor" className={css.voiceIcon}>
		<path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z" />
	</svg>
);

const SearchIcon = () => (
	<svg viewBox="0 0 24 24" fill="currentColor" className={css.searchIcon}>
		<path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
	</svg>
);

// The shape a Home card takes for each kind of result: stills for video, squares for music and
// playlists, a circle for people, and a poster for the rest.
const cardTypeFor = (type) => {
	if (isCircleType(type)) return 'circle';
	const aspect = aspectClassForType(type);
	if (aspect === 'wide') return 'landscape';
	return aspect === 'square' ? 'square' : 'portrait';
};

// Resolves with what the search found inside the grace, or null when it is still out.
const withinGrace = (promise, ms) => Promise.race([
	promise,
	new Promise((resolve) => setTimeout(() => resolve(null), ms))
]);

// How many titles the Most relevant row holds, which is about one row of cards.
const MOST_RELEVANT_COUNT = 6;

// A Seerr search mixes films and series, so its tab opens on the titles that best match what was
// typed, across both, and then sorts the rest under a heading for each.
const seerrSections = (items, query) => {
	const byType = [
		{key: 'movie', title: $L('Movies'), items: items.filter((item) => item._seerrMediaType === 'movie')},
		{key: 'tv', title: $L('TV Shows'), items: items.filter((item) => item._seerrMediaType !== 'movie')}
	].filter((section) => section.items.length > 0);
	// One type with a row's worth of titles would only be said twice.
	const repeatsItself = byType.length === 1 && items.length <= MOST_RELEVANT_COUNT;
	// Copies with an id of their own, so the same title shown twice on the tab is focused and
	// highlighted on its own. The source id is kept for opening it.
	const top = repeatsItself ? [] : rankMostRelevant(items, query, MOST_RELEVANT_COUNT)
		.map((item) => ({...item, Id: `top-${item.Id}`, _seerrSourceId: item.Id}));
	return [
		...(top.length ? [{key: 'top', title: $L('Most relevant'), items: top}] : []),
		...byType
	];
};

const Search = ({onSelectItem, onSelectSeerrItem, onSelectPerson, onSelectGame, onPlayChannel, remoteSearch}) => {
	const {api, serverUrl, hasMultipleServers} = useAuth();
	const {settings} = useSettings();
	const unifiedMode = settings.unifiedLibraryMode && hasMultipleServers;
	const {isEnabled: seerrEnabled, api: seerrApi, displayName: seerrName} = useSeerr();

	// Results are drawn with the rows and cards Home uses, so they follow the Home settings for
	// style and artwork. The space between rows is Search's own, since Home's is sized for a
	// screen of titled rows.
	const useModernRows = settings.homeRowsStyle !== 'v1';
	const RowComponent = useModernRows ? ModernMediaRow : ClassicMediaRow;

	const [query, setQuery] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [groups, setGroups] = useState([]);
	const [seerrResults, setSeerrResults] = useState([]);
	const [gameResults, setGameResults] = useState([]);
	const [activeTab, setActiveTab] = useState('all');
	const activeTabRef = useRef('all');
	activeTabRef.current = activeTab;
	// Whether the viewer chose a tab themselves since this search began. The focus the screen moves
	// to a pill on its own reaches the tab bar's select handler the same way, so it is set aside
	// while that happens.
	const tabPickedRef = useRef(false);
	const programmaticTabFocusRef = useRef(false);
	const [searchInputFocused, setSearchInputFocused] = useState(false);
	const searchInputRef = useRef(null);
	// The row in focus goes by id rather than position, so a row that arrives late
	// above it doesn't move the mounted window off it.
	const [activeRowId, setActiveRowId] = useState(null);
	const [visibleCardCounts, setVisibleCardCounts] = useState({});
	const [recentSearches, saveRecentSearches] = useStorage(RECENT_SEARCHES_KEY, []);

	// doSearch records into this list, so it reads the current value through a
	// ref rather than taking a dependency that would rebuild it on every search.
	const recentSearchesRef = useRef(recentSearches);
	useEffect(() => {
		recentSearchesRef.current = recentSearches;
	}, [recentSearches]);

	const debounceRef = useRef(null);
	const requestIdRef = useRef(0);
	const remoteSearchRef = useRef(remoteSearch);
	remoteSearchRef.current = remoteSearch;
	const lastResultNamesRef = useRef([]);
	const scrollerRefs = useRef({});
	const gameLibrariesRef = useRef([]);
	const hasLiveTvRef = useRef(false);
	const allGamesRef = useRef(null);

	// Discover game and Live TV libraries once so search can widen its scope.
	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const views = await api.getLibraries();
				if (cancelled) return;
				const libs = views?.Items || [];
				gameLibrariesRef.current = libs
					.filter((lib) => isGameLibrary(lib.Id, lib.CollectionType, lib.Name))
					.map((lib) => ({...lib, Id: resolveGameLibraryId(lib)}));
				hasLiveTvRef.current = libs.some((lib) => lib.CollectionType === 'livetv');
			} catch (_err) {
				void _err;
			}
		})();
		return () => { cancelled = true; };
	}, [api]);

	const seerrLabel = seerrName || $L('Seerr');

	// Focus the pill of the tab that is open, which is All unless a search was set to open on Seerr.
	// Focusing the tab container would land on the first pill, which is Seerr or Games when either
	// has results.
	// Handed over as the element itself: a compound selector string is not something Spotlight
	// resolves, and the fallback to the container lands on whichever pill sits nearest the search
	// field, which switches the results to that tab.
	const focusAllTab = useCallback(() => {
		programmaticTabFocusRef.current = true;
		try {
			const pill = document.querySelector(ACTIVE_SEARCH_TAB_SELECTOR) ||
				document.querySelector('[data-spotlight-id="search-tabs"] [data-id="all"]');
			if (!(pill && Spotlight.focus(pill))) Spotlight.focus('search-tabs');
		} finally {
			programmaticTabFocusRef.current = false;
		}
	}, []);

	// Recorded once a search actually returns, so the half-typed prefixes that
	// the debounce fires along the way never reach the list.
	const rememberSearch = useCallback((q) => {
		const trimmed = q.trim();
		if (!trimmed) return;
		const current = recentSearchesRef.current || [];
		const deduped = current.filter((entry) => entry.toLowerCase() !== trimmed.toLowerCase());
		const next = [trimmed, ...deduped].slice(0, RECENT_SEARCHES_MAX);
		recentSearchesRef.current = next;
		saveRecentSearches(next);
	}, [saveRecentSearches]);

	// Seerr answers after the library does, so a search set to open on Seerr starts on All and moves
	// over once there is something to show. It stays put when the viewer has already gone to another
	// tab or into the results, and carries focus along only if that sat on a tab pill.
	const openOnSeerr = useCallback((count) => {
		if (!count || settings.searchDefaultTab !== 'seerr' || activeTabRef.current !== 'all' || tabPickedRef.current) return;
		const focused = document.activeElement;
		if (focused && focused.closest && focused.closest('[data-spotlight-id^="search-row-"], [data-spotlight-id="search-grid"]')) return;
		const onTabs = Boolean(focused && focused.closest && focused.closest('[data-spotlight-id="search-tabs"]'));
		setActiveTab('seerr');
		if (onTabs) {
			setTimeout(() => {
				// Only while the focus is still in the tab bar, so a viewer who has gone on into the
				// results or back to the field in the meantime is not pulled back.
				const stillOnTabs = document.activeElement?.closest?.('[data-spotlight-id="search-tabs"]');
				const pill = document.querySelector('[data-spotlight-id="search-tabs"] [data-id="seerr"]');
				if (!stillOnTabs || !pill) return;
				programmaticTabFocusRef.current = true;
				try {
					Spotlight.focus(pill);
				} finally {
					programmaticTabFocusRef.current = false;
				}
			}, 50);
		}
	}, [settings.searchDefaultTab]);

	const doSearch = useCallback(async (searchQuery) => {
		const requestId = ++requestIdRef.current;
		tabPickedRef.current = false;
		const q = (searchQuery || '').trim();
		if (q.length < MIN_SEARCH_LENGTH) {
			setIsLoading(false);
			setGroups([]);
			setSeerrResults([]);
			setGameResults([]);
			setActiveRowId(null);
			setVisibleCardCounts({});
			return;
		}

		const isStudioQuery = q.toLowerCase().startsWith('studio:');
		setIsLoading(true);

		try {
			// A people search that fails leaves the other results alone.
			const peoplePromise = (unifiedMode
				? connectionPool.searchPeopleAllServers(q, PEOPLE_FETCH_LIMIT)
				: api.searchPeople(q, PEOPLE_FETCH_LIMIT).then((r) => r?.Items || [])
			).then(withoutBlockedItems).catch(() => []);
			const [libraryResult, channels] = await Promise.all([
				unifiedMode
					? connectionPool.searchAllServers(q, GLOBAL_FETCH_LIMIT).then((serverItems) => ({Items: serverItems}))
					: api.search(q, GLOBAL_FETCH_LIMIT),
				hasLiveTvRef.current && !isStudioQuery
					? api.getLiveTvChannels(0, 500).then((r) => r?.Items || []).catch(() => [])
					: Promise.resolve([])
			]);
			if (requestId !== requestIdRef.current) return;

			// Suggestions come from these results, so this keeps blocked titles out of both.
			const items = [...withoutBlockedItems(libraryResult.Items || []), ...filterByName(channels, q)];
			// With nothing else to show, the results wait for people instead of coming up empty.
			const people = items.length > 0
				? await withinGrace(peoplePromise, PEOPLE_GRACE_MS)
				: await peoplePromise;
			if (requestId !== requestIdRef.current) return;

			const showResults = (found) => {
				const all = [...items, ...found];
				lastResultNamesRef.current = all.map((result) => result.Name).filter(Boolean);
				setGroups(groupSearchResults(all));
			};
			showResults(people || []);
			if (people === null) {
				peoplePromise.then((found) => {
					if (found.length === 0 || requestId !== requestIdRef.current) return;
					showResults(found);
				});
			}
			setActiveRowId(null);
			setVisibleCardCounts({});
			setIsLoading(false);
			rememberSearch(q);
			// A new query always starts on All. Focus it once the tabs render, unless
			// the user is still typing, in which case Spotlight is paused and the
			// input keeps focus until they press down.
			setActiveTab('all');
			if (!isPaused()) {
				setTimeout(() => {
					if (!remoteSearchRef.current?.active) focusAllTab();
				}, 50);
			}

			// Seerr and Games load after the library results so the rows appear first.
			// Gated at the fetch rather than at the render, since the tab list and every tab index
			// are worked out from whether there are any results.
			if (seerrEnabled && seerrApi && !isStudioQuery && !isKidsMode(settings)) {
				seerrApi.search(q).then((res) => {
					if (requestId !== requestIdRef.current) return;
					const filtered = (res.results || []).filter((r) => r.mediaType !== 'person').slice(0, SEERR_CAP);
					setSeerrResults(filtered);
					openOnSeerr(filtered.length);
				}).catch((err) => console.error('Seerr search failed:', err));
			} else {
				setSeerrResults([]);
			}

			if (gameLibrariesRef.current.length > 0 && !isStudioQuery) {
				if (!allGamesRef.current) {
					allGamesRef.current = await fetchAllGames(gameLibrariesRef.current);
				}
				if (requestId !== requestIdRef.current) return;
				setGameResults(filterGames(allGamesRef.current, q));
			} else {
				setGameResults([]);
			}
		} catch (err) {
			if (requestId !== requestIdRef.current) return;
			console.error('Search failed:', err);
			setGroups([]);
			setSeerrResults([]);
			setGameResults([]);
			setIsLoading(false);
		}
	}, [api, seerrEnabled, seerrApi, unifiedMode, focusAllTab, rememberSearch, openOnSeerr, settings]);

	const applyQuery = useCallback((value) => {
		// Even a clear or a query waiting for debounce supersedes older results.
		requestIdRef.current++;
		setQuery(value);
		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(() => doSearch(value), SEARCH_DEBOUNCE_MS);
	}, [doSearch]);
	const handleInputChange = useCallback((e) => {
		remoteSearch?.close();
		let value = e.target.value;
		try { value = decodeURIComponent(escape(value)); } catch (_err) { void _err; }
		applyQuery(value);
	}, [remoteSearch, applyQuery]);
	const inputWrapperRef = useRef(null);
	const applyQueryRef = useRef(applyQuery);
	applyQueryRef.current = applyQuery;
	useEffect(() => {
		if (!remoteSearch?.active) return undefined;
		remoteSearch.attach((text) => {
			// Discard the receiver keyboard's old buffer before the phone edits.
			closeTvKeyboard();
			const input = inputWrapperRef.current?.querySelector('input');
			if (document.activeElement === input) {
				input.blur();
				Spotlight.focus('search-input');
			}
			applyQueryRef.current(text);
		});
		Spotlight.focus('search-input');
		return () => remoteSearch.close();
	}, [remoteSearch]);

	// Titles for the keyboard's suggestion chips. These come out of the results the
	// screen already loaded, so offering them costs no extra trip to the server.
	const fetchKeyboardSuggestions = useCallback((text) => {
		const typed = foldForSearch(text.trim());
		if (!typed) return [];
		return lastResultNamesRef.current.filter((name) => foldForSearch(name).indexOf(typed) >= 0);
	}, []);

	const handleClearSearch = useCallback(() => {
		remoteSearch?.close();
		if (debounceRef.current) clearTimeout(debounceRef.current);
		requestIdRef.current++;
		setIsLoading(false);
		setQuery('');
		setGroups([]);
		setSeerrResults([]);
		setGameResults([]);
		setActiveRowId(null);
		setVisibleCardCounts({});
		Spotlight.focus('search-input');
	}, [remoteSearch]);

	// Picking a past query runs it straight away. The debounce only exists to
	// throttle typing, and there is nothing left to wait for here.
	const handleSelectRecent = useCallback((e) => {
		remoteSearch?.close();
		const term = e.currentTarget.dataset.term;
		if (!term) return;
		if (debounceRef.current) clearTimeout(debounceRef.current);
		setQuery(term);
		doSearch(term);
	}, [doSearch, remoteSearch]);

	const handleClearRecent = useCallback(() => {
		recentSearchesRef.current = [];
		saveRecentSearches([]);
		Spotlight.focus('search-input');
	}, [saveRecentSearches]);

	const totalCount = useMemo(() => (
		groups.reduce((sum, g) => sum + g.items.length, 0) + seerrResults.length + gameResults.length
	), [groups, seerrResults, gameResults]);

	const tabs = useMemo(() => {
		const list = [];
		if (seerrResults.length > 0) list.push({id: 'seerr', label: `${seerrLabel}: ${seerrResults.length}`});
		if (gameResults.length > 0) list.push({id: 'games', label: `${$L('Games')}: ${gameResults.length}`});
		list.push({id: 'all', label: `${$L('All')}: ${totalCount}`});
		groups.forEach((g) => list.push({id: g.key, label: `${g.title}: ${g.items.length}`}));
		return list;
	}, [groups, seerrResults.length, gameResults.length, totalCount, seerrLabel]);

	const hasResults = totalCount > 0;

	// Keep the active tab valid as results change.
	useEffect(() => {
		if (!tabs.find((t) => t.id === activeTab)) setActiveTab('all');
	}, [tabs, activeTab]);

	const handleSelectTab = useCallback((id) => {
		if (!programmaticTabFocusRef.current) tabPickedRef.current = true;
		setActiveTab(id);
		setActiveRowId(null);
	}, []);

	// Seerr results are shaped like library items so the same cards can draw them. The raw result
	// is kept beside, since opening one asks for what Seerr sent.
	const seerrCards = useMemo(() => {
		const raw = new Map();
		const items = seerrResults.map((result) => {
			const item = normalizeSeerrItem(result);
			raw.set(item.Id, result);
			return item;
		});
		return {items, raw};
	}, [seerrResults]);

	// Rows shown in the All tab: groups first, then Seerr, then Games.
	const allRows = useMemo(() => {
		const list = groups.map((g) => ({id: g.key, title: g.title, items: g.items, kind: 'jellyfin', cardType: cardTypeFor(g.items[0]?.Type)}));
		if (seerrCards.items.length > 0) list.push({id: 'seerr', title: seerrLabel, items: seerrCards.items, kind: 'seerr', cardType: 'portrait'});
		if (gameResults.length > 0) list.push({id: 'games', title: $L('Games'), items: gameResults, kind: 'game'});
		return list;
	}, [groups, seerrCards, gameResults, seerrLabel]);

	// Every tab but Games is a stack of Home rows, like All. A row scrolls sideways, so a focused card
	// growing to show its details cannot push the last card of a wrapped line onto a line of its own,
	// and every section ends on the same edge instead of a short last line.
	const tabRows = useMemo(() => {
		if (activeTab === 'seerr') {
			return seerrSections(seerrCards.items, query).map((section) => ({...section, id: section.key, kind: 'seerr', cardType: 'portrait'}));
		}
		const group = groups.find((g) => g.key === activeTab);
		if (!group) return [];
		return [{id: group.key, title: group.title, items: group.items, kind: 'jellyfin', cardType: cardTypeFor(group.items[0]?.Type)}];
	}, [activeTab, groups, seerrCards, query]);
	const rows = activeTab === 'all' ? allRows : tabRows;
	const rowsRef = useRef([]);
	rowsRef.current = rows;
	const activeRowIndex = useMemo(
		() => Math.max(0, rows.findIndex((row) => row.id === activeRowId)),
		[rows, activeRowId]
	);
	// A row is known to Spotlight by what it is, not by where it sits. Spotlight forgets a container
	// when the component that registered the id unmounts, and moving to another tab mounts the new
	// rows before the old ones leave. Rows that shared an id by position came out of that
	// unregistered, so focus could not be sent to them by id and down stopped at the first row.
	const rowSpotlightId = useCallback((rowIndex) => `search-row-${rowsRef.current[rowIndex]?.id}`, []);

	useEffect(() => {
		setTimeout(() => Spotlight.focus('search-input'), 100);
	}, []);

	// Keeps people that answer after the screen closed from landing on it.
	useEffect(() => () => {
		if (debounceRef.current) clearTimeout(debounceRef.current);
		requestIdRef.current++;
	}, []);

	const showRecent = !hasResults &&
		query.trim().length < MIN_SEARCH_LENGTH &&
		(recentSearches?.length || 0) > 0;

	// D-pad hand-offs between the input, the tabs and the content.
	// Where leaving the field downward lands, which is also where the keyboard
	// hands focus when it is dismissed upward. False when there is nothing below
	// the field yet.
	const focusBelowInput = useCallback(() => {
		if (hasResults) {
			focusAllTab();
			return true;
		}
		if (showRecent) {
			Spotlight.focus('search-recent');
			return true;
		}
		return false;
	}, [hasResults, showRecent, focusAllTab]);

	// Stopped as well as prevented, like the tab and row handlers: Spotlight makes its own move
	// once the press reaches the top, and from the pill just focused that lands on another tab
	// and switches to it.
	const handleInputKeyDown = useCallback((e) => {
		if (e.keyCode !== KEYS.DOWN) return;
		if (focusBelowInput()) {
			e.preventDefault();
			e.stopPropagation();
		}
	}, [focusBelowInput]);

	// Each TV keyboard carries the remote's microphone, and what it hears lands
	// in the field like typed text. The field is handed over on the key down,
	// since the Fire TV keyboard only comes up for a focus made there.
	const handleVoiceSearch = useCallback(() => searchInputRef.current?.activateSystemInput(), []);
	const handleVoiceKeyDown = useCallback((e) => {
		if (e.keyCode !== KEYS.ENTER) return;
		e.preventDefault();
		handleVoiceSearch();
	}, [handleVoiceSearch]);

	const handleSearchInputFocus = useCallback(() => setSearchInputFocused(true), []);
	const handleSearchInputBlur = useCallback((e) => {
		if (!e.currentTarget.contains(e.relatedTarget)) setSearchInputFocused(false);
	}, []);

	// The first card of the first row, or of the grid. Entering the container and letting Spotlight
	// choose put focus on whichever card was nearest where it came from, which was off to the right.
	// Focus coming back up to the tabs or the field only scrolls that one element into view, which
	// leaves the field, or the tabs, above the edge of the screen. The page goes back to its top.
	const containerRef = useRef(null);
	const scrollToTop = useCallback(() => {
		if (containerRef.current) containerRef.current.scrollTop = 0;
	}, []);

	// A row that arrives late pushes the rows below it down, which can leave the
	// focused card off screen.
	useEffect(() => {
		const focused = document.activeElement;
		if (!focused || !focused.closest('[data-row-index]')) return;
		window.requestAnimationFrame(() => {
			if (document.activeElement !== focused || !containerRef.current) return;
			keepFocusInView({currentTarget: containerRef.current, target: focused});
		});
	}, [rows]);

	const focusContent = useCallback(() => {
		if (activeTab !== 'games') setActiveRowId(rowsRef.current[0]?.id ?? null);
		const containerId = activeTab === 'games' ? 'search-grid' : rowSpotlightId(0);
		const first = document.querySelector(`[data-spotlight-id="${containerId}"] .spottable`);
		if (!(first && Spotlight.focus(first))) Spotlight.focus(containerId);
	}, [activeTab, rowSpotlightId]);

	// The press is stopped as well as prevented. Spotlight makes its own move once
	// the event reaches the top, and it would make that move out of whatever was
	// just focused here rather than out of the tabs.
	const handleTabsKeyDown = useCallback((e) => {
		if (e.keyCode === KEYS.UP) {
			e.preventDefault();
			e.stopPropagation();
			Spotlight.focus('search-input');
		} else if (e.keyCode === KEYS.DOWN) {
			e.preventDefault();
			e.stopPropagation();
			focusContent();
		}
	}, [focusContent]);

	const handleRowKeyDown = useCallback((e) => {
		const rowIndex = parseInt(e.currentTarget.dataset.rowIndex, 10);
		if (e.keyCode === KEYS.UP) {
			e.preventDefault();
			e.stopPropagation();
			if (rowIndex === 0) {
				Spotlight.focus(ACTIVE_SEARCH_TAB_SELECTOR);
			} else {
				setActiveRowId(rowsRef.current[rowIndex - 1]?.id ?? null);
				Spotlight.focus(rowSpotlightId(rowIndex - 1));
			}
		} else if (e.keyCode === KEYS.DOWN) {
			e.preventDefault();
			e.stopPropagation();
			if (rowIndex < rows.length - 1) {
				setActiveRowId(rowsRef.current[rowIndex + 1]?.id ?? null);
				Spotlight.focus(rowSpotlightId(rowIndex + 1));
			}
		}
	}, [rows.length, rowSpotlightId]);

	// Home rows report their own key presses and focus, so they hand these in by row index.
	const focusRow = useCallback((rowIndex) => {
		setActiveRowId(rowsRef.current[rowIndex]?.id ?? null);
		Spotlight.focus(rowSpotlightId(rowIndex));
	}, [rowSpotlightId]);

	const handleRowNavigateUp = useCallback((rowIndex) => {
		if (rowIndex === 0) Spotlight.focus(ACTIVE_SEARCH_TAB_SELECTOR);
		else focusRow(rowIndex - 1);
	}, [focusRow]);

	// The Home rows only rebuild when their items change, not when a handler does, so these read
	// the rows through a ref. Seerr results land after the library rows have drawn, and a row
	// holding an older handler would think it was the last one.

	const handleRowNavigateDown = useCallback((rowIndex) => {
		if (rowIndex < rowsRef.current.length - 1) focusRow(rowIndex + 1);
	}, [focusRow]);

	// A focused modern card grows to show its details once it has focus, after the page has already
	// scrolled for the size it had. The whole row is brought into view once it has settled, or the
	// last row is left with its text running off the bottom of the screen.
	const keepRowInView = useCallback((rowIndex) => {
		const reveal = () => {
			const container = containerRef.current;
			const row = document.querySelector(`[data-spotlight-id="${rowSpotlightId(rowIndex)}"]`);
			if (!container || !row) return;
			const view = container.getBoundingClientRect();
			const rect = row.getBoundingClientRect();
			// Coming up from the row below leaves this row's title above the top edge.
			const hidden = view.top + ROW_TOP_MARGIN - rect.top;
			if (hidden > 0) {
				container.scrollTop -= hidden;
				return;
			}
			const overflow = rect.bottom - (view.bottom - ROW_BOTTOM_MARGIN);
			if (overflow > 0) container.scrollTop += Math.min(overflow, Math.max(0, rect.top - view.top));
		};
		window.requestAnimationFrame(reveal);
		window.setTimeout(reveal, 200);
	}, [rowSpotlightId]);

	const handleHomeRowFocus = useCallback((rowIndex) => {
		if (pointerHover()) return;
		setActiveRowId(rowsRef.current[rowIndex]?.id ?? null);
		keepRowInView(rowIndex);
	}, [keepRowInView]);

	// A row opens with about a screen of cards, and the next batch lands as focus nears the end.
	const growRow = useCallback((item) => {
		if (pointerHover()) return;
		const row = rowsRef.current.find((candidate) => candidate.items.some((entry) => entry.Id === item.Id));
		if (!row) return;
		const focusedIndex = row.items.findIndex((candidate) => candidate.Id === item.Id);
		setVisibleCardCounts((current) => {
			const visible = current[row.id] || initialCardCount(row.items.length);
			const expanded = expandedCardCount(visible, focusedIndex, row.items.length);
			return expanded === visible ? current : {...current, [row.id]: expanded};
		});
	}, []);

	const handleRowFocus = useCallback((rowId, itemCount) => (e) => {
		if (pointerHover()) return;
		setActiveRowId(rowId);
		const card = e.target.closest('[data-spotlight-id]');
		const scroller = scrollerRefs.current[rowId];
		if (!card || !scroller) return;
		const spotlightId = card.getAttribute('data-spotlight-id') || '';
		const indexMatch = /-item-(\d+)$/.exec(spotlightId);
		if (indexMatch) {
			const focusedIndex = parseInt(indexMatch[1], 10);
			setVisibleCardCounts((current) => {
				const visible = current[rowId] || initialCardCount(itemCount);
				const expanded = expandedCardCount(visible, focusedIndex, itemCount);
				return expanded === visible ? current : {...current, [rowId]: expanded};
			});
		}
		window.requestAnimationFrame(() => {
			const cardRect = card.getBoundingClientRect();
			const scrollerRect = scroller.getBoundingClientRect();
			const leftEdge = scrollerRect.left + ROW_SCROLL_MARGIN;
			const rightEdge = scrollerRect.right - ROW_SCROLL_MARGIN;
			if (cardRect.left < leftEdge) {
				scroller.scrollLeft -= leftEdge - cardRect.left;
			} else if (cardRect.right > rightEdge) {
				scroller.scrollLeft += cardRect.right - rightEdge;
			}
		});
	}, []);

	const handleSelectJellyfin = useCallback((item) => {
		if (item.Type === 'Person') {
			onSelectPerson?.(item);
		} else if (item.Type === 'TvChannel' || item.Type === 'LiveTvChannel') {
			(onPlayChannel || onSelectItem)?.(item);
		} else {
			onSelectItem?.(item);
		}
	}, [onSelectItem, onSelectPerson, onPlayChannel]);

	const seerrCardsRef = useRef(seerrCards);
	seerrCardsRef.current = seerrCards;
	const handleSelectSeerr = useCallback((item) => {
		const raw = seerrCardsRef.current.raw.get(item._seerrSourceId || item.Id);
		if (raw) onSelectSeerrItem?.(raw);
	}, [onSelectSeerrItem]);

	const handleGameSelect = useCallback((game) => onSelectGame?.(game._library, game), [onSelectGame]);

	const renderGameCard = useCallback((game, spotlightId) => (
		<GameCard
			key={`game-${game.id}`}
			game={game}
			artUrl={gamesApi.gameThumbUrl(resolveGameLibraryId(game._library), game.id)}
			width={150}
			spotlightId={spotlightId}
			onSelect={handleGameSelect}
		/>
	), [handleGameSelect]);

	const renderContent = () => {
		if (activeTab !== 'games') {
			return (
				<div className={css.resultsContainer}>
					{rows.map((row, rowIndex) => {
						const mounted = shouldMountSearchRow(rowIndex, activeRowIndex);
						const visibleCount = mounted ? visibleCardCounts[row.id] || initialCardCount(row.items.length) : 0;
						if (row.kind === 'game') {
							return (
								<RowContainer
									key={row.id}
									className={css.resultRow}
									spotlightId={`search-row-${row.id}`}
									data-row-index={rowIndex}
									onKeyDown={handleRowKeyDown}
								>
									<h2 className={css.rowTitle}>{row.title}<span className={css.rowCount}> ({row.items.length})</span></h2>
									<div
										className={css.rowScroller}
										ref={(el) => { scrollerRefs.current[row.id] = el; }}
										onFocus={handleRowFocus(row.id, row.items.length)}
									>
										<div className={css.resultItems} aria-hidden={mounted ? undefined : 'true'}>
											{mounted
												? row.items.slice(0, visibleCount).map((item, idx) => renderGameCard(item, `${row.id}-item-${idx}`))
												: <div className={`${css.card} ${css.cardGame} ${css.windowPlaceholder}`}>
													<div className={`${css.cardImg} ${css.imgGame}`} />
													<div className={css.cardTitle}>&nbsp;</div>
												</div>}
										</div>
									</div>
								</RowContainer>
							);
						}
						const title = `${row.title} (${row.items.length})`;
						if (!mounted) {
							return <RowComponent key={row.id} loading title={title} cardType={row.cardType} rowSpacing={ROW_SPACING} />;
						}
						return (
							<RowComponent
								key={row.id}
								rowId={row.id}
								rowIndex={rowIndex}
								spotlightId={`search-row-${row.id}`}
								title={title}
								items={row.items.slice(0, visibleCount)}
								serverUrl={serverUrl}
								cardType={row.cardType}
								rowImageType={settings.homeRowsImageType}
								onSelectItem={row.kind === 'seerr' ? handleSelectSeerr : handleSelectJellyfin}
								onFocus={handleHomeRowFocus}
								onFocusItem={growRow}
								onNavigateUp={handleRowNavigateUp}
								onNavigateDown={handleRowNavigateDown}
								showServerBadge={unifiedMode}
								rowSpacing={ROW_SPACING}
							/>
						);
					})}
				</div>
			);
		}
		return (
			<GridContainer className={css.gridWrapper} spotlightId="search-grid">
				<div className={css.grid}>
					{gameResults.map((game, idx) => renderGameCard(game, `grid-item-${idx}`))}
				</div>
			</GridContainer>
		);
	};

	return (
		<div ref={containerRef} className={`${css.searchContainer} ${settings.navbarPosition === 'left' ? css.sidebarOffset : ''}`}>
			<div className={css.searchInputSection} onFocus={scrollToTop}>
				<div
					className={`${css.searchInputWrapper} ${searchInputFocused ? css.searchInputFocused : ''}`}
					ref={inputWrapperRef}
					onFocusCapture={handleSearchInputFocus}
					onBlurCapture={handleSearchInputBlur}
				>
					<SearchIcon />
					<SpottableInput
						ref={searchInputRef}
						type="text"
						purpose="search"
						recents={recentSearches}
						suggestionsBuilder={fetchKeyboardSuggestions}
						className={css.searchInput}
						placeholder={$L('Search movies, shows, music, and more...')}
						value={query}
						onChange={handleInputChange}
						onKeyDown={handleInputKeyDown}
						onExitTop={focusBelowInput}
						onExitBottom={focusBelowInput}
						spotlightId="search-input"
						autoComplete="off"
					/>
					{query && <button className={css.clearBtn} onClick={handleClearSearch}>×</button>}
					<SpottableButton className={css.voiceBtn} data-spotlight-id="search-voice" onClick={handleVoiceSearch} onKeyDown={handleVoiceKeyDown} aria-label={$L('Voice search')}>
						<VoiceIcon />
					</SpottableButton>
				</div>
			</div>

			<div className={css.searchResults}>
				{hasResults && (
					<div className={css.tabsRow} onKeyDown={handleTabsKeyDown} onFocus={scrollToTop}>
						<DetailsTabBar
							tabs={tabs}
							activeId={activeTab}
							activeSpotlightId={ACTIVE_SEARCH_TAB_ID}
							onSelect={handleSelectTab}
							onActivate={handleSelectTab}
							expanded
							spotlightId="search-tabs"
						/>
					</div>
				)}

				{isLoading && !hasResults ? (
					<div className={css.loadingIndicator}><LoadingSpinner /><p>{$L('Searching...')}</p></div>
				) : showRecent ? (
					<RecentContainer className={css.recentSection} spotlightId="search-recent">
						<div className={css.recentHeader}>
							<h2 className={css.recentTitle}>{$L('Recent Searches')}</h2>
							<SpottableButton className={css.recentClear} onClick={handleClearRecent}>
								{$L('Clear')}
							</SpottableButton>
						</div>
						<div className={css.recentList}>
							{recentSearches.map((term) => (
								<SpottableButton
									key={term}
									className={css.recentChip}
									data-recent-chip
									data-term={term}
									onClick={handleSelectRecent}
								>
									{term}
								</SpottableButton>
							))}
						</div>
					</RecentContainer>
				) : !query || query.length < MIN_SEARCH_LENGTH ? (
					<div className={css.emptyState}>
						<SearchIcon />
						<h2>{$L('Search for content')}</h2>
						<p>{$L('Find movies, TV shows, music, and more')}</p>
					</div>
				) : !hasResults ? (
					<div className={css.noResults}>
						<h2>{$L('No results found')}</h2>
						<p>{$L('Try a different search term')}</p>
					</div>
				) : (
					renderContent()
				)}
			</div>
		</div>
	);
};

export default Search;
