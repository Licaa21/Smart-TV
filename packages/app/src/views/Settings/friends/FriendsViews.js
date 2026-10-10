/* eslint-disable react/jsx-no-bind */
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import $L from '@enact/i18n/$L';
import Spotlight from '@enact/spotlight';

import * as achievementsApi from '../../../services/achievementsApi';
import {useAchievements} from '../../../context/AchievementsContext';
import {useAuth} from '../../../context/AuthContext';
import {useSettings} from '../../../context/SettingsContext';
import {sameUserId, threadIsPhoto} from '../../../utils/achievementsModel';
import {relativeTimeLabel} from '../../../utils/relativeTime';
import SpottableInput from '../../../components/SpottableInput/SpottableInput';
import {Showcase, Message, LoadFailed} from '../achievements/AchievementsViews';
import SettingsView from '../SettingsView';
import {renderToggle, renderChevron} from '../settingsIcons';
import {SectionTitle, NavRow, ToggleRow} from '../settingsRows';
import {SpottableDiv} from '../settingsSpottables';

import settingsCss from '../Settings.module.less';
import css from './Friends.module.less';

const FAILED = () => $L("That didn't work. Try again in a moment.");
const LOAD_FAILED = () => $L('Could not load this. Check your connection and try again.');

// How often an open chat asks for new messages. Reading them is what marks them read, so it
// only runs while the chat is on screen.
const CHAT_POLL_MS = 10000;

const plural = (count, one, many) => (count === 1 ? one : many.replace('{count}', String(count)));

const unreadLabel = (count) => (count === 0 ? $L('No unread messages') : plural(count, $L('1 unread message'), $L('{count} unread messages')));
const requestLabel = (count) => (count === 0 ? $L('Nothing waiting') : plural(count, $L('1 waiting for you'), $L('{count} waiting for you')));

const mediaTitle = (media) => (media.seriesName ? `${media.seriesName}: ${media.name}` : media.name);

// What a friend is up to, in the order the list reads best: what they watch now, that they are
// on, what they watched last, when they were last here, or nothing.
const friendCaption = (friend) => {
	if (friend.online) {
		return friend.nowPlaying ? $L('Watching {title}').replace('{title}', mediaTitle(friend.nowPlaying)) : $L('Online');
	}
	if (friend.lastWatched) return $L('Last watched {title}').replace('{title}', mediaTitle(friend.lastWatched));
	if (friend.lastSeen) return $L('Last seen {time}').replace('{time}', relativeTimeLabel(friend.lastSeen));
	return $L('Offline');
};

// Runs one write on the plugin and keeps whatever it said when it refused, or a plain line
// when it failed outright.
const useWrite = () => {
	const [problem, setProblem] = useState(null);
	const [busy, setBusy] = useState(false);
	const write = useCallback(async (call) => {
		setBusy(true);
		setProblem(null);
		const result = await call();
		setBusy(false);
		if (!result.ok) setProblem(result.message || FAILED());
		return result;
	}, []);
	return {problem, busy, write, setProblem};
};

const Avatar = ({name, online, small}) => (
	<div className={`${css.avatar} ${small ? css.avatarSmall : ''}`}>
		{(name || '?').trim().charAt(0).toUpperCase()}
		{online != null && <span className={`${css.presence} ${online ? css.presenceOnline : ''}`} />}
	</div>
);

const PersonRow = ({spotlightId, name, caption, online, trailing, onClick}) => (
	<SpottableDiv className={settingsCss.listItem} spotlightId={spotlightId} onClick={onClick}>
		<Avatar name={name} online={online} small />
		<div className={settingsCss.listItemBody}>
			<div className={settingsCss.listItemHeading}>{name}</div>
			{caption && <div className={settingsCss.listItemCaption}>{caption}</div>}
		</div>
		{trailing !== undefined ? trailing : <div className={settingsCss.listItemTrailing}>{renderChevron()}</div>}
	</SpottableDiv>
);

const ActionButton = ({label, onClick, spotlightId, strong}) => (
	<SpottableDiv className={`${settingsCss.actionButton} ${strong ? css.strong : ''}`} spotlightId={spotlightId} onClick={onClick}>
		{label}
	</SpottableDiv>
);

// A question with two answers, in place of a dialog. The question takes the focus so the
// remote lands on an answer.
const ConfirmBox = ({message, confirmLabel, onConfirm, onCancel}) => {
	useEffect(() => {
		Spotlight.focus('friends-confirm-cancel');
	}, []);
	return (
		<div className={css.confirm}>
			<Message>{message}</Message>
			<div className={settingsCss.actionBar}>
				<ActionButton label={$L('Cancel')} onClick={onCancel} spotlightId="friends-confirm-cancel" />
				<ActionButton label={confirmLabel} onClick={onConfirm} spotlightId="friends-confirm-ok" strong />
			</div>
		</div>
	);
};

// ---------- Friends ----------

export const FriendsView = ({onOpen}) => {
	const {friends, threads, refreshSocial} = useAchievements();
	const [failed, setFailed] = useState(false);

	const load = useCallback(() => {
		setFailed(false);
		refreshSocial().then((loaded) => setFailed(!loaded));
	}, [refreshSocial]);
	useEffect(load, [load]);

	if (!friends) {
		return (
			<SettingsView spotlightId="friends-view" title={$L('Friends')}>
				{failed ? <LoadFailed message={LOAD_FAILED()} spotlightId="friends-retry" onRetry={load} /> : <Message>{$L('Loading...')}</Message>}
			</SettingsView>
		);
	}

	const unread = threads.reduce((sum, thread) => sum + thread.unreadCount, 0);
	const online = friends.friends.filter((friend) => friend.online);
	const offline = friends.friends.filter((friend) => !friend.online);
	const friendRows = (list) => list.map((friend) => (
		<PersonRow
			key={friend.userId}
			spotlightId={`friend-${friend.userId}`}
			name={friend.userName}
			caption={friendCaption(friend)}
			online={friend.online}
			onClick={() => onOpen('friendProfile', `friend-${friend.userId}`, {userId: friend.userId, name: friend.userName})}
		/>
	));

	return (
		<SettingsView spotlightId="friends-view" title={$L('Friends')}>
			<NavRow id="friends-messages" title={$L('Messages')} desc={unreadLabel(unread)} icon="forum" onClick={() => onOpen('friendsMessages', 'setting-friends-messages')} />
			{!friends.simpleMode && (
				<NavRow id="friends-requests" title={$L('Friend requests')} desc={requestLabel(friends.incoming.length)} icon="group_work" onClick={() => onOpen('friendsRequests', 'setting-friends-requests')} />
			)}
			<NavRow id="friends-add" title={$L('Add friends')} desc={$L('Find people on this server')} icon="person" onClick={() => onOpen('friendsAdd', 'setting-friends-add')} />
			<NavRow id="friends-privacy" title={$L('Privacy')} desc={$L('What your friends can see')} icon="privacy_tip" onClick={() => onOpen('friendsPrivacy', 'setting-friends-privacy')} />
			{friends.friends.length === 0 && <Message>{$L('No friends yet. Add people from this server to see them here.')}</Message>}
			{online.length > 0 && <SectionTitle>{$L('Online')}</SectionTitle>}
			{friendRows(online)}
			{offline.length > 0 && <SectionTitle>{$L('Offline')}</SectionTitle>}
			{friendRows(offline)}
		</SettingsView>
	);
};

// ---------- One person ----------

export const FriendProfileView = ({userId, name, onOpen, onBack, onSelectItem}) => {
	const {friends, refreshSocial} = useAchievements();
	const {problem, busy, write} = useWrite();
	const [profile, setProfile] = useState(undefined);
	const [blocked, setBlocked] = useState(null);
	const [confirm, setConfirm] = useState(null);

	useEffect(() => {
		let cancelled = false;
		Promise.all([achievementsApi.fetchPublicProfile(userId), achievementsApi.fetchBlocked()]).then(([loaded, blockedIds]) => {
			if (cancelled) return;
			setProfile(loaded);
			setBlocked(blockedIds.some((id) => sameUserId(id, userId)));
		});
		return () => {
			cancelled = true;
		};
	}, [userId]);

	const friend = friends?.friends.find((entry) => sameUserId(entry.userId, userId)) || null;
	const simpleMode = Boolean(friends?.simpleMode);
	const pending = Boolean(friends?.isPending(userId));
	const playing = friend?.online ? friend.nowPlaying : null;
	const shownName = profile?.userName || friend?.userName || name;

	const message = async () => {
		const conversationId = await achievementsApi.openDirectChat(userId);
		if (conversationId) onOpen('chat', 'friend-profile-message', {conversationId, name: shownName, isGroup: false});
	};
	const request = async () => {
		const result = await write(() => achievementsApi.sendFriendRequest(userId));
		if (result.ok) refreshSocial();
	};
	const remove = async () => {
		setConfirm(null);
		const result = await write(() => achievementsApi.removeFriend(userId));
		if (result.ok) {
			await refreshSocial();
			onBack();
		}
	};
	const toggleBlock = async () => {
		setConfirm(null);
		const result = await write(() => achievementsApi.setBlocked(userId, !blocked));
		if (result.ok) setBlocked(!blocked);
	};

	return (
		<SettingsView spotlightId="friend-profile-view">
			<div className={css.profileHeader}>
				<Avatar name={shownName} online={friend ? friend.online : null} />
				<div className={css.profileName}>{shownName}</div>
				{profile?.customTitle && <div className={css.profileTitle}>{profile.customTitle}</div>}
				{friend && <div className={css.profileCaption}>{friendCaption(friend)}</div>}
			</div>
			{profile === undefined && <Message>{$L('Loading...')}</Message>}
			{profile === null && <Message>{$L('{name} keeps their profile private.').replace('{name}', shownName)}</Message>}
			{profile && (
				<div className={css.stats}>
					<div className={css.stat}>{$L('{unlocked} of {total} badges').replace('{unlocked}', String(profile.unlocked)).replace('{total}', String(profile.total))}</div>
					<div className={css.stat}>{$L('{score} points').replace('{score}', String(profile.score))}</div>
					<div className={css.stat}>{$L('Best streak: {count} days').replace('{count}', String(profile.bestWatchStreak))}</div>
				</div>
			)}
			{profile?.equipped.length > 0 && <Showcase badges={profile.equipped} />}
			{confirm === 'remove' && (
				<ConfirmBox
					message={$L('Remove {name} from your friends? You can add them again later.').replace('{name}', shownName)}
					confirmLabel={$L('Remove friend')}
					onConfirm={remove}
					onCancel={() => setConfirm(null)}
				/>
			)}
			{confirm === 'block' && (
				<ConfirmBox
					message={(blocked ? $L('Unblock {name}?') : $L('Block {name}? Neither of you will be able to message the other directly. Group chats you share stay open.')).replace('{name}', shownName)}
					confirmLabel={blocked ? $L('Unblock') : $L('Block')}
					onConfirm={toggleBlock}
					onCancel={() => setConfirm(null)}
				/>
			)}
			{problem && <Message>{problem}</Message>}
			{!confirm && !busy && (
				<>
					{friend && !blocked && (
						<NavRow id="friend-profile-message" title={$L('Send message')} icon="forum" onClick={message} />
					)}
					{playing && (
						<NavRow id="friend-profile-open" title={$L('Open {title}').replace('{title}', mediaTitle(playing))} icon="play_arrow" onClick={() => onSelectItem({Id: playing.id, Name: playing.name})} />
					)}
					{!simpleMode && friend && <NavRow id="friend-profile-remove" title={$L('Remove friend')} icon="group_work" onClick={() => setConfirm('remove')} />}
					{!simpleMode && !friend && !pending && !blocked && (
						<NavRow id="friend-profile-request" title={$L('Add as friend')} icon="person" onClick={request} />
					)}
					{blocked !== null && (
						<NavRow id="friend-profile-block" title={blocked ? $L('Unblock') : $L('Block')} icon="gpp_maybe" onClick={() => setConfirm('block')} />
					)}
				</>
			)}
		</SettingsView>
	);
};

// ---------- Requests ----------

export const RequestsView = () => {
	const {friends, refreshSocial} = useAchievements();
	const {problem, write} = useWrite();
	const [cancelling, setCancelling] = useState(null);

	const act = async (call) => {
		const result = await write(call);
		if (result.ok) refreshSocial();
	};
	const incoming = friends?.incoming || [];
	const outgoing = friends?.outgoing || [];

	return (
		<SettingsView spotlightId="friends-requests-view" title={$L('Friend requests')}>
			{problem && <Message>{problem}</Message>}
			{incoming.length === 0 && outgoing.length === 0 && <Message>{$L('No friend requests.')}</Message>}
			{incoming.length > 0 && <SectionTitle>{$L('Waiting for you')}</SectionTitle>}
			{incoming.map((user) => (
				<div key={user.userId} className={css.requestRow}>
					<PersonRow name={user.userName} caption={$L('{name} wants to be friends').replace('{name}', user.userName)} trailing={null} spotlightId={`request-${user.userId}`} />
					<div className={settingsCss.actionBarInline}>
						<ActionButton label={$L('Decline')} spotlightId={`request-${user.userId}-decline`} onClick={() => act(() => achievementsApi.removeFriend(user.userId))} />
						<ActionButton label={$L('Accept')} spotlightId={`request-${user.userId}-accept`} strong onClick={() => act(() => achievementsApi.acceptFriendRequest(user.userId))} />
					</div>
				</div>
			))}
			{outgoing.length > 0 && <SectionTitle>{$L('Sent by you')}</SectionTitle>}
			{outgoing.map((user) => (
				<div key={user.userId}>
					<PersonRow
						name={user.userName}
						caption={$L('Cancel request')}
						spotlightId={`request-${user.userId}`}
						onClick={() => setCancelling(user)}
					/>
					{cancelling?.userId === user.userId && (
						<ConfirmBox
							message={$L('Take back the request you sent to {name}?').replace('{name}', user.userName)}
							confirmLabel={$L('Cancel request')}
							onConfirm={() => {
								setCancelling(null);
								act(() => achievementsApi.removeFriend(user.userId));
							}}
							onCancel={() => setCancelling(null)}
						/>
					)}
				</div>
			))}
		</SettingsView>
	);
};

// ---------- Find people ----------

export const FindPeopleView = () => {
	const {user} = useAuth();
	const {friends, refreshSocial} = useAchievements();
	const {problem, write} = useWrite();
	const [people, setPeople] = useState(null);
	const [query, setQuery] = useState('');
	const [sent, setSent] = useState(null);

	useEffect(() => {
		let cancelled = false;
		achievementsApi.fetchServerUsers().then((list) => {
			if (!cancelled) setPeople(list.filter((person) => !sameUserId(person.userId, user?.Id)));
		});
		return () => {
			cancelled = true;
		};
	}, [user?.Id]);

	const matches = useMemo(() => {
		const needle = query.trim().toLowerCase();
		return (people || []).filter((person) => !needle || person.userName.toLowerCase().includes(needle));
	}, [people, query]);

	const add = async (person) => {
		const result = await write(() => achievementsApi.sendFriendRequest(person.userId));
		if (!result.ok) return;
		setSent($L('Request sent to {name}').replace('{name}', person.userName));
		refreshSocial();
	};

	const stateOf = (person) => {
		if (friends?.isFriend(person.userId)) return $L('Friends');
		if (friends?.isPending(person.userId)) return $L('Request sent to {name}').replace('{name}', person.userName);
		return null;
	};

	return (
		<SettingsView spotlightId="friends-add-view" title={$L('Add friends')}>
			<div className={settingsCss.inputGroup}>
				<SpottableInput
					className={settingsCss.input}
					type="text"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder={$L('Search people')}
					spotlightId="friends-search-input"
				/>
			</div>
			{(sent || problem) && <Message>{problem || sent}</Message>}
			{people === null && <Message>{$L('Loading...')}</Message>}
			{people !== null && matches.length === 0 && <Message>{$L('No one matches that name.')}</Message>}
			{matches.map((person) => {
				const state = stateOf(person);
				return (
					<PersonRow
						key={person.userId}
						spotlightId={`person-${person.userId}`}
						name={person.userName}
						caption={state || $L('Add as friend')}
						onClick={state ? null : () => add(person)}
					/>
				);
			})}
		</SettingsView>
	);
};

// ---------- Privacy ----------

export const PrivacyView = () => {
	const {settings, updateSetting} = useSettings();
	const {setMessageNotifications, displayNameFor} = useAchievements();
	const {problem, write, setProblem} = useWrite();
	const [privacy, setPrivacy] = useState(undefined);
	const [blocked, setBlocked] = useState([]);
	const [unblocking, setUnblocking] = useState(null);

	const load = useCallback(() => {
		setProblem(null);
		Promise.all([achievementsApi.fetchSocialPrivacy(), achievementsApi.fetchBlocked()]).then(([loaded, ids]) => {
			setPrivacy(loaded);
			setBlocked(ids);
		});
	}, [setProblem]);
	useEffect(load, [load]);

	const flip = async (key) => {
		const before = privacy;
		const next = {...before, [key]: !before[key]};
		setPrivacy(next);
		if (await achievementsApi.saveSocialPrivacy(next)) {
			if (key === 'messageNotifications') setMessageNotifications(next.messageNotifications);
			return;
		}
		setPrivacy(before);
		setProblem($L('Could not save your settings.'));
	};

	const unblock = async (userId) => {
		setUnblocking(null);
		const result = await write(() => achievementsApi.setBlocked(userId, false));
		if (result.ok) setBlocked((list) => list.filter((id) => id !== userId));
	};

	const rows = [
		['appearOffline', $L('Appear offline'), $L('Friends always see you as offline'), 'visibility_off'],
		['hideNowPlaying', $L("Hide what I'm watching"), $L("Friends still see you online, but not what's playing"), 'hide'],
		['hideLastWatched', $L('Hide my last watched'), $L("Friends won't see what you watched last while you're offline"), 'history'],
		['messageNotifications', $L('Message notifications'), $L('Show a banner when a friend messages you'), 'notifications_active']
	];

	return (
		<SettingsView spotlightId="friends-privacy-view" title={$L('Privacy')}>
			{privacy === undefined && <Message>{$L('Loading...')}</Message>}
			{privacy === null && <LoadFailed message={LOAD_FAILED()} spotlightId="friends-privacy-retry" onRetry={load} />}
			{privacy && rows.map(([key, title, desc, icon]) => (
				<ToggleRow key={key} settingKey={`friends-${key}`} title={title} desc={desc} icon={icon} checked={privacy[key]} onToggle={() => flip(key)} />
			))}
			<ToggleRow
				settingKey="muteChatBannersDuringPlayback"
				title={$L('Mute during playback')}
				desc={$L('No message banners while a video or game is playing')}
				icon="pause_circle"
				checked={settings.muteChatBannersDuringPlayback !== false}
				onToggle={() => updateSetting('muteChatBannersDuringPlayback', settings.muteChatBannersDuringPlayback === false)}
			/>
			{problem && <Message>{problem}</Message>}
			{blocked.length > 0 && <SectionTitle>{$L('Blocked users')}</SectionTitle>}
			{blocked.map((userId) => {
				const blockedName = displayNameFor(userId) || userId;
				return (
					<div key={userId}>
						<PersonRow name={blockedName} caption={$L('Unblock')} spotlightId={`blocked-${userId}`} onClick={() => setUnblocking(userId)} />
						{unblocking === userId && (
							<ConfirmBox
								message={$L('Unblock {name}?').replace('{name}', blockedName)}
								confirmLabel={$L('Unblock')}
								onConfirm={() => unblock(userId)}
								onCancel={() => setUnblocking(null)}
							/>
						)}
					</div>
				);
			})}
		</SettingsView>
	);
};

// ---------- Messages ----------

const threadPreview = (thread) => {
	const text = threadIsPhoto(thread) ? $L('Photo') : thread.lastMessage;
	return thread.lastFromMe ? $L('You: {text}').replace('{text}', text) : text;
};

export const MessagesView = ({onOpen}) => {
	const {threads, refreshSocial} = useAchievements();
	useEffect(() => {
		refreshSocial();
	}, [refreshSocial]);

	return (
		<SettingsView spotlightId="friends-messages-view" title={$L('Messages')}>
			<NavRow id="chat-new" title={$L('New message')} desc={$L('Start a chat with a friend')} icon="forum" onClick={() => onOpen('chatPick', 'setting-chat-new')} />
			<NavRow id="chat-new-group" title={$L('New group')} desc={$L('Chat with several friends at once')} icon="groups" onClick={() => onOpen('chatNewGroup', 'setting-chat-new-group')} />
			{threads.length === 0 && <Message>{$L('No messages yet.')}</Message>}
			{threads.map((thread) => (
				<PersonRow
					key={thread.conversationId}
					spotlightId={`thread-${thread.conversationId}`}
					name={thread.name}
					caption={threadPreview(thread)}
					trailing={thread.unreadCount > 0 ? <div className={css.unread}>{thread.unreadCount}</div> : <div className={settingsCss.listItemTrailing}>{renderChevron()}</div>}
					onClick={() => onOpen('chat', `thread-${thread.conversationId}`, {conversationId: thread.conversationId, name: thread.name, isGroup: thread.isGroup})}
				/>
			))}
		</SettingsView>
	);
};

// Picks the friend a new direct chat goes to.
export const PickFriendView = ({onOpen}) => {
	const {friends} = useAchievements();
	const list = friends?.friends || [];
	const start = async (friend) => {
		const conversationId = await achievementsApi.openDirectChat(friend.userId);
		if (conversationId) onOpen('chat', `pick-${friend.userId}`, {conversationId, name: friend.userName, isGroup: false});
	};
	return (
		<SettingsView spotlightId="chat-pick-view" title={$L('New message')}>
			{list.length === 0 && <Message>{$L('No friends yet. Add people from this server to see them here.')}</Message>}
			{list.map((friend) => (
				<PersonRow key={friend.userId} spotlightId={`pick-${friend.userId}`} name={friend.userName} caption={friendCaption(friend)} online={friend.online} onClick={() => start(friend)} />
			))}
		</SettingsView>
	);
};

// Picks the friends a new group starts with. The plugin wants at least two.
export const NewGroupView = ({onOpen, onBack}) => {
	const {friends, refreshSocial} = useAchievements();
	const {problem, busy, write} = useWrite();
	const [title, setTitle] = useState('');
	const [picked, setPicked] = useState([]);
	const list = friends?.friends || [];

	const toggle = (userId) => setPicked((ids) => (ids.includes(userId) ? ids.filter((id) => id !== userId) : [...ids, userId]));
	const create = async () => {
		const result = await write(() => achievementsApi.createGroup(title.trim(), picked));
		if (!result.ok || !result.value) return;
		await refreshSocial();
		onBack();
		onOpen('chat', 'setting-chat-new-group', {conversationId: result.value.id, name: result.value.title || $L('New group'), isGroup: true});
	};

	return (
		<SettingsView spotlightId="chat-new-group-view" title={$L('New group')}>
			<div className={settingsCss.inputGroup}>
				<label>{$L('Group name')}</label>
				<SpottableInput className={settingsCss.input} type="text" value={title} onChange={(e) => setTitle(e.target.value)} spotlightId="chat-group-name" />
			</div>
			<div className={settingsCss.viewDescription}>{$L('Pick at least two friends')}</div>
			{list.map((friend) => (
				<PersonRow
					key={friend.userId}
					spotlightId={`group-pick-${friend.userId}`}
					name={friend.userName}
					online={friend.online}
					trailing={<div className={settingsCss.listItemTrailing}>{renderToggle(picked.includes(friend.userId))}</div>}
					onClick={() => toggle(friend.userId)}
				/>
			))}
			{problem && <Message>{problem}</Message>}
			{picked.length >= 2 && !busy && (
				<div className={settingsCss.actionBar}>
					<ActionButton label={$L('Create group')} spotlightId="chat-group-create" strong onClick={create} />
				</div>
			)}
		</SettingsView>
	);
};

// ---------- One chat ----------

const Attachment = ({attachmentId}) => {
	const [url, setUrl] = useState(null);
	useEffect(() => {
		let current = null;
		achievementsApi.fetchAttachment(attachmentId).then((loaded) => {
			current = loaded;
			setUrl(loaded);
		});
		return () => {
			if (current) URL.revokeObjectURL(current);
		};
	}, [attachmentId]);
	return url ? <img className={css.attachment} src={url} alt="" /> : <div className={css.attachmentPending}>{$L('Photo')}</div>;
};

export const ChatView = ({conversationId, name, isGroup, onOpen}) => {
	const {user} = useAuth();
	const {refreshSocial, setOpenConversation, displayNameFor} = useAchievements();
	const {problem, busy, write, setProblem} = useWrite();
	const [messages, setMessages] = useState(null);
	const [text, setText] = useState('');
	const [editing, setEditing] = useState(null);
	const [options, setOptions] = useState(null);
	const [confirmDelete, setConfirmDelete] = useState(null);
	const listRef = useRef(null);

	const load = useCallback(async () => {
		const loaded = await achievementsApi.fetchMessages(conversationId);
		if (loaded) setMessages(loaded);
		else setMessages((current) => current || []);
	}, [conversationId]);

	// Reading the chat marks it read, so the banner for it stops and the unread count follows.
	useEffect(() => {
		setOpenConversation(conversationId);
		load().then(refreshSocial);
		const timer = setInterval(() => {
			if (!document.hidden) load();
		}, CHAT_POLL_MS);
		return () => {
			clearInterval(timer);
			setOpenConversation(null);
		};
	}, [conversationId, load, refreshSocial, setOpenConversation]);

	useEffect(() => {
		const node = listRef.current;
		if (node) node.scrollTop = node.scrollHeight;
	}, [messages]);

	const send = async () => {
		const body = text.trim();
		if (!body) return;
		const result = editing
			? await write(() => achievementsApi.editMessage(editing.id, body))
			: await write(() => achievementsApi.sendMessage(conversationId, body));
		if (!result.ok) return;
		setText('');
		setEditing(null);
		await load();
		refreshSocial();
		Spotlight.focus('chat-input');
	};

	const startEdit = (message) => {
		setOptions(null);
		setEditing(message);
		setText(message.text);
		Spotlight.focus('chat-input');
	};
	const remove = async (message) => {
		setConfirmDelete(null);
		setOptions(null);
		const result = await write(() => achievementsApi.deleteMessage(message.id));
		if (result.ok) load();
	};

	const mine = (message) => sameUserId(message.fromUserId, user?.Id);
	const lastMine = messages ? [...messages].reverse().find(mine) : null;

	return (
		<SettingsView spotlightId="chat-view" title={name}>
			{isGroup && <NavRow id="chat-group-info" title={$L('Group info')} icon="groups" onClick={() => onOpen('chatGroupInfo', 'setting-chat-group-info', {conversationId, name})} />}
			<div className={css.messages} ref={listRef}>
				{messages === null && <Message>{$L('Loading...')}</Message>}
				{messages?.length === 0 && <Message>{$L('No messages yet.')}</Message>}
				{messages?.map((message) => {
					const own = mine(message);
					return (
						<div key={message.id} className={`${css.bubbleRow} ${own ? css.bubbleRowMine : ''}`}>
							<SpottableDiv
								className={`${css.bubble} ${own ? css.bubbleMine : ''}`}
								spotlightId={`chat-message-${message.id}`}
								onClick={own ? () => setOptions(options?.id === message.id ? null : message) : null}
							>
								{isGroup && !own && <div className={css.sender}>{message.fromUserName || displayNameFor(message.fromUserId) || ''}</div>}
								{message.attachmentId && <Attachment attachmentId={message.attachmentId} />}
								{message.text && <div className={css.bubbleText}>{message.text}</div>}
								<div className={css.bubbleMeta}>
									{message.sentAt && relativeTimeLabel(message.sentAt)}
									{message.editedAt && ` · ${$L('edited')}`}
									{own && message === lastMine && ` · ${message.isRead ? $L('Seen') : $L('Sent')}`}
								</div>
							</SpottableDiv>
							{options?.id === message.id && !confirmDelete && (
								<div className={settingsCss.actionBarInline}>
									<ActionButton label={$L('Edit')} spotlightId="chat-message-edit" onClick={() => startEdit(message)} />
									<ActionButton label={$L('Delete')} spotlightId="chat-message-delete" strong onClick={() => setConfirmDelete(message)} />
								</div>
							)}
							{confirmDelete?.id === message.id && (
								<ConfirmBox message={$L('Delete this message for everyone?')} confirmLabel={$L('Delete')} onConfirm={() => remove(message)} onCancel={() => setConfirmDelete(null)} />
							)}
						</div>
					);
				})}
			</div>
			{problem && <Message>{problem}</Message>}
			{editing && <div className={settingsCss.viewDescription}>{$L('Editing message')}</div>}
			<div className={css.composer}>
				<SpottableInput
					className={settingsCss.input}
					type="text"
					value={text}
					onChange={(e) => {
						setText(e.target.value);
						setProblem(null);
					}}
					placeholder={$L('Write a message')}
					spotlightId="chat-input"
				/>
				<ActionButton label={editing ? $L('Save') : $L('Send')} spotlightId="chat-send" strong onClick={busy ? null : send} />
				{editing && <ActionButton label={$L('Cancel')} spotlightId="chat-edit-cancel" onClick={() => {
					setEditing(null);
					setText('');
				}} />}
			</div>
		</SettingsView>
	);
};

// ---------- Group info ----------

export const GroupInfoView = ({conversationId, onOpen, onBack}) => {
	const {user} = useAuth();
	const {friends, refreshSocial, displayNameFor} = useAchievements();
	const {problem, write} = useWrite();
	const [group, setGroup] = useState(undefined);
	const [title, setTitle] = useState('');
	const [confirm, setConfirm] = useState(null);
	const [memberMenu, setMemberMenu] = useState(null);

	const load = useCallback(() => achievementsApi.fetchConversation(conversationId).then((loaded) => {
		setGroup(loaded);
		if (loaded) setTitle(loaded.title || '');
	}), [conversationId]);
	useEffect(() => {
		load();
	}, [load]);

	const me = user?.Id;
	const admin = Boolean(group?.isAdmin(me));
	const act = async (call, after) => {
		const result = await write(call);
		if (result.ok) {
			if (after) after();
			else load();
		}
	};
	const leave = () => {
		setConfirm(null);
		// Out of the group info and the chat it belonged to.
		act(() => achievementsApi.removeGroupMember(conversationId, me), async () => {
			await refreshSocial();
			onBack();
			onBack();
		});
	};
	const clear = () => {
		setConfirm(null);
		act(() => achievementsApi.clearConversation(conversationId), () => {
			refreshSocial();
			onBack();
		});
	};
	const rename = () => act(() => achievementsApi.renameGroup(conversationId, title.trim()), () => {
		refreshSocial();
		load();
	});

	if (group === undefined) return <SettingsView spotlightId="chat-group-view"><Message>{$L('Loading...')}</Message></SettingsView>;
	if (group === null) return <SettingsView spotlightId="chat-group-view"><LoadFailed message={LOAD_FAILED()} spotlightId="chat-group-retry" onRetry={load} /></SettingsView>;

	const friendIds = (friends?.friends || []).map((friend) => friend.userId);
	const canAdd = friendIds.some((id) => !group.participantIds.some((member) => sameUserId(member, id)));
	const tagOf = (memberId) => (group.isOwner(memberId) ? $L('Owner') : (group.isAdmin(memberId) ? $L('Admin') : null));

	return (
		<SettingsView spotlightId="chat-group-view" title={$L('Group info')}>
			<div className={settingsCss.inputGroup}>
				<label>{$L('Group name')}</label>
				<SpottableInput className={settingsCss.input} type="text" value={title} onChange={(e) => setTitle(e.target.value)} spotlightId="chat-group-rename" disabled={!admin} />
			</div>
			{admin && title.trim() !== (group.title || '') && (
				<div className={settingsCss.actionBar}>
					<ActionButton label={$L('Save')} spotlightId="chat-group-rename-save" strong onClick={rename} />
				</div>
			)}
			{problem && <Message>{problem}</Message>}
			<SectionTitle>{plural(group.participantIds.length, $L('1 member'), $L('{count} members'))}</SectionTitle>
			{group.participantIds.map((memberId) => {
				const self = sameUserId(memberId, me);
				const memberName = self ? $L('You') : (displayNameFor(memberId) || memberId);
				const canManage = admin && !self && !group.isOwner(memberId);
				return (
					<div key={memberId}>
						<PersonRow
							spotlightId={`member-${memberId}`}
							name={memberName}
							caption={tagOf(memberId)}
							trailing={canManage ? undefined : null}
							onClick={canManage ? () => setMemberMenu(memberMenu === memberId ? null : memberId) : null}
						/>
						{memberMenu === memberId && (
							<div className={settingsCss.actionBarInline}>
								<ActionButton
									label={group.isAdmin(memberId) ? $L('Remove admin') : $L('Make admin')}
									spotlightId={`member-${memberId}-admin`}
									onClick={() => {
										setMemberMenu(null);
										act(() => achievementsApi.setGroupAdmin(conversationId, memberId, !group.isAdmin(memberId)));
									}}
								/>
								<ActionButton
									label={$L('Remove from group')}
									spotlightId={`member-${memberId}-remove`}
									strong
									onClick={() => {
										setMemberMenu(null);
										act(() => achievementsApi.removeGroupMember(conversationId, memberId));
									}}
								/>
							</div>
						)}
					</div>
				);
			})}
			{admin && (
				<NavRow id="chat-group-add" title={$L('Add people')} desc={canAdd ? null : $L('No one left to add.')} icon="person" onClick={canAdd ? () => onOpen('chatAddMembers', 'setting-chat-group-add', {conversationId}) : null} />
			)}
			{admin && <NavRow id="chat-group-clear" title={$L('Clear conversation')} icon="content_cut" onClick={() => setConfirm('clear')} />}
			<NavRow id="chat-group-leave" title={$L('Leave group')} icon="exit_to_app" onClick={() => setConfirm('leave')} />
			{confirm === 'leave' && (
				<ConfirmBox message={$L('Leave this group? Someone will have to add you back to rejoin.')} confirmLabel={$L('Leave group')} onConfirm={leave} onCancel={() => setConfirm(null)} />
			)}
			{confirm === 'clear' && (
				<ConfirmBox message={$L('Delete every message in this chat for everyone in it?')} confirmLabel={$L('Clear conversation')} onConfirm={clear} onCancel={() => setConfirm(null)} />
			)}
		</SettingsView>
	);
};

// Friends not yet in the group, each a press away from joining it.
export const AddMembersView = ({conversationId, onBack}) => {
	const {friends} = useAchievements();
	const {problem, write} = useWrite();
	const [group, setGroup] = useState(null);
	useEffect(() => {
		achievementsApi.fetchConversation(conversationId).then(setGroup);
	}, [conversationId]);

	const candidates = (friends?.friends || []).filter((friend) =>
		group && !group.participantIds.some((member) => sameUserId(member, friend.userId)));
	const add = async (friend) => {
		const result = await write(() => achievementsApi.addGroupMember(conversationId, friend.userId));
		if (result.ok) onBack();
	};

	return (
		<SettingsView spotlightId="chat-add-members-view" title={$L('Add people')}>
			{problem && <Message>{problem}</Message>}
			{group && candidates.length === 0 && <Message>{$L('No one left to add.')}</Message>}
			{candidates.map((friend) => (
				<PersonRow key={friend.userId} spotlightId={`add-member-${friend.userId}`} name={friend.userName} online={friend.online} onClick={() => add(friend)} />
			))}
		</SettingsView>
	);
};
