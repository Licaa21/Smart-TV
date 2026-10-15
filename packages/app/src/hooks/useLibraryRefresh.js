import {useCallback, useEffect, useRef, useState} from 'react';

import {useAuth} from '../context/AuthContext';
import {getServerUrl, getUserId} from '../services/jellyfinApi';

// How often the server is asked whether the scan has finished, how long that goes on for at the most, and how long to
// wait before refreshing anyway when the server will not say.
const SCAN_FIRST_MS = 3000;
const SCAN_POLL_MS = 5000;
const SCAN_POLL_MAX = 120;
const SCAN_UNKNOWN_MS = 10000;

// How long the arrow turns at the least, so a quick answer still shows it, and how long the tick or the
// warning stays before the arrow comes back.
const MIN_BUSY_MS = 700;
const RESULT_MS = 1100;

// The scan carries on in the server after it has answered, and what it finds is only worth showing once it is done, so it
// is watched until it is, and Home is refreshed then. A server that does not say how it is getting on gets the refresh
// after a short while instead. This lives outside the hook, since the sidebar or the bar that asked can go away while the
// scan runs, and a newer scan takes over from an older watch.
let latestWatch = 0;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const whoIsSignedIn = () => `${getServerUrl() || ''}|${getUserId() || ''}`;

export const refreshHomeWhenDone = async (api) => {
	const watch = ++latestWatch;
	// A watch belongs to whoever asked for the scan, and ends if someone else signs in
	const asker = whoIsSignedIn();
	for (let poll = 0; poll < SCAN_POLL_MAX; poll++) {
		await wait(poll === 0 ? SCAN_FIRST_MS : SCAN_POLL_MS);
		if (watch !== latestWatch || asker !== whoIsSignedIn()) return;
		const running = api.isLibraryScanRunning ? await api.isLibraryScanRunning() : null;
		if (watch !== latestWatch || asker !== whoIsSignedIn()) return;
		if (running === null) {
			await wait(SCAN_UNKNOWN_MS);
			break;
		}
		if (!running) break;
	}
	if (watch === latestWatch && asker === whoIsSignedIn()) window.dispatchEvent(new CustomEvent('moonfin:browseRefresh', {detail: {reload: true, featured: true}}));
};

// Asks the server to scan its libraries and says how that went: `busy` while it asks, then `started` or
// `failed` for a moment. Only an administrator may, so everyone else is given no way to ask. The scan runs on
// the server and carries on after the answer, so "started" is all there is to report.
const useLibraryRefresh = () => {
	const {api, user} = useAuth();
	const [note, setNote] = useState('');
	const timerRef = useRef(null);
	const mountedRef = useRef(true);
	const busyRef = useRef(false);

	useEffect(() => () => {
		mountedRef.current = false;
		clearTimeout(timerRef.current);
	}, []);

	const run = useCallback(async (job) => {
		// A second press while one is out would only ask again.
		if (busyRef.current) return false;
		busyRef.current = true;
		clearTimeout(timerRef.current);
		setNote('busy');
		const startedAt = Date.now();
		let result = 'started';
		try {
			await job();
		} catch (err) {
			result = 'failed';
		}
		const left = MIN_BUSY_MS - (Date.now() - startedAt);
		if (left > 0) await new Promise((resolve) => { timerRef.current = setTimeout(resolve, left); });
		busyRef.current = false;
		if (!mountedRef.current) return result === 'started';
		setNote(result);
		timerRef.current = setTimeout(() => setNote(''), RESULT_MS);
		return result === 'started';
	}, []);

	const refreshAll = useCallback(async () => {
		const started = await run(() => api.refreshLibraries());
		if (started) refreshHomeWhenDone(api);
	}, [run, api]);

	return {canRefresh: Boolean(user?.Policy?.IsAdministrator), note, refreshAll};
};

export default useLibraryRefresh;
