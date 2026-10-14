import {useCallback, useEffect, useRef, useState} from 'react';

import {useAuth} from '../context/AuthContext';

// How long the arrow turns at the least, so a quick answer still shows it, and how long the tick or the
// warning stays before the arrow comes back.
const MIN_BUSY_MS = 700;
const RESULT_MS = 1100;

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
		if (busyRef.current) return;
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
		if (!mountedRef.current) return;
		setNote(result);
		timerRef.current = setTimeout(() => setNote(''), RESULT_MS);
	}, []);

	const refreshAll = useCallback(() => run(() => api.refreshLibraries()), [run, api]);

	return {canRefresh: Boolean(user?.Policy?.IsAdministrator), note, refreshAll};
};

export default useLibraryRefresh;
