import {useEffect, useMemo, useRef, useState} from 'react';

import {loadSeerrSeason, seerrSeasonItems} from '../../utils/seerrSeasons';

// How many seasons are asked for at once. A long show has a lot of them, and the TV and the proxy in
// front of Seerr both do better with a few in flight than with all of them.
const PARALLEL = 3;

// A Seerr series' seasons, and its episodes as each season's answer arrives, so the first season is
// on screen while a long run is still coming in.
const useSeerrEpisodes = ({details, enabled, language, tmdbApiKey = ''}) => {
	const seriesId = details?.id;
	const seasons = useMemo(() => (enabled ? seerrSeasonItems(details) : []), [enabled, details]);
	const [episodes, setEpisodes] = useState([]);

	// The payload is refetched while a download is on its way, which hands back a new object for
	// the same series. Only a different series or language should start the episodes over.
	const seasonsRef = useRef(seasons);
	seasonsRef.current = seasons;

	useEffect(() => {
		setEpisodes([]);
		if (!enabled || !seriesId || !language) return undefined;

		let cancelled = false;
		// Specials come last. They sort first, and a viewer opens a show on its first season.
		const order = seasonsRef.current.map((season) => season.IndexNumber).sort((a, b) => (a === 0) - (b === 0) || a - b);
		const queue = [...order];
		// Seasons come back in any order but are shown in season order, so the one a viewer lands on
		// is there from the start and does not give way to a lower one arriving late.
		const arrived = new Map();
		let published = 0;
		const series = {id: seriesId, name: details?.name};

		const work = async () => {
			while (queue.length && !cancelled) {
				const number = queue.shift();
				let loaded = [];
				try {
					loaded = await loadSeerrSeason(series, number, language, tmdbApiKey);
				} catch (err) {
					// A season that cannot be had is left out rather than held against the rest.
					void err;
				}
				if (cancelled) return;
				arrived.set(number, loaded);
				const ready = [];
				while (published < order.length && arrived.has(order[published])) {
					ready.push(...arrived.get(order[published]));
					published += 1;
				}
				if (ready.length) setEpisodes((previous) => [...previous, ...ready]);
			}
		};
		for (let i = 0; i < PARALLEL; i++) work();

		return () => {
			cancelled = true;
		};
		// details is read for the series' name only, and only when the series changes.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [enabled, seriesId, language, tmdbApiKey]);

	// The previous series' episodes are dropped for the one render before the effect clears them.
	const own = useMemo(() => episodes.filter((episode) => episode.ProviderIds?.Tmdb === String(seriesId)), [episodes, seriesId]);

	return {seasons, episodes: own};
};

export default useSeerrEpisodes;
