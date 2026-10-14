import {useCallback, useEffect, useRef, useState} from 'react';

import {useAuth} from '../context/AuthContext';

const NOTE_MS = 4000;

// Asks the server to scan its libraries, all of them or one, and says how that went for a few seconds. Only an
// administrator may, so everyone else is given no way to ask. The scan runs on the server and carries on after
// the answer, so "started" is all there is to report.
const useLibraryRefresh = () => {
	const {api, user} = useAuth();
	const [note, setNote] = useState('');
	const timerRef = useRef(null);
	const mountedRef = useRef(true);

	useEffect(() => () => {
		mountedRef.current = false;
		clearTimeout(timerRef.current);
	}, []);

	const run = useCallback(async (job) => {
		clearTimeout(timerRef.current);
		try {
			await job();
			if (mountedRef.current) setNote('started');
		} catch (err) {
			if (mountedRef.current) setNote('failed');
		}
		if (!mountedRef.current) return;
		timerRef.current = setTimeout(() => setNote(''), NOTE_MS);
	}, []);

	const refreshAll = useCallback(() => run(() => api.refreshLibraries()), [run, api]);
	// A library of another server is asked through that server's own api.
	const refreshLibrary = useCallback((libraryId, libraryApi) => run(() => (libraryApi || api).refreshItem(libraryId, {recursive: true})), [run, api]);

	return {canRefresh: Boolean(user?.Policy?.IsAdministrator), note, refreshAll, refreshLibrary};
};

export default useLibraryRefresh;
