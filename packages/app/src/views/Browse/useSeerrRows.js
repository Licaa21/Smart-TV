import {useEffect, useRef, useState} from 'react';

import {memoryCache, settleSections} from './browseCache';
import {getSeerrHomeRowConfigs, fetchSeerrHomeRow, normalizeMediaItem, SEERR_SECTION_TO_CONFIG} from '../../utils/seerrHomeRows';
import {loadSliderHomeRow} from '../../utils/seerrSliders';
import {isSameServer, isSeerrSliderRow} from '../../utils/pickedRows';
import {sortExternalItems} from '../../utils/externalHomeRows';

// The discover rows Seerr provides. They are fetched separately from the library rows because
// they come from a different server and only exist while Seerr is connected and signed in. The
// rows still on their way come back as [pending], so they can hold their place.
// A return to the home screen takes the rows it left from memory, since fetching them again brings them back
// late and reshuffled, and the row focus is put back on is not there yet to take it.
const useSeerrRows = ({seerrEnabled, seerrAuthenticated, seerrUserId, homeRows, serverUrl, sortBy, sortOrder, reuse = false, owner = ''}) => {
	const [seerrRows, setSeerrRows] = useState(() => (reuse && memoryCache.seerrRows?.owner === owner ? memoryCache.seerrRows.rows : []));
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
		if (!seerrEnabled || !seerrAuthenticated) {
			setSeerrRows([]);
			setPending([]);
			return undefined;
		}
		const enabledSections = (homeRows || []).filter((r) => r.enabled && SEERR_SECTION_TO_CONFIG[r.id]);
		const sliderRows = (homeRows || []).filter((r) => r.enabled && isSeerrSliderRow(r) && isSameServer(r.serverUrl, serverUrl));
		if (enabledSections.length === 0 && sliderRows.length === 0) {
			setSeerrRows([]);
			setPending([]);
			return undefined;
		}

		const key = `${seerrUserId}|${enabledSections.map((section) => section.id).join(',')}|${sliderRows.map((row) => row.id).join(',')}|${sortBy}|${sortOrder}`;
		const reusing = reuseRef.current && memoryCache.seerrRows?.key === key && memoryCache.seerrRows.owner === owner;
		reuseRef.current = false;
		if (reusing) {
			setSeerrRows(memoryCache.seerrRows.rows);
			setPending([]);
			return undefined;
		}

		let cancelled = false;
		const configs = getSeerrHomeRowConfigs();
		const configFor = (section) => configs.find((c) => c.id === SEERR_SECTION_TO_CONFIG[section.id]);
		const pendingRows = [
			...enabledSections.filter(configFor).map((section) => ({id: section.id, title: configFor(section).title})),
			...sliderRows.map((row) => ({id: row.id, title: row.name}))
		];
		setPending(pendingRows);

		const settle = () => {
			if (!cancelled) setPending([]);
		};

		(async () => {
			const built = await Promise.all(enabledSections.map(async (section) => {
				const configId = SEERR_SECTION_TO_CONFIG[section.id];
				const cfg = configFor(section);
				if (!cfg) return null;
				const items = await fetchSeerrHomeRow(configId, {userId: seerrUserId});
				if (!items.length) return null;
				return {
					id: section.id,
					title: cfg.title,
					items: cfg.type === 'shortcut' ? items : sortExternalItems(items, sortBy, sortOrder),
					type: cfg.cardType,
					isSeerrRow: true,
					isTileRow: cfg.type === 'genre' || cfg.type === 'studio' || cfg.type === 'network' || cfg.type === 'shortcut'
				};
			}));
			const builtSliders = await Promise.all(sliderRows.map(async (row) => {
				const loaded = await loadSliderHomeRow(row).catch(() => null);
				if (!loaded?.results.length) return null;
				return {
					id: row.id,
					title: loaded.slider.title,
					items: sortExternalItems(loaded.results.map(normalizeMediaItem), sortBy, sortOrder),
					type: 'portrait',
					isSeerrRow: true
				};
			}));
			if (cancelled) return;
			const rows = [...built, ...builtSliders].filter(Boolean);
			memoryCache.seerrRows = {key, owner, rows};
			settleSections(pendingRows.map((row) => row.id), rows);
			setSeerrRows(rows);
		})().then(settle, settle);

		return () => {
			cancelled = true;
		};
	}, [seerrEnabled, seerrAuthenticated, seerrUserId, homeRows, serverUrl, sortBy, sortOrder, owner, reloadKey]);

	return {rows: seerrRows, pending};
};

export default useSeerrRows;
