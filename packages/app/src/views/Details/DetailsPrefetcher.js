import {useEffect, useMemo, useRef, useState} from 'react';

import {useAuth} from '../../context/AuthContext';
import {useSettings} from '../../context/SettingsContext';
import {useSeerr} from '../../context/SeerrContext';
import {getApiForItem} from '../../services/connectionPool';
import {getUserId} from '../../services/jellyfinApi';
import {getPrefetchTargets, onPrefetchTargets} from '../../utils/detailsPrefetchTargets';
import {detailsKey, keptAge, onDetailsKept} from './detailsCache';
import useDetailsItem from './useDetailsItem';

// Fills in the details screens of the first titles of Continue Watching and Next Up while Home rests, so even the first
// time one of them is opened it is whole at once (detailsCache.js keeps them). It draws nothing: it runs the same load a
// details screen does, one title at a time, and the screen is kept when that load has finished. It starts only after Home
// has shown and nothing was pressed for a while, stops the moment a key is pressed (the load in progress is dropped),
// and does nothing during playback, with Home away, or with the app hidden.
const FIRST_QUIET_MS = 10000;
const QUIET_MS = 4000;
const BETWEEN_MS = 2500;
const GIVE_UP_MS = 25000;
// A screen kept more recently than this is left as it is, and it is read again behind itself when it is opened
const RECENT_MS = 6 * 60 * 60 * 1000;
// A title stopped by a key press is started again, but not endlessly for a viewer who keeps pressing
const MAX_STARTS = 2;

const identity = (items) => items;

const DetailsPrefetcher = ({active = true}) => {
	const {api, serverUrl} = useAuth();
	const {settings} = useSettings();
	const {pluginInfo, isEnabled: seerrEnabled} = useSeerr();
	// A title of another server of several is left to be opened, since its screen is tagged with that server
	const [targets, setTargets] = useState(() => getPrefetchTargets().filter((item) => !item._serverUrl));
	const [cursor, setCursor] = useState(0);
	const [resting, setResting] = useState(false);
	// Playback or a hidden app stops the work even with no key pressed, so it is looked at every couple of seconds
	const [busy, setBusy] = useState(false);
	useEffect(() => {
		// a video element, or the object the Tizen player draws into
		const look = () => setBusy(document.hidden || Boolean(document.querySelector('video, object[type="application/avplayer"]')));
		look();
		const timer = setInterval(look, 2000);
		return () => clearInterval(timer);
	}, []);

	useEffect(() => onPrefetchTargets((next) => {
		setTargets(next.filter((item) => !item._serverUrl));
		setCursor(0);
	}), []);

	// Resting means no key for a while. Any key stops the work at once, and it picks up again once things are quiet.
	useEffect(() => {
		let timer = null;
		const rest = (ms) => {
			if (timer) clearTimeout(timer);
			timer = setTimeout(() => setResting(true), ms);
		};
		const onKey = () => {
			setResting(false);
			rest(QUIET_MS);
		};
		rest(FIRST_QUIET_MS);
		window.addEventListener('keydown', onKey, true);
		return () => {
			if (timer) clearTimeout(timer);
			window.removeEventListener('keydown', onKey, true);
		};
	}, []);

	const canWork = active && resting && !busy;
	const userId = getUserId();
	const candidate = canWork ? targets[cursor] || null : null;
	const candidateServerUrl = candidate?._serverUrl || serverUrl;
	const key = candidate ? detailsKey(candidateServerUrl, userId, candidate.Id, settings) : null;
	// A title already kept a short while ago is passed over, without a load being started for it first
	const keptRecently = key !== null && keptAge(key) !== null && keptAge(key) < RECENT_MS;
	const starts = useRef(new Map());
	const triedEnough = key !== null && (starts.current.get(key) || 0) >= MAX_STARTS;
	const passOver = keptRecently || triedEnough;
	const seed = passOver ? null : candidate;
	const seedServerUrl = candidateServerUrl;
	useEffect(() => {
		if (passOver) setCursor((index) => index + 1);
	}, [passOver, cursor]);
	useEffect(() => {
		if (key && seed) starts.current.set(key, (starts.current.get(key) || 0) + 1);
	}, [key, seed]);

	// Go on to the next title once this one is kept, or after a while if it never is (it may not be keepable)
	useEffect(() => {
		if (!seed || !key) return undefined;
		let moved = false;
		let timer = null;
		const next = (delay) => {
			if (moved) return;
			moved = true;
			timer = setTimeout(() => setCursor((index) => index + 1), delay);
		};
		const stop = onDetailsKept((keptKey) => {
			if (keptKey === key) next(BETWEEN_MS);
		});
		const giveUp = setTimeout(() => next(0), GIVE_UP_MS);
		return () => {
			stop();
			clearTimeout(giveUp);
			if (timer) clearTimeout(timer);
			moved = true;
		};
	}, [seed, key]);

	const effectiveApi = useMemo(() => getApiForItem(seed) || api, [seed, api]);
	useDetailsItem({
		itemId: seed?.Id,
		initialItem: seed,
		effectiveApi,
		effectiveServerUrl: seedServerUrl,
		settings,
		recommendationsSupported: pluginInfo?.recommendationsSupported === true,
		seerrEnabled,
		tagWithServerInfo: identity,
		skip: !seed
	});

	return null;
};

export default DetailsPrefetcher;
