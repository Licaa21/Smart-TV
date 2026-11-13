import {useEffect, useRef, useState} from 'react';
import $L from '@enact/i18n/$L';

import {memoryCache, settleSections} from './browseCache';
import {getExternalHomeRowConfigs, fetchExternalPresetRow, fetchCustomHomeRow, fetchCalendarRows, buildSeasonalRow, formatWatchingNowSubtitle, normalizeWatchingNowItem} from '../../utils/externalHomeRows';
import {fetchSeasonalRow} from '../../services/externalRowsApi';
import {fetchWatchingNow} from '../../services/mdblistApi';
import {resolveItemsByProviderIds} from '../../services/jellyfinApi';
import {seasonalCountryParam} from '../../utils/seasonalRow';
import {resolveDeviceCountry} from '../../utils/deviceCountry';
import {currentMetadataLanguage} from '../../utils/metadataLanguage';
import {localizeExternalItems, localizeSeerrCards, pluginTranslatesRow} from '../../utils/localizeExternalItems';
import {isExternalRowAvailable} from '../../utils/homeRowGates';

// Owned titles become library items so they open and play without Seerr, the rest open in Seerr.
const loadWatchingNowRow = async (forceRefresh = false) => {
	const data = await fetchWatchingNow(null, {forceRefresh});
	const identified = (data?.items || []).filter((item) => item && (item.imdb_id || item.tmdb_id));
	if (identified.length === 0) return null;
	return {
		id: 'mdblist_watching_now',
		title: $L('Watching on MDBList'),
		subtitle: formatWatchingNowSubtitle(data),
		items: await resolveItemsByProviderIds(identified.map(normalizeWatchingNowItem)),
		isExternalRow: true,
		isWatchingNowRow: true
	};
};

const withRow = (rows, row) => {
	const index = rows.findIndex((r) => r.id === row.id);
	if (index < 0) return [...rows, row];
	const updated = [...rows];
	updated[index] = row;
	return updated;
};

// Home rows built from TMDB and IMDb charts, lists the viewer pasted a URL for, and the
// Radarr and Sonarr calendars. Items arrive as provider ids, so every row is resolved against
// the local library first: what the server owns becomes playable, the rest falls back to Seerr.
// The rows still on their way come back as [pending], so they can hold their place.
// A return to the home screen takes the rows it left from memory, and does not fetch and resolve them again.
const useExternalRows = ({settings, homeRows, kidsMode, pluginInfo = null, serverType, reuse = false, owner = ''}) => {
	const [externalRows, setExternalRows] = useState(() => (reuse && memoryCache.externalRows?.owner === owner ? memoryCache.externalRows.rows : []));
	const [pending, setPending] = useState([]);
	const reuseRef = useRef(reuse);
	// Only what the rows depend on, so a fresh ping with the same answers doesn't reload them.
	const hasPlugin = Boolean(pluginInfo);
	const tmdbAvailable = pluginInfo?.tmdbAvailable === true;
	const mdblistAvailable = pluginInfo?.mdblistAvailable === true;
	const calendarAvailable = pluginInfo?.calendarAvailable === true;
	const discoverChartsSupported = pluginInfo?.discoverChartsSupported === true;

	// A refresh the viewer asked for, which brings these rows in again as well as the library's.
	const [reloadKey, setReloadKey] = useState(0);
	useEffect(() => {
		const handleRefresh = (e) => {
			if (e?.detail?.reload) setReloadKey((key) => key + 1);
		};
		window.addEventListener('moonfin:browseRefresh', handleRefresh);
		return () => window.removeEventListener('moonfin:browseRefresh', handleRefresh);
	}, []);

	useEffect(() => {
		const info = hasPlugin ? {tmdbAvailable, mdblistAvailable, calendarAvailable, discoverChartsSupported} : null;
		// The rows arrive already filtered, and the pasted list rows go the way the plugin rows do,
		// since nothing here can vouch for what an outside catalogue returns.
		const rows = homeRows || settings.homeRows || [];
		const keys = {useMoonfinPlugin: settings.useMoonfinPlugin, tmdbApiKey: settings.tmdbApiKey, mdblistApiKey: settings.mdblistApiKey};
		const shown = (r) => r.enabled && isExternalRowAvailable(r.id, {settings: keys, pluginInfo: info, serverType}) === true;
		const presetConfigs = getExternalHomeRowConfigs();
		const enabledPresets = rows.filter((r) => presetConfigs.some((c) => c.id === r.id) && shown(r)).map((r) => r.id);
		const customRows = kidsMode || !settings.useMoonfinPlugin ? [] : (settings.customHomeRows || []).filter((r) => r.enabled);
		const radarrEnabled = rows.some((r) => r.id === 'radarr_calendar' && shown(r));
		const sonarrEnabled = rows.some((r) => r.id === 'sonarr_calendar' && shown(r));
		const calendarsEnabled = radarrEnabled || sonarrEnabled;
		const seasonalEnabled = rows.some((r) => r.id === 'seasonal' && shown(r));
		const watchingNowEnabled = rows.some((r) => r.id === 'mdblist_watching_now' && shown(r));
		if (enabledPresets.length === 0 && customRows.length === 0 && !calendarsEnabled && !seasonalEnabled && !watchingNowEnabled) {
			setExternalRows([]);
			setPending([]);
			return undefined;
		}

		const mergedCalendars = radarrEnabled && sonarrEnabled && settings.mergeRadarrSonarrCalendars;
		// Everything the fetch reads, so that rows made for other settings are not taken back
		const key = JSON.stringify([
			enabledPresets, customRows, radarrEnabled, sonarrEnabled, mergedCalendars, seasonalEnabled, watchingNowEnabled,
			settings.seasonalRowCountry, settings.seasonalRowHiddenHolidays,
			settings.radarrCalendarShowCinema, settings.radarrCalendarShowDigital, settings.radarrCalendarShowPhysical,
			settings.radarrCalendarShowDate, settings.sonarrCalendarShowDate, settings.sonarrCalendarShowEpisodeInfo,
			settings.imdbRowsSortBy, settings.imdbRowsSortOrder, settings.tmdbRowsSortBy, settings.tmdbRowsSortOrder
		]);
		let cancelled = false;
		let refreshTimer = null;
		// Watching Now comes in on its own, so the kept rows are given it when it arrives.
		let watchingRow = null;
		const keepWatchingRow = (row) => {
			watchingRow = row;
			const kept = memoryCache.externalRows;
			if (kept && kept.key === key && kept.owner === owner) {
				memoryCache.externalRows = {...kept, rows: row ? withRow(kept.rows, row) : kept.rows.filter((r) => r.id !== 'mdblist_watching_now')};
			}
		};
		const startWatchingRefresh = () => {
			refreshTimer = setInterval(async () => {
				// The player takes Home down with it, so only a hidden app is left to skip.
				if (document.hidden) return;
				try {
					const row = await loadWatchingNowRow(true);
					if (!row || cancelled) return;
					keepWatchingRow(row);
					setExternalRows((prevRows) => withRow(prevRows, row));
				} catch (err) {
					console.warn('[Browse] Failed to refresh Watching Now:', err);
				}
			}, 5 * 60 * 1000);
		};
		const stopWork = () => {
			cancelled = true;
			if (refreshTimer) clearInterval(refreshTimer);
		};

		const reusing = reuseRef.current && memoryCache.externalRows?.key === key && memoryCache.externalRows.owner === owner;
		reuseRef.current = false;
		if (reusing) {
			setExternalRows(memoryCache.externalRows.rows);
			setPending([]);
			// The kept row is brought up to date every few minutes as before the return.
			if (watchingNowEnabled) startWatchingRefresh();
			return stopWork;
		}

		const pendingRows = [
			...enabledPresets
				.map((id) => presetConfigs.find((c) => c.id === id))
				.filter(Boolean)
				.map((cfg) => ({id: cfg.id, title: cfg.title})),
			...customRows.map((row) => ({id: `external-${row.id}`, title: row.name || row.title || $L('Custom'), isCustomRow: true})),
			...(seasonalEnabled ? [{id: 'seasonal', title: $L('Seasonal Row')}] : []),
			...(watchingNowEnabled ? [{id: 'mdblist_watching_now', title: $L('Watching on MDBList')}] : []),
			...(mergedCalendars ? [{id: 'radarr_calendar', title: $L('Upcoming Releases'), isCalendarMerged: true}] : []),
			...(radarrEnabled && !mergedCalendars ? [{id: 'radarr_calendar', title: $L('Upcoming Movies')}] : []),
			...(sonarrEnabled && !mergedCalendars ? [{id: 'sonarr_calendar', title: $L('Upcoming Episodes')}] : [])
		];
		setPending(pendingRows);

		(async () => {
			try {
				// The rows come in the language the Jellyfin server is set to, as Seerr's do.
				const language = await currentMetadataLanguage().catch(() => null);
				const presetData = await Promise.all(enabledPresets.map(async (id) => {
					const cfg = presetConfigs.find((c) => c.id === id);
					if (!cfg) return null;
					const imdb = id.startsWith('imdb-');
					const items = await fetchExternalPresetRow(id, {
						language,
						sortBy: imdb ? settings.imdbRowsSortBy : settings.tmdbRowsSortBy,
						sortOrder: imdb ? settings.imdbRowsSortOrder : settings.tmdbRowsSortOrder
					});
					return {id, title: cfg.title, items: items || []};
				}));

				const customData = await Promise.all(customRows.map(async (row) => {
					const items = await fetchCustomHomeRow(row, {language});
					return {id: `external-${row.id}`, title: row.name || row.title || $L('Custom'), items: items || [], isCustomRow: true};
				}));

				const calendarSettings = {
					mergeRadarrSonarrCalendars: settings.mergeRadarrSonarrCalendars,
					radarrCalendarShowCinema: settings.radarrCalendarShowCinema,
					radarrCalendarShowDigital: settings.radarrCalendarShowDigital,
					radarrCalendarShowPhysical: settings.radarrCalendarShowPhysical,
					radarrCalendarShowDate: settings.radarrCalendarShowDate,
					radarrCalendarHideDownloaded: settings.radarrCalendarHideDownloaded,
					sonarrCalendarShowDate: settings.sonarrCalendarShowDate,
					sonarrCalendarShowEpisodeInfo: settings.sonarrCalendarShowEpisodeInfo,
					sonarrCalendarHideDownloaded: settings.sonarrCalendarHideDownloaded,
					dateFormat: settings.dateFormat
				};
				const calendarRows = calendarsEnabled ? await fetchCalendarRows(calendarSettings, {radarrEnabled, sonarrEnabled}) : [];

				// Owned seasonal titles are library items already, so this row skips the
				// provider id matching the others go through.
				let seasonalRow = null;
				if (seasonalEnabled) {
					const country = seasonalCountryParam(settings.seasonalRowCountry, await resolveDeviceCountry());
					const payload = await fetchSeasonalRow({country, allYear: settings.seasonalRowAllYear === true});
					// The plugin builds the suggestions in English, so they are put into the language here.
					const localized = payload && payload.suggestions && payload.suggestions.length
						? {...payload, suggestions: await localizeExternalItems(payload.suggestions, language).catch(() => payload.suggestions)}
						: payload;
					seasonalRow = buildSeasonalRow(localized, settings.seasonalRowHiddenHolidays || []);
				}

				const allRows = [
					...presetData,
					...customData,
					...calendarRows.map((r) => ({...r, isCalendarRow: true}))
				].filter((r) => r && r.items && r.items.length > 0);

				// Every row's items go out in one request rather than one per row, then each
				// row takes back the slice it put in.
				const allItemsToResolve = [];
				const rowIndices = [];
				for (const r of allRows) {
					rowIndices.push({start: allItemsToResolve.length, count: r.items.length});
					allItemsToResolve.push(...r.items);
				}

				const resolvedAllItems = await resolveItemsByProviderIds(allItemsToResolve);

				const presetRows = [];
				const builtCustomRows = [];
				const resolvedCalendarRows = [];

				for (let i = 0; i < allRows.length; i++) {
					const r = allRows[i];
					const sliceInfo = rowIndices[i];
					const resolvedItems = resolvedAllItems.slice(sliceInfo.start, sliceInfo.start + sliceInfo.count);

					if (r.isCalendarRow) {
						resolvedCalendarRows.push({...r, items: resolvedItems});
					} else {
						const resolvedRow = {
							id: r.id,
							title: r.title,
							items: resolvedItems,
							isExternalRow: true,
							isCustomRow: r.isCustomRow
						};
						if (r.isCustomRow) {
							builtCustomRows.push(resolvedRow);
						} else {
							presetRows.push(resolvedRow);
						}
					}
				}

				// What the library does not hold in the rows is put into the language before they are shown, since the IMDb
				// lists and the viewer's own lists come back in English, and a plugin that keeps a copy from before, or does not
				// know the language, answers in English too. The TMDB charts are left to the plugin, which translates them. The rows then come up once, already in it, and are not swapped a few seconds later. The
				// seasonal row has been through this already.
				const built = await Promise.all([...presetRows, ...builtCustomRows, seasonalRow, ...resolvedCalendarRows].filter(Boolean).map(async (row) => (
					language && row.isExternalRow && !row.isSeasonalRow && !pluginTranslatesRow(row.id)
						? {...row, items: await localizeSeerrCards(row.items, language).catch(() => row.items)}
						: row
				)));
				if (!cancelled) {
					memoryCache.externalRows = {key, owner, rows: watchingRow ? [...built, watchingRow] : built};
					settleSections(pendingRows.filter((row) => row.id !== 'mdblist_watching_now').map((row) => row.id), built);
					// Watching Now loads on its own, so a row it already put up stays.
					setExternalRows((prevRows) => [...built, ...(watchingNowEnabled ? prevRows.filter((r) => r.id === 'mdblist_watching_now') : [])]);
				}
			} catch (err) {
				console.warn('[Browse] Failed to fetch and resolve external rows:', err);
			}
			if (!cancelled) setPending((prevPending) => prevPending.filter((row) => row.id === 'mdblist_watching_now'));
		})();

		if (watchingNowEnabled) {
			// Loaded apart so a slow MDBList answer doesn't hold back the other rows.
			loadWatchingNowRow().catch((err) => {
				console.warn('[Browse] Failed to load Watching Now:', err);
				return null;
			}).then((row) => {
				if (cancelled) return;
				keepWatchingRow(row);
				settleSections(['mdblist_watching_now'], row ? [row] : []);
				setExternalRows((prevRows) => (row ? withRow(prevRows, row) : prevRows.filter((r) => r.id !== 'mdblist_watching_now')));
				setPending((prevPending) => prevPending.filter((r) => r.id !== 'mdblist_watching_now'));
			});

			startWatchingRefresh();
		}

		return stopWork;
	}, [settings.useMoonfinPlugin, homeRows, kidsMode, settings.homeRows, settings.customHomeRows,
		settings.uiLanguage, hasPlugin, tmdbAvailable, mdblistAvailable, calendarAvailable, discoverChartsSupported, serverType,
		settings.tmdbApiKey, settings.mdblistApiKey,
		settings.seasonalRowCountry, settings.seasonalRowHiddenHolidays, settings.seasonalRowAllYear,
		settings.mergeRadarrSonarrCalendars,
		settings.radarrCalendarShowCinema, settings.radarrCalendarShowDigital, settings.radarrCalendarShowPhysical,
		settings.radarrCalendarShowDate, settings.sonarrCalendarShowDate, settings.sonarrCalendarShowEpisodeInfo,
		settings.radarrCalendarHideDownloaded, settings.sonarrCalendarHideDownloaded, settings.dateFormat, owner, reloadKey,
		settings.imdbRowsSortBy, settings.imdbRowsSortOrder, settings.tmdbRowsSortBy, settings.tmdbRowsSortOrder]);

	return {rows: externalRows, pending};
};

export default useExternalRows;
