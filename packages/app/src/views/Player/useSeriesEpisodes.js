import {useEffect, useMemo, useRef, useState} from 'react';

import * as jellyfinApi from '../../services/jellyfinApi';
import {withoutBlockedItems} from '../../services/parentalControls';
import {browsableEpisodes, initialSeasonId, tagWithServerOf} from '../../utils/episodeBrowser';

// The seasons of the series that is playing, and the episodes of whichever one is selected.
// It asks the same two questions the details screen does, getSeasons for the tabs and
// getEpisodes for a season, of the server the playing episode came from, and filters and tags
// what comes back the same way. Nothing is fetched until the browser is opened, and a season
// is only fetched the first time it is chosen.
const useSeriesEpisodes = ({item, enabled}) => {
	const seriesId = item?.SeriesId;
	const [seasons, setSeasons] = useState(null);
	const [selectedSeasonId, setSelectedSeasonId] = useState(null);
	const [bySeason, setBySeason] = useState({});
	const [seasonsFailed, setSeasonsFailed] = useState(false);

	// The playing item is read from a ref, so a fresh copy of it (its watched state refreshing,
	// say) doesn't send the browser back to the first season.
	const itemRef = useRef(item);
	itemRef.current = item;
	const itemId = item?.Id;
	const {_serverUrl: serverUrl, _serverAccessToken: token, _serverUserId: userId, _serverType: serverType} = item || {};

	const api = useMemo(() => {
		if (serverUrl && token && userId) {
			return jellyfinApi.createApiForServer(serverUrl, token, userId, serverType || 'jellyfin');
		}
		return jellyfinApi.api;
	}, [serverUrl, token, userId, serverType]);

	useEffect(() => {
		if (!enabled || !seriesId) return undefined;
		let live = true;
		const playing = itemRef.current;
		setSeasonsFailed(false);
		api.getSeasons(seriesId)
			.then((data) => {
				if (!live) return;
				const list = tagWithServerOf(playing, withoutBlockedItems(data?.Items || [], playing?.OfficialRating));
				setSeasons(list);
				setSelectedSeasonId(initialSeasonId(list, playing));
			})
			.catch(() => {
				if (live) setSeasonsFailed(true);
			});
		return () => {
			live = false;
		};
	}, [enabled, seriesId, itemId, api]);

	const selectedLoaded = selectedSeasonId != null && bySeason[selectedSeasonId] !== undefined;
	useEffect(() => {
		if (!enabled || !seriesId || selectedSeasonId == null || selectedLoaded) return undefined;
		let live = true;
		const playing = itemRef.current;
		api.getEpisodes(seriesId, selectedSeasonId)
			.then((data) => {
				if (!live) return;
				const list = tagWithServerOf(playing, withoutBlockedItems(data?.Items || [], playing?.OfficialRating));
				setBySeason((prev) => ({...prev, [selectedSeasonId]: {items: browsableEpisodes(list)}}));
			})
			.catch(() => {
				if (live) setBySeason((prev) => ({...prev, [selectedSeasonId]: {failed: true}}));
			});
		return () => {
			live = false;
		};
	}, [enabled, seriesId, selectedSeasonId, selectedLoaded, api]);

	const current = selectedSeasonId != null ? bySeason[selectedSeasonId] : undefined;

	return {
		seasons,
		selectedSeasonId,
		selectSeason: setSelectedSeasonId,
		// Null while the selected season is still on its way.
		episodes: current?.items ?? null,
		failed: seasonsFailed || Boolean(current?.failed)
	};
};

export default useSeriesEpisodes;
