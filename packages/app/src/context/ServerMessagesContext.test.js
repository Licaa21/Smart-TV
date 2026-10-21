import {renderHook, act, waitFor} from '@testing-library/react';

import * as seerrApi from '../services/seerrApi';
import * as storage from '../services/storage';
import {useAuth} from './AuthContext';
import {useSeerr} from './SeerrContext';
import {ServerMessagesProvider, useServerMessages} from './ServerMessagesContext';

// The provider is JSX, and the CLI ships a second copy of React whose automatic
// runtime disagrees with the one under test. Routing the runtime through the
// copy the test sees keeps the two from meeting.
jest.mock('react/jsx-dev-runtime', () => {
	const React = require('react');
	return {jsxDEV: (type, props, key) => React.createElement(type, key === undefined ? props : {...props, key})};
});
jest.mock('../services/seerrApi', () => ({getMoonfinMessages: jest.fn()}));
jest.mock('../services/storage', () => ({getFromStorage: jest.fn(), saveToStorage: jest.fn()}));
jest.mock('./AuthContext', () => ({useAuth: jest.fn()}));
jest.mock('./SeerrContext', () => ({useSeerr: jest.fn()}));
jest.mock('../utils/homeReady', () => ({afterHomeReady: () => Promise.resolve()}));

const message = (id, over = {}) => ({id, title: `Title ${id}`, body: `Body ${id}`, ...over});

// Stands in for the device: what the plugin answers and what the TV has kept.
let server;
let kept;
let auth;
let seerr;

const signedIn = (userId = 'user1') => ({
	serverUrl: 'http://plugin.test',
	accessToken: 'token',
	activeServerInfo: {serverId: 'srv', userId},
	user: {Id: userId}
});

const mount = () => renderHook(() => useServerMessages(), {wrapper: ServerMessagesProvider});

const settled = async (result) => {
	await waitFor(() => expect(seerrApi.getMoonfinMessages).toHaveBeenCalled());
	await waitFor(() => expect(result.current.messages.length).toBeGreaterThan(0));
};

describe('ServerMessagesProvider', () => {
	beforeEach(() => {
		server = {items: [], fail: false};
		kept = {};
		auth = signedIn();
		seerr = {pluginInfo: {messagesSupported: true}, messagesSignal: 0};

		// The suite resets mocks before every test, so the answers are set here rather
		// than in the module factories.
		seerrApi.getMoonfinMessages.mockImplementation(() => (server.fail
			? Promise.reject(new Error('500'))
			: Promise.resolve({items: server.items})));
		storage.getFromStorage.mockImplementation((key) => Promise.resolve(key in kept ? kept[key] : null));
		storage.saveToStorage.mockImplementation((key, value) => {
			kept[key] = JSON.parse(JSON.stringify(value));
			return Promise.resolve();
		});
		useAuth.mockImplementation(() => auth);
		useSeerr.mockImplementation(() => seerr);
	});

	test('no request is made when the plugin does not support messages', async () => {
		seerr.pluginInfo = {};
		server.items = [message('a')];

		const {result} = mount();
		await waitFor(() => expect(storage.getFromStorage).toHaveBeenCalled());

		expect(seerrApi.getMoonfinMessages).not.toHaveBeenCalled();
		expect(result.current.messages).toEqual([]);
	});

	test('the cached list shows before the server answers, and without it', async () => {
		kept.serverMessages_srv_user1 = [message('cached')];
		seerr.pluginInfo = {};

		const {result} = mount();

		await waitFor(() => expect(result.current.messages.map((m) => m.id)).toEqual(['cached']));
	});

	test('messages keep the order the server sent them', async () => {
		server.items = [message('c'), message('a'), message('b')];

		const {result} = mount();
		await settled(result);

		expect(result.current.messages.map((m) => m.id)).toEqual(['c', 'a', 'b']);
		expect(kept.serverMessages_srv_user1.map((m) => m.id)).toEqual(['c', 'a', 'b']);
	});

	test('the unread count drops as messages are read', async () => {
		server.items = [message('a'), message('b')];
		const {result} = mount();
		await settled(result);

		expect(result.current.unreadCount).toBe(2);

		act(() => result.current.markRead('a'));
		expect(result.current.unreadCount).toBe(1);
		expect(result.current.isRead('a')).toBe(true);

		act(() => result.current.markRead('b'));
		expect(result.current.unreadCount).toBe(0);
	});

	test('read state survives a reload', async () => {
		server.items = [message('a'), message('b')];
		const {result: before, unmount} = mount();
		await settled(before);
		act(() => before.current.markRead('a'));
		unmount();

		const {result} = mount();
		await waitFor(() => expect(result.current.messages).toHaveLength(2));

		expect(result.current.isRead('a')).toBe(true);
		expect(result.current.isRead('b')).toBe(false);
		expect(result.current.unreadCount).toBe(1);
	});

	test('read ids for deleted messages are dropped from what is kept', async () => {
		server.items = [message('a'), message('b')];
		const {result} = mount();
		await settled(result);
		act(() => result.current.markAllRead());
		expect(kept.serverMessagesRead_srv_user1).toEqual(['a', 'b']);

		// The admin deletes both and posts a new one.
		server.items = [message('c')];
		seerr = {...seerr, messagesSignal: 1};
		const {result: again} = mount();
		await waitFor(() => expect(again.current.messages.map((m) => m.id)).toEqual(['c']));

		expect(again.current.unreadCount).toBe(1);
		await waitFor(() => expect(kept.serverMessagesRead_srv_user1).toEqual([]));
	});

	test('only popup messages are pending, and marking them clears them', async () => {
		server.items = [message('quiet', {delivery: 'inbox'}), message('loud', {delivery: 'popup'})];
		const {result} = mount();
		await settled(result);

		expect(result.current.pendingPopups.map((m) => m.id)).toEqual(['loud']);

		act(() => result.current.markPopupsRead());

		expect(result.current.pendingPopups).toEqual([]);
		expect(result.current.isRead('loud')).toBe(true);
		expect(result.current.isRead('quiet')).toBe(false);
	});

	test('a failed request keeps the messages already loaded', async () => {
		server.items = [message('a')];
		const {result, rerender} = mount();
		await settled(result);

		server.fail = true;
		seerr = {...seerr, messagesSignal: 1};
		rerender();
		await waitFor(() => expect(seerrApi.getMoonfinMessages).toHaveBeenCalledTimes(2));

		expect(result.current.messages).toHaveLength(1);
	});

	test('a change signal from the server asks for the list again', async () => {
		server.items = [message('a')];
		const {result, rerender} = mount();
		await settled(result);

		server.items = [message('a'), message('b')];
		seerr = {...seerr, messagesSignal: 1};
		rerender();

		await waitFor(() => expect(result.current.messages).toHaveLength(2));
	});

	test('another user sees their own list, and signing out empties it', async () => {
		server.items = [message('a')];
		const {result, rerender} = mount();
		await settled(result);
		act(() => result.current.markRead('a'));

		server.items = [message('z')];
		auth = signedIn('user2');
		rerender();
		await waitFor(() => expect(result.current.messages.map((m) => m.id)).toEqual(['z']));
		expect(result.current.isRead('a')).toBe(false);
		expect(result.current.unreadCount).toBe(1);

		auth = {serverUrl: null, accessToken: null, activeServerInfo: null, user: null};
		rerender();
		await waitFor(() => expect(result.current.messages).toEqual([]));
		expect(result.current.unreadCount).toBe(0);
	});
});
