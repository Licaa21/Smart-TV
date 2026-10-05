import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import * as jellyfinApi from '../../services/jellyfinApi';
import {subscribeParentalControls, withoutBlockedItems} from '../../services/parentalControls';
import {browsableEpisodes, initialSeasonId, seasonIdOf, tagWithServerOf} from '../../utils/episodeBrowser';

// What the browser last showed for each series, so opening it again draws at once from this and
// refreshes behind it. Watched marks change while you watch, so nothing here is trusted for long:
// every open asks the server again and replaces what it held.
// It holds what the server returned and nothing the viewer's blocked ratings took out, so a rating
// blocked or unblocked since is applied when the lists are read, never from a stale filtering.
const cache = new Map();

export const clearSeriesEpisodesCache = () => cache.clear();

const cacheKey = (serverUrl, seriesId) => `${serverUrl || ''}|${seriesId}`;

/**
 * The seasons of the series that is playing, and the episodes of whichever one is selected.
 *
 * It asks the same two questions the details screen does, getSeasons for the tabs and getEpisodes
 * for a season, of the server the playing episode came from, and filters and tags what comes back
 * the same way. The playing episode already names its season, so that season's episodes are
 * requested at the same moment as the season list rather than after it. A season is fetched the
 * first time it is chosen, and everything is kept in memory between opens.
 */
const useSeriesEpisodes = ({item, enabled}) => {
	const seriesId = item?.SeriesId;
	// The playing item is read from a ref, so a fresh copy of it (its watched state refreshing,
	// say) doesn't send the browser back to the first season.
	const itemRef = useRef(item);
	itemRef.current = item;
	const itemId = item?.Id;
	const {_serverUrl: serverUrl, _serverAccessToken: token, _serverUserId: userId, _serverType: serverType} = item || {};
	const key = cacheKey(serverUrl, seriesId);

	const api = useMemo(() => {
		if (serverUrl && token && userId) {
			return jellyfinApi.createApiForServer(serverUrl, token, userId, serverType || 'jellyfin');
		}
		return jellyfinApi.api;
	}, [serverUrl, token, userId, serverType]);

	// Drawn from memory when the series was opened before, so there is no wait to see it.
	const [seasons, setSeasons] = useState(() => cache.get(key)?.seasons ?? null);
	const [selectedSeasonId, setSelectedSeasonId] = useState(() => {
		const held = cache.get(key);
		return held?.seasons ? initialSeasonId(held.seasons, item) : seasonIdOf(item);
	});
	const [bySeason, setBySeason] = useState(() => cache.get(key)?.bySeason ?? {});
	const [seasonsFailed, setSeasonsFailed] = useState(false);
	// Seasons already asked for since the browser opened, so each is fetched once, and one that
	// was held from before is still refreshed the first time it is shown.
	const askedRef = useRef(new Set());
	// Counts how many times the browser's own effect has ended, so a request that was already out
	// when it did can tell that nothing is waiting for it any more.
	const runRef = useRef(0);

	// Another series, or another server, starts from what is held for it, not from the last one.
	const keyRef = useRef(key);
	useEffect(() => {
		if (keyRef.current === key) return;
		keyRef.current = key;
		const held = cache.get(key);
		setSeasons(held?.seasons ?? null);
		setSelectedSeasonId(held?.seasons ? initialSeasonId(held.seasons, itemRef.current) : seasonIdOf(itemRef.current));
		setBySeason(held?.bySeason ?? {});
		setSeasonsFailed(false);
	}, [key]);

	const remember = useCallback((patch) => {
		const held = cache.get(key) || {seasons: null, bySeason: {}};
		cache.set(key, {...held, ...patch, bySeason: {...held.bySeason, ...(patch.bySeason || {})}});
	}, [key]);

	const loadSeason = useCallback((seasonId) => {
		if (!seriesId || seasonId == null || askedRef.current.has(String(seasonId))) return undefined;
		askedRef.current.add(String(seasonId));
		const playing = itemRef.current;
		const run = runRef.current;
		return api.getEpisodes(seriesId, seasonId)
			.then((data) => {
				const list = tagWithServerOf(playing, data?.Items || []);
				const entry = {items: browsableEpisodes(list)};
				remember({bySeason: {[seasonId]: entry}});
				// An answer that lands after the browser closed, or moved to another series, is dropped.
				if (run !== runRef.current) return;
				setBySeason((prev) => ({...prev, [seasonId]: entry}));
			})
			.catch(() => {
				if (run !== runRef.current) return;
				// A season that was already showing keeps what it has, and one that never loaded says so.
				setBySeason((prev) => (prev[seasonId]?.items ? prev : {...prev, [seasonId]: {failed: true}}));
			});
	}, [api, seriesId, remember]);

	useEffect(() => {
		if (!enabled || !seriesId) return undefined;
		let live = true;
		askedRef.current = new Set();
		setSeasonsFailed(false);
		const playing = itemRef.current;

		// The two requests go out together: the season list for the tabs, and the episodes of the
		// season that is playing, which is the list that is about to be looked at.
		loadSeason(seasonIdOf(playing));
		api.getSeasons(seriesId)
			.then((data) => {
				if (!live) return;
				const list = tagWithServerOf(playing, data?.Items || []);
				remember({seasons: list});
				setSeasons(list);
				// The playing season is already selected, unless the server no longer lists it.
				setSelectedSeasonId((selected) => {
					const known = list.some((season) => String(season.Id) === String(selected));
					return known ? selected : initialSeasonId(list, playing);
				});
			})
			.catch(() => {
				if (live) setSeasonsFailed(true);
			});
		return () => {
			live = false;
			runRef.current += 1;
		};
	}, [enabled, seriesId, itemId, api, loadSeason, remember]);

	useEffect(() => {
		if (enabled) loadSeason(selectedSeasonId);
	}, [enabled, selectedSeasonId, loadSeason]);

	const current = selectedSeasonId != null ? bySeason[selectedSeasonId] : undefined;

	// The blocked ratings of this moment, applied to what is held, so a rating blocked since a list
	// was drawn does not show it again while the refresh is still on its way.
	// A change to the blocked ratings while the browser is open is seen at once, without a refetch.
	const [parentalVersion, setParentalVersion] = useState(0);
	useEffect(() => subscribeParentalControls(() => setParentalVersion((version) => version + 1)), []);
	const rating = item?.OfficialRating;
	const visibleSeasons = useMemo(() => (seasons ? withoutBlockedItems(seasons, rating) : seasons), [seasons, rating, parentalVersion]); // eslint-disable-line react-hooks/exhaustive-deps
	const visibleEpisodes = useMemo(() => (current?.items ? withoutBlockedItems(current.items, rating) : null), [current, rating, parentalVersion]); // eslint-disable-line react-hooks/exhaustive-deps

	return {
		seasons: visibleSeasons,
		selectedSeasonId,
		selectSeason: setSelectedSeasonId,
		// Null while the selected season is still on its way.
		episodes: visibleEpisodes,
		failed: seasonsFailed || Boolean(current?.failed)
	};
};

export default useSeriesEpisodes;
