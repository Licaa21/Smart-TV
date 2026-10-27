import {useEffect, useRef, useState} from 'react';
import $L from '@enact/i18n/$L';

import {memoryCache} from './browseCache';
import {getExternalHomeRowConfigs, fetchExternalPresetRow, fetchCustomHomeRow, fetchCalendarRows, buildSeasonalRow} from '../../utils/externalHomeRows';
import {fetchSeasonalRow} from '../../services/externalRowsApi';
import {resolveItemsByProviderIds} from '../../services/jellyfinApi';
import {seasonalCountryParam} from '../../utils/seasonalRow';
import {resolveDeviceCountry} from '../../utils/deviceCountry';
import {currentMetadataLanguage} from '../../utils/metadataLanguage';
import {localizeExternalItems, localizeSeerrCards} from '../../utils/localizeExternalItems';

// Home rows built from TMDB and IMDb charts, lists the viewer pasted a URL for, and the
// Radarr and Sonarr calendars. Items arrive as provider ids, so every row is resolved against
// the local library first: what the server owns becomes playable, the rest falls back to Seerr.
// The rows still on their way come back as [pending], so they can hold their place.
// A return to the home screen takes the rows it left from memory, and does not fetch and resolve them again.
const useExternalRows = ({settings, homeRows, kidsMode, reuse = false, owner = ''}) => {
	const [externalRows, setExternalRows] = useState(() => (reuse && memoryCache.externalRows?.owner === owner ? memoryCache.externalRows.rows : []));
	const [pending, setPending] = useState([]);
	const reuseRef = useRef(reuse);

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
		if (!settings.useMoonfinPlugin) {
			setExternalRows([]);
			setPending([]);
			return undefined;
		}
		// The rows arrive already filtered, and the pasted list rows go the way the plugin rows do,
		// since nothing here can vouch for what an outside catalogue returns.
		const rows = homeRows || settings.homeRows || [];
		const enabledPresets = rows.filter((r) => r.enabled && (r.id.startsWith('tmdb_') || r.id.startsWith('imdb-'))).map((r) => r.id);
		const customRows = kidsMode ? [] : (settings.customHomeRows || []).filter((r) => r.enabled);
		const radarrEnabled = rows.some((r) => r.enabled && r.id === 'radarr_calendar');
		const sonarrEnabled = rows.some((r) => r.enabled && r.id === 'sonarr_calendar');
		const calendarsEnabled = radarrEnabled || sonarrEnabled;
		// The seasonal row is stored as a home row and as its own synced toggle, and both have to be on.
		const seasonalEnabled = settings.seasonalRowEnabled === true && rows.some((r) => r.enabled && r.id === 'seasonal');
		if (enabledPresets.length === 0 && customRows.length === 0 && !calendarsEnabled && !seasonalEnabled) {
			setExternalRows([]);
			setPending([]);
			return undefined;
		}

		const mergedCalendars = radarrEnabled && sonarrEnabled && settings.mergeRadarrSonarrCalendars;
		// Everything the fetch reads, so that rows made for other settings are not taken back
		const key = JSON.stringify([
			enabledPresets, customRows, radarrEnabled, sonarrEnabled, mergedCalendars, seasonalEnabled,
			settings.seasonalRowCountry, settings.seasonalRowHiddenHolidays,
			settings.radarrCalendarShowCinema, settings.radarrCalendarShowDigital, settings.radarrCalendarShowPhysical,
			settings.radarrCalendarShowDate, settings.sonarrCalendarShowDate, settings.sonarrCalendarShowEpisodeInfo
		]);
		const reusing = reuseRef.current && memoryCache.externalRows?.key === key && memoryCache.externalRows.owner === owner;
		reuseRef.current = false;
		if (reusing) {
			setExternalRows(memoryCache.externalRows.rows);
			setPending([]);
			return undefined;
		}

		let cancelled = false;
		const presetConfigs = getExternalHomeRowConfigs();
		setPending([
			...enabledPresets
				.map((id) => presetConfigs.find((c) => c.id === id))
				.filter(Boolean)
				.map((cfg) => ({id: cfg.id, title: cfg.title})),
			...customRows.map((row) => ({id: `external-${row.id}`, title: row.name || row.title || $L('Custom'), isCustomRow: true})),
			...(seasonalEnabled ? [{id: 'seasonal', title: $L('Seasonal Row')}] : []),
			...(mergedCalendars ? [{id: 'radarr_calendar', title: $L('Upcoming Releases'), isCalendarMerged: true}] : []),
			...(radarrEnabled && !mergedCalendars ? [{id: 'radarr_calendar', title: $L('Upcoming Movies')}] : []),
			...(sonarrEnabled && !mergedCalendars ? [{id: 'sonarr_calendar', title: $L('Upcoming Episodes')}] : [])
		]);

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
					sonarrCalendarShowDate: settings.sonarrCalendarShowDate,
					sonarrCalendarShowEpisodeInfo: settings.sonarrCalendarShowEpisodeInfo
				};
				const calendarRows = calendarsEnabled ? await fetchCalendarRows(calendarSettings, {radarrEnabled, sonarrEnabled}) : [];

				// Owned seasonal titles are library items already, so this row skips the
				// provider id matching the others go through.
				let seasonalRow = null;
				if (seasonalEnabled) {
					const country = seasonalCountryParam(settings.seasonalRowCountry, await resolveDeviceCountry());
					const payload = await fetchSeasonalRow({country});
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

				// What the library does not hold in the rows is put into the language before they are shown, whatever the plugin
				// did with the language it was asked for, since one that keeps a copy from before, or does not know the language,
				// answers in English. The rows then come up once, already in it, and are not swapped a few seconds later. The
				// seasonal row has been through this already.
				const built = await Promise.all([...presetRows, ...builtCustomRows, seasonalRow, ...resolvedCalendarRows].filter(Boolean).map(async (row) => (
					language && row.isExternalRow && !row.isSeasonalRow
						? {...row, items: await localizeSeerrCards(row.items, language).catch(() => row.items)}
						: row
				)));
				if (!cancelled) {
					memoryCache.externalRows = {key, owner, rows: built};
					setExternalRows(built);
					setPending([]);
				}
			} catch (err) {
				console.warn('[Browse] Failed to fetch and resolve external rows:', err);
			}
			if (!cancelled) setPending([]);
		})();

		return () => {
			cancelled = true;
		};
	}, [settings.useMoonfinPlugin, homeRows, kidsMode, settings.homeRows, settings.customHomeRows,
		settings.uiLanguage,
		settings.seasonalRowEnabled, settings.seasonalRowCountry, settings.seasonalRowHiddenHolidays,
		settings.mergeRadarrSonarrCalendars,
		settings.radarrCalendarShowCinema, settings.radarrCalendarShowDigital, settings.radarrCalendarShowPhysical,
		settings.radarrCalendarShowDate, settings.sonarrCalendarShowDate, settings.sonarrCalendarShowEpisodeInfo, owner, reloadKey,
		settings.imdbRowsSortBy, settings.imdbRowsSortOrder, settings.tmdbRowsSortBy, settings.tmdbRowsSortOrder]);

	return {rows: externalRows, pending};
};

export default useExternalRows;
