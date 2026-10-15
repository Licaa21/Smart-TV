import {useEffect, useRef, useState} from 'react';

import {memoryCache} from './browseCache';
import {getSeerrHomeRowConfigs, fetchSeerrHomeRow, SEERR_SECTION_TO_CONFIG} from '../../utils/seerrHomeRows';

// The discover rows Seerr provides. They are fetched separately from the library rows because
// they come from a different server and only exist while Seerr is connected and signed in. The
// rows still on their way come back as [pending], so they can hold their place.
// A return to the home screen takes the rows it left from memory, since fetching them again brings them back
// late and reshuffled, and the row focus is put back on is not there yet to take it.
const useSeerrRows = ({seerrEnabled, seerrAuthenticated, seerrUserId, homeRows, reuse = false, owner = ''}) => {
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
		if (enabledSections.length === 0) {
			setSeerrRows([]);
			setPending([]);
			return undefined;
		}

		const key = `${seerrUserId}|${enabledSections.map((section) => section.id).join(',')}`;
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
		setPending(enabledSections.filter(configFor).map((section) => ({id: section.id, title: configFor(section).title})));

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
					items,
					type: cfg.cardType,
					isSeerrRow: true,
					isTileRow: cfg.type === 'genre' || cfg.type === 'studio' || cfg.type === 'network' || cfg.type === 'shortcut'
				};
			}));
			if (cancelled) return;
			const rows = built.filter(Boolean);
			memoryCache.seerrRows = {key, owner, rows};
			setSeerrRows(rows);
		})().then(settle, settle);

		return () => {
			cancelled = true;
		};
	}, [seerrEnabled, seerrAuthenticated, seerrUserId, homeRows, owner, reloadKey]);

	return {rows: seerrRows, pending};
};

export default useSeerrRows;
