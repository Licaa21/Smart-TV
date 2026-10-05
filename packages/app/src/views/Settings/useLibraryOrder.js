import {useCallback, useEffect, useRef, useState} from 'react';

import connectionPool from '../../services/connectionPool';
import {resetLibraryScope} from '../../services/libraryScope';
import {moveLibrary, orderedViewsByServer} from './libraryOrder';

// A run of moves goes out as one write instead of one per move.
const SAVE_DELAY_MS = 600;

const hiddenFrom = (configurations) => new Set(configurations.reduce(
	(ids, configuration) => ids.concat(configuration?.MyMediaExcludes || []),
	[]
));

/**
 * The order the viewer's libraries appear in on Home, the latest rows and the navbar. It is
 * the server's own library order, so every app signed in to the account follows it.
 *
 * @param {Object} options
 * @param {Object} options.api
 * @param {boolean} options.unified - libraries from every server, each keeping its own order
 * @param {Function} [options.onLibrariesChanged]
 */
const useLibraryOrder = ({api, unified, onLibrariesChanged}) => {
	const [libraries, setLibraries] = useState(null);
	const [hidden, setHidden] = useState(() => new Set());
	const [loading, setLoading] = useState(true);
	const [loadFailed, setLoadFailed] = useState(false);
	// Counts failed saves, so each one can raise its own message.
	const [saveFailures, setSaveFailures] = useState(0);

	const mountedRef = useRef(true);
	const librariesRef = useRef(null);
	// The order the servers last took, which a failed write goes back to.
	const savedOrderRef = useRef([]);
	const saveTimerRef = useRef(null);
	const saveQueueRef = useRef(Promise.resolve());
	const lastQueuedSaveRef = useRef(0);

	const load = useCallback(async () => {
		setLoading(true);
		setLoadFailed(false);
		try {
			let loaded;
			let configurations;
			if (unified) {
				const [all, configs] = await Promise.all([
					connectionPool.getAllLibrariesFromAllServers(),
					connectionPool.getUserConfigFromAllServers()
				]);
				loaded = all;
				configurations = configs.map((config) => config.configuration);
			} else {
				const [views, user] = await Promise.all([api.getAllLibraries(), api.getUserConfiguration()]);
				loaded = views?.Items || [];
				configurations = [user?.Configuration];
			}
			if (!mountedRef.current) return;
			librariesRef.current = loaded;
			savedOrderRef.current = loaded;
			setLibraries(loaded);
			setHidden(hiddenFrom(configurations));
		} catch {
			if (mountedRef.current) setLoadFailed(true);
		} finally {
			if (mountedRef.current) setLoading(false);
		}
	}, [api, unified]);

	// The server replaces the whole configuration on every write, so each save starts from the
	// configuration as it is now. Anything changed elsewhere since this screen opened would
	// otherwise be put back.
	const writeOrder = useCallback(async (ordered) => {
		const orders = orderedViewsByServer(ordered);
		if (!unified) {
			const user = await api.getUserConfiguration();
			await api.updateUserConfiguration({...user.Configuration, OrderedViews: orders[''] || []});
			return;
		}
		const configs = await connectionPool.getUserConfigFromAllServers();
		if (Object.keys(orders).some((url) => !configs.some((config) => config.serverUrl === url))) {
			throw new Error('A server did not return its configuration');
		}
		await Promise.all(configs.filter((config) => orders[config.serverUrl]).map((config) =>
			connectionPool.updateUserConfigOnServer(
				config.serverUrl,
				config.accessToken,
				config.userId,
				{...config.configuration, OrderedViews: orders[config.serverUrl]},
				config.serverType
			)
		));
	}, [api, unified]);

	const save = useCallback(() => {
		const ordered = librariesRef.current;
		if (!ordered) return;
		const saveId = ++lastQueuedSaveRef.current;
		// Queued so writes land in the order they were made and a slow one cant undo a later move.
		saveQueueRef.current = saveQueueRef.current.then(async () => {
			try {
				await writeOrder(ordered);
				savedOrderRef.current = ordered;
				resetLibraryScope();
				onLibrariesChanged?.();
				window.dispatchEvent(new window.CustomEvent('moonfin:browseRefresh', {detail: {libraries: true}}));
			} catch {
				if (!mountedRef.current || saveId !== lastQueuedSaveRef.current) return;
				clearTimeout(saveTimerRef.current);
				saveTimerRef.current = null;
				librariesRef.current = savedOrderRef.current;
				setLibraries(savedOrderRef.current);
				setSaveFailures((count) => count + 1);
			}
		});
	}, [writeOrder, onLibrariesChanged]);

	const saveRef = useRef(save);
	saveRef.current = save;

	useEffect(() => {
		load();
	}, [load]);

	useEffect(() => () => {
		mountedRef.current = false;
		// Backing out right after a move still keeps the move.
		if (saveTimerRef.current) {
			clearTimeout(saveTimerRef.current);
			saveTimerRef.current = null;
			saveRef.current();
		}
	}, []);

	// Moves one library and says whether it moved, which it does not when the move would take
	// it past the end of the list or of its server's libraries.
	const move = useCallback((index, newIndex) => {
		const next = librariesRef.current && moveLibrary(librariesRef.current, index, newIndex);
		if (!next) return false;
		librariesRef.current = next;
		setLibraries(next);
		clearTimeout(saveTimerRef.current);
		saveTimerRef.current = setTimeout(() => {
			saveTimerRef.current = null;
			saveRef.current();
		}, SAVE_DELAY_MS);
		return true;
	}, []);

	return {libraries, hidden, loading, loadFailed, saveFailures, retry: load, move};
};

export default useLibraryOrder;
