import {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {getPerfLevelIndex} from '../utils/perfTier';

import * as achievementsApi from '../services/achievementsApi';
import {sameUserId, threadHasNewFromOthers} from '../utils/achievementsModel';
import {useAuth} from './AuthContext';

// Whether this server runs the Achievement Badges plugin, which is what decides whether the
// settings entry exists at all. False until a probe says otherwise, so the entry stays hidden on
// every server that does not run it, and cleared on the way out so it cannot survive into the
// next one.

const CLEARED = {
	available: false, leaderboardEnabled: true, questsEnabled: true,
	unlockToastsAvailable: false, socialAvailable: false
};

// How often the friends list, the chats and newly unlocked badges are asked for. The plugin
// gives each user 60 requests a minute across all of its routes, and a read is a few of them.
const POLL_MS = 30000;
// The older sets have little to spare, so from Medium down the social poll comes a quarter as often.
const pollMs = () => (getPerfLevelIndex() >= 3 ? POLL_MS * 4 : POLL_MS);

const NO_THREADS = [];

const AchievementsContext = createContext({
	...CLEARED, unlocks: null, clearUnlocks: () => {},
	friends: null, threads: NO_THREADS, badgeCount: 0, refreshSocial: () => Promise.resolve(),
	incomingMessages: NO_THREADS, shownIncomingMessage: () => {}, setOpenConversation: () => {},
	setMessageNotifications: () => {}, displayNameFor: () => null
});

export const AchievementsProvider = ({children}) => {
	const {isAuthenticated, serverUrl, accessToken} = useAuth();
	const [state, setState] = useState(CLEARED);
	// Badges the last read turned up that the user wants to hear about, until the shell has
	// shown them.
	const [unlocks, setUnlocks] = useState(null);
	const [friends, setFriends] = useState(null);
	const [threads, setThreads] = useState(NO_THREADS);
	// Chats that got a message from someone else since the last read, until the shell has
	// shown a banner for each.
	const [incomingMessages, setIncomingMessages] = useState(NO_THREADS);
	// The threads as the last read found them. Null until the first read, which only records
	// what is waiting so it doesnt all pop up at once.
	const seenThreadsRef = useRef(null);
	// The chat on screen, so a message landing in it doesnt pop a banner.
	const openConversationRef = useRef(null);
	const messageNotificationsRef = useRef(true);

	// Keyed off the token as well as the server, since the probe reads both from the api module
	// and a sign in sets them a moment after it reports itself authenticated.
	useEffect(() => {
		achievementsApi.reset();
		setState(CLEARED);
		setUnlocks(null);
		setFriends(null);
		setThreads(NO_THREADS);
		setIncomingMessages(NO_THREADS);
		seenThreadsRef.current = null;
		openConversationRef.current = null;
		messageNotificationsRef.current = true;
		if (!isAuthenticated || !serverUrl || !accessToken) return undefined;

		let cancelled = false;
		achievementsApi.probe().then((available) => {
			if (cancelled) return;
			const flags = achievementsApi.getFlags();
			setState({
				available,
				...flags,
				unlockToastsAvailable: available && flags.unlockToastsEnabled,
				socialAvailable: available && flags.friendsEnabled
			});
			// The plugin counts a daily login from this and nothing else, so it is the one call
			// the client has to make rather than read.
			if (available) achievementsApi.sendLoginPing();
		});
		return () => {
			cancelled = true;
		};
	}, [isAuthenticated, serverUrl, accessToken]);

	// Reads the friends list and the chats again, and notes which chats got a message from
	// someone else since the last read. Says whether the friends list came back.
	const refreshSocial = useCallback(async () => {
		const [friendsList, threadList] = await Promise.all([achievementsApi.fetchFriends(), achievementsApi.fetchThreads()]);
		if (friendsList) setFriends(friendsList);
		if (threadList) {
			const seen = seenThreadsRef.current;
			if (seen && messageNotificationsRef.current) {
				const fresh = threadList.filter((thread) =>
					threadHasNewFromOthers(thread, seen[thread.conversationId], openConversationRef.current));
				if (fresh.length) setIncomingMessages((queue) => [...queue, ...fresh]);
			}
			setThreads(threadList);
			seenThreadsRef.current = Object.fromEntries(threadList.map((thread) => [thread.conversationId, thread]));
		}
		return Boolean(friendsList);
	}, []);

	// The reads stop while the app is hidden and pick up again, with one straight away, when
	// it comes back.
	useEffect(() => {
		if (!state.unlockToastsAvailable && !state.socialAvailable) return undefined;
		let timer = null;
		const poll = () => {
			if (state.unlockToastsAvailable) {
				achievementsApi.refreshUnlocks().then((found) => {
					if (found) setUnlocks({...found, key: Date.now()});
				});
			}
			if (state.socialAvailable) refreshSocial();
		};
		const start = () => {
			if (timer) return;
			poll();
			timer = setInterval(poll, pollMs());
		};
		const stop = () => {
			clearInterval(timer);
			timer = null;
		};
		const onVisibility = () => (document.hidden ? stop() : start());
		document.addEventListener('visibilitychange', onVisibility);
		if (state.socialAvailable) {
			achievementsApi.fetchSocialPrivacy().then((privacy) => {
				if (privacy) messageNotificationsRef.current = privacy.messageNotifications;
			});
		}
		if (!document.hidden) start();
		return () => {
			document.removeEventListener('visibilitychange', onVisibility);
			stop();
		};
	}, [state.unlockToastsAvailable, state.socialAvailable, refreshSocial]);

	const clearUnlocks = useCallback(() => setUnlocks(null), []);
	const shownIncomingMessage = useCallback(() => setIncomingMessages((queue) => queue.slice(1)), []);
	const setOpenConversation = useCallback((conversationId) => {
		openConversationRef.current = conversationId;
	}, []);
	const setMessageNotifications = useCallback((on) => {
		messageNotificationsRef.current = on;
	}, []);

	// A name for a user id from whatever was read last, for group members the chat payloads
	// only name by id.
	const displayNameFor = useCallback((userId) => {
		const people = [
			...(friends ? [...friends.friends, ...friends.incoming, ...friends.outgoing] : []),
			...threads.flatMap((thread) => thread.participants)
		];
		return people.find((person) => sameUserId(person.userId, userId) && person.userName)?.userName || null;
	}, [friends, threads]);

	// Friend requests waiting plus unread messages, which the Friends button wears.
	const badgeCount = (friends ? friends.incoming.length : 0) +
		threads.reduce((sum, thread) => sum + thread.unreadCount, 0);

	const value = useMemo(() => ({
		...state, unlocks, clearUnlocks,
		friends, threads, badgeCount, refreshSocial,
		incomingMessages, shownIncomingMessage, setOpenConversation, setMessageNotifications, displayNameFor
	}), [
		state, unlocks, clearUnlocks, friends, threads, badgeCount, refreshSocial,
		incomingMessages, shownIncomingMessage, setOpenConversation, setMessageNotifications, displayNameFor
	]);

	return <AchievementsContext.Provider value={value}>{children}</AchievementsContext.Provider>;
};

export const useAchievements = () => useContext(AchievementsContext);
