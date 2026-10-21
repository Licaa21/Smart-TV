import {createContext, useContext, useState, useEffect, useCallback, useMemo, useRef} from 'react';
import * as seerrApi from '../services/seerrApi';
import {parseServerMessages} from '../services/serverMessages';
import {getFromStorage, saveToStorage} from '../services/storage';
import {afterHomeReady} from '../utils/homeReady';
import {useAuth} from './AuthContext';
import {useSeerr} from './SeerrContext';

// Holds the admin messages for the server the viewer is signed in to, and which
// ones this viewer has already read.
//
// Messages are cached, so the list still opens with no connection and a message
// posted while the app was closed is there on the next launch. The live event
// only reaches clients that are running.

const ServerMessagesContext = createContext(null);

const CACHE_KEY = 'serverMessages_';
const READ_KEY = 'serverMessagesRead_';

// One scope per server and user, so messages read on one server do not look
// read on another, and the next viewer does not inherit this one's.
const scopeKeyFor = (serverId, userId, serverUrl) => {
	const server = serverId || (serverUrl || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_');
	if (!server) return null;
	return userId ? `${server}_${userId}` : server;
};

const onlyStrings = (list) => (Array.isArray(list) ? list.filter((entry) => typeof entry === 'string') : []);

export const ServerMessagesProvider = ({children}) => {
	const {serverUrl, accessToken, activeServerInfo, user} = useAuth();
	const {pluginInfo, messagesSignal} = useSeerr();
	// Older plugins leave this out, which reads as false and hides the button.
	const supported = pluginInfo?.messagesSupported === true;
	const scope = scopeKeyFor(activeServerInfo?.serverId, user?.Id || activeServerInfo?.userId, serverUrl);

	const [messages, setMessages] = useState([]);
	const [readIds, setReadIds] = useState([]);
	const readIdsRef = useRef(readIds);
	readIdsRef.current = readIds;
	const loadedScopeRef = useRef(null);

	const saveReadIds = useCallback((ids) => {
		setReadIds(ids);
		if (scope) saveToStorage(READ_KEY + scope, ids).catch(() => {});
	}, [scope]);

	useEffect(() => {
		if (!scope) {
			loadedScopeRef.current = null;
			setMessages([]);
			setReadIds([]);
			return;
		}

		let stale = false;
		const load = async () => {
			let known = readIdsRef.current;
			// The cache comes first, so messages are there even with no connection.
			if (loadedScopeRef.current !== scope) {
				const [cached, read] = await Promise.all([
					getFromStorage(CACHE_KEY + scope).catch(() => null),
					getFromStorage(READ_KEY + scope).catch(() => null)
				]);
				if (stale) return;
				loadedScopeRef.current = scope;
				known = onlyStrings(read);
				setMessages(parseServerMessages(cached));
				setReadIds(known);
			}

			if (!supported || !serverUrl || !accessToken) return;
			await afterHomeReady();
			if (stale) return;

			let payload;
			try {
				payload = await seerrApi.getMoonfinMessages(serverUrl, accessToken);
			} catch (e) {
				// Server unreachable. Keep whatever the cache gave us.
				return;
			}
			if (stale) return;

			const fetched = parseServerMessages(payload);
			setMessages(fetched);
			saveToStorage(CACHE_KEY + scope, fetched).catch(() => {});

			// Read ids for messages the server no longer sends are dropped, so the
			// list does not grow forever.
			const live = {};
			fetched.forEach((message) => {
				live[message.id] = true;
			});
			const kept = known.filter((id) => live[id]);
			if (kept.length !== known.length) {
				setReadIds(kept);
				saveToStorage(READ_KEY + scope, kept).catch(() => {});
			}
		};
		load();

		return () => {
			stale = true;
		};
	}, [scope, supported, serverUrl, accessToken, messagesSignal]);

	const isRead = useCallback((id) => readIds.includes(id), [readIds]);

	const unreadCount = useMemo(() => messages.filter((message) => !readIds.includes(message.id)).length, [messages, readIds]);

	// Unread messages the admin marked as open the window.
	const pendingPopups = useMemo(
		() => messages.filter((message) => message.delivery === 'popup' && !readIds.includes(message.id)),
		[messages, readIds]
	);

	const markRead = useCallback((id) => {
		if (readIdsRef.current.includes(id)) return;
		saveReadIds([...readIdsRef.current, id]);
	}, [saveReadIds]);

	// Showing the open the window messages counts as reading them, otherwise the
	// window would open again on every refresh.
	const markPopupsRead = useCallback(() => {
		const ids = pendingPopups.map((message) => message.id);
		if (!ids.length) return;
		saveReadIds([...readIdsRef.current, ...ids]);
	}, [pendingPopups, saveReadIds]);

	const markAllRead = useCallback(() => {
		const unread = messages.map((message) => message.id).filter((id) => !readIdsRef.current.includes(id));
		if (!unread.length) return;
		saveReadIds([...readIdsRef.current, ...unread]);
	}, [messages, saveReadIds]);

	const contextValue = useMemo(() => ({
		messages,
		unreadCount,
		pendingPopups,
		isRead,
		markRead,
		markPopupsRead,
		markAllRead
	}), [messages, unreadCount, pendingPopups, isRead, markRead, markPopupsRead, markAllRead]);

	return (
		<ServerMessagesContext.Provider value={contextValue}>
			{children}
		</ServerMessagesContext.Provider>
	);
};

export const useServerMessages = () => {
	const context = useContext(ServerMessagesContext);
	if (!context) {
		throw new Error('useServerMessages must be used within ServerMessagesProvider');
	}
	return context;
};
