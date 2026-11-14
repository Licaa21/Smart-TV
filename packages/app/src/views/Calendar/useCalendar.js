import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useAuth} from '../../context/AuthContext';
import {useSettings} from '../../context/SettingsContext';
import {useSeerr} from '../../context/SeerrContext';
import {loadCalendar, seriesProgress, watchedIds} from '../../services/calendarApi';
import * as userDataSync from '../../services/userDataSync';
import {useUserDataVersion} from '../../hooks/useUserDataSync';
import {shiftedNow} from '../../utils/clock';
import {getImageUrl} from '../../utils/helpers';
import {addDays, behindOnSeries, calendarAllows, followsSeries, inLibrary, isEpisode, isoDay, playableId, startOfDay, withLibraryArt} from '../../utils/calendarEntries';

// Minutes are the smallest unit the countdown shows, so a tick every 20 s keeps it within a third
// of a minute.
const TICK_MS = 20000;

const count = (value, fallback) => (typeof value === 'number' && value >= 0 ? Math.trunc(value) : fallback);

/**
 * Loads the whole calendar window once and filters it with the calendar settings. Each screen has
 * its own, and loadCalendar caches the fetch between them.
 */
const useCalendar = ({tick = false} = {}) => {
	const {serverUrl, accessToken, api} = useAuth();
	const {settings} = useSettings();
	const {pluginInfo} = useSeerr();
	const daysBack = count(pluginInfo?.calendarDaysBack, 14);
	const daysAhead = count(pluginInfo?.calendarDaysAhead, 90);
	const offset = settings.timeOffsetHours;
	const [now, setNow] = useState(() => shiftedNow(offset));
	const todayKey = isoDay(now);
	// Only a new day moves the window, so the countdown's tick doesn't refetch.
	const today = useMemo(() => startOfDay(now), [todayKey]); // eslint-disable-line react-hooks/exhaustive-deps
	const windowStart = useMemo(() => addDays(today, -daysBack), [today, daysBack]);
	const windowEnd = useMemo(() => addDays(today, daysAhead + 1), [today, daysAhead]);

	const [state, setState] = useState({loading: true, all: [], problem: null});
	const [progress, setProgress] = useState({});
	// The episodes and movies on the server that aired and are watched, which Ready to watch leaves out
	const [watched, setWatched] = useState(() => new Set());
	const progressRef = useRef(progress);
	const watchedRef = useRef(watched);
	const generationRef = useRef(0);

	const unmonitored = settings.calendarIncludeUnmonitored === true;
	const needsProgress = settings.calendarScope === 'myShows' || settings.calendarSpoilerSafe === true;

	useEffect(() => {
		if (!tick) return undefined;
		const timer = setInterval(() => setNow(shiftedNow(offset)), TICK_MS);
		return () => clearInterval(timer);
	}, [tick, offset]);

	const load = useCallback(async (refresh = false) => {
		const generation = ++generationRef.current;
		setState((prev) => (prev.all.length ? prev : {...prev, loading: true}));
		const result = await loadCalendar({serverUrl, token: accessToken, start: windowStart, end: windowEnd, unmonitored, refresh});
		// My shows and spoiler safe read watch state, fetched once per series.
		let nextProgress = progressRef.current;
		// Ready to watch lists only what is not watched yet, so the watch state of what is on the server is read with each
		// load, at the same time as the series' progress
		const tomorrow = addDays(startOfDay(shiftedNow(offset)), 1);
		const readyIds = [];
		result.entries.forEach((e) => {
			const id = e.day < tomorrow && inLibrary(e) ? playableId(e) : null;
			if (id && readyIds.indexOf(id) < 0) readyIds.push(id);
		});
		const progressIds = [];
		if (needsProgress && api) {
			result.entries.forEach((e) => {
				if (isEpisode(e) && e.itemId && !nextProgress[e.itemId] && progressIds.indexOf(e.itemId) < 0) progressIds.push(e.itemId);
			});
		}
		const [progressRead, nextWatched] = await Promise.all([
			progressIds.length ? seriesProgress(api, progressIds) : null,
			readyIds.length && api ? watchedIds(api, readyIds, watchedRef.current) : new Set()
		]);
		if (progressRead) nextProgress = {...nextProgress, ...progressRead};
		if (generation !== generationRef.current) return;
		progressRef.current = nextProgress;
		watchedRef.current = nextWatched;
		setProgress(nextProgress);
		setWatched(nextWatched);
		setNow(shiftedNow(offset));
		setState({loading: false, all: result.entries, problem: result.problem});
	}, [serverUrl, accessToken, api, windowStart, windowEnd, unmonitored, needsProgress, offset]);

	useEffect(() => {
		load(false);
	}, [load]);

	const followed = useMemo(() => {
		const ids = new Set();
		Object.keys(progress).forEach((id) => {
			if (followsSeries(progress[id])) ids.add(id);
		});
		return ids;
	}, [progress]);

	const {calendarShowEpisodes, calendarShowMovies, calendarShowSpecials, calendarScope, calendarLibraryIds,
		radarrCalendarShowCinema, radarrCalendarShowDigital, radarrCalendarShowPhysical} = settings;
	// Made once per load, so an entry keeps its identity when only a filter changes.
	const withArt = useMemo(() => {
		const imageUrl = (id, type, options) => getImageUrl(serverUrl, id, type, options);
		return state.all.map((e) => withLibraryArt(e, imageUrl));
	}, [state.all, serverUrl]);
	const entries = useMemo(() => {
		const filter = {calendarShowEpisodes, calendarShowMovies, calendarShowSpecials, calendarScope, calendarLibraryIds,
			radarrCalendarShowCinema, radarrCalendarShowDigital, radarrCalendarShowPhysical};
		return withArt.filter((e) => calendarAllows(e, filter, followed));
	}, [withArt, followed, calendarShowEpisodes, calendarShowMovies, calendarShowSpecials, calendarScope, calendarLibraryIds,
		radarrCalendarShowCinema, radarrCalendarShowDigital, radarrCalendarShowPhysical]);

	const spoilerSafe = settings.calendarSpoilerSafe === true;
	// Spoiler safe hides an episode's name and still for a series the user is part way through.
	const hidesSpoilers = useCallback((e) => spoilerSafe && isEpisode(e) && behindOnSeries(progress[e.itemId]), [spoilerSafe, progress]);
	const reload = useCallback(() => load(true), [load]);
	// What was watched or marked watched in the app since the load counts at once
	const userDataVersion = useUserDataVersion();
	const isWatched = useCallback((e) => {
		const id = playableId(e);
		if (!id) return false;
		const known = {Id: id, UserData: {Played: watched.has(id)}};
		return userDataSync.apply(known).UserData.Played === true;
	}, [watched, userDataVersion]); // eslint-disable-line react-hooks/exhaustive-deps

	return {loading: state.loading, problem: state.problem, entries, now, today, windowStart, windowEnd, hidesSpoilers, isWatched, reload};
};

export default useCalendar;
