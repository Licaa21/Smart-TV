import * as userDataSync from '../../services/userDataSync';
import * as parentalControls from '../../services/parentalControls';
import {clearDetailsCache, detailsKey, isCacheableType, keptAge, loadKeptScreens, onDetailsKept, readDetails, saveDetails, userDataStamp} from './detailsCache';

jest.mock('./detailsStore', () => ({
	loadScreens: jest.fn(() => Promise.resolve([])),
	putScreen: jest.fn(() => Promise.resolve(true)),
	deleteScreen: jest.fn(() => Promise.resolve(true)),
	clearScreens: jest.fn(() => Promise.resolve(true))
}));
const store = require('./detailsStore');

const record = (overrides = {}) => ({Id: 'm1', Type: 'Movie', Name: 'Film', UserData: {Played: false, PlaybackPositionTicks: 0, IsFavorite: false}, ...overrides});
const snapshot = (item) => ({item, seasons: [], episodes: [], similar: [], extras: [], cast: [], nextUp: [], parentCollections: [], episodeRatings: {}});
const settings = {detailScreenStyle: 'v1', recommendationSystemSource: 'local', uiLanguage: 'ro'};
const key = detailsKey('http://server', 'u1', 'm1', settings);

describe('the kept details screens', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.setSystemTime(1000000);
		clearDetailsCache();
	});
	afterEach(() => jest.useRealTimers());

	it('hands a title back that nothing has changed on', () => {
		const item = record();
		saveDetails(key, snapshot(item));
		expect(readDetails(key, null)).not.toBeNull();
		expect(readDetails(key, record())).not.toBeNull();
	});

	it('opens normally when the card it was opened from carries other user data', () => {
		saveDetails(key, snapshot(record()));
		// resumed to 10 minutes on another device, or marked watched, or favorited
		expect(readDetails(key, record({UserData: {Played: false, PlaybackPositionTicks: 6000000000, IsFavorite: false}}))).toBeNull();
		expect(readDetails(key, record({UserData: {Played: true, PlaybackPositionTicks: 0, IsFavorite: false}}))).toBeNull();
		expect(readDetails(key, record({UserData: {Played: false, PlaybackPositionTicks: 0, IsFavorite: true}}))).toBeNull();
		// the same title still comes back once the card reads as it did
		expect(readDetails(key, record())).not.toBeNull();
	});

	it('does not mistake a card with fields missing for one that changed', () => {
		saveDetails(key, snapshot(record({UserData: {Played: false, PlaybackPositionTicks: 0, IsFavorite: false, UnplayedItemCount: 3}})));
		// a Home row card has no unplayed count for a series where the full record has one
		expect(readDetails(key, record({UserData: {Played: false}}))).not.toBeNull();
	});

	it('sets a card against the card the screen was kept from, count and all', () => {
		const opened = record({UserData: {Played: false, PlaybackPositionTicks: 0, IsFavorite: false, UnplayedItemCount: 0}});
		saveDetails(key, snapshot(record({UserData: {Played: false, PlaybackPositionTicks: 0, IsFavorite: false, UnplayedItemCount: 3}})), opened);
		expect(readDetails(key, opened)).not.toBeNull();
		// the card now carries a count, so a row was loaded again and something moved
		expect(readDetails(key, record({UserData: {Played: false, PlaybackPositionTicks: 0, IsFavorite: false, UnplayedItemCount: 2}}))).toBeNull();
	});

	it('reads a screen again behind it when anything played, watched or favorited changed elsewhere', () => {
		saveDetails(key, snapshot(record()));
		expect(readDetails(key, null).fresh).toBe(true);
		userDataSync.publish('someEpisode', {Played: true, PlaybackPositionTicks: 0});
		expect(readDetails(key, null)).not.toBeNull();
		expect(readDetails(key, null).fresh).toBe(false);
	});

	it('drops a title whose own user data moved after it was kept', () => {
		saveDetails(key, snapshot(record()));
		userDataSync.publish('m1', {PlaybackPositionTicks: 5000});
		expect(readDetails(key, null)).toBeNull();
	});

	it('keeps a screen for two days, and has it read again behind it after a few minutes', () => {
		saveDetails(key, snapshot(record()));
		jest.advanceTimersByTime(3 * 60 * 1000 - 1000);
		expect(readDetails(key, null).fresh).toBe(true);
		jest.advanceTimersByTime(2000);
		expect(readDetails(key, null).fresh).toBe(false);
		jest.advanceTimersByTime(47 * 60 * 60 * 1000);
		expect(readDetails(key, null)).not.toBeNull();
		jest.advanceTimersByTime(2 * 60 * 60 * 1000);
		expect(readDetails(key, null)).toBeNull();
	});

	it('has every screen read again behind itself when Home is refreshed or its rows change, and throws none away', () => {
		saveDetails(key, snapshot(record()));
		expect(readDetails(key, null).fresh).toBe(true);
		window.dispatchEvent(new CustomEvent('moonfin:browseRefresh'));
		expect(readDetails(key, null)).not.toBeNull();
		expect(readDetails(key, null).fresh).toBe(false);
		saveDetails(key, snapshot(record()));
		expect(readDetails(key, null).fresh).toBe(true);
		window.dispatchEvent(new CustomEvent('moonfin:homeRowsChanged'));
		expect(readDetails(key, null).fresh).toBe(false);
	});

	it('is emptied only when asked to be', () => {
		saveDetails(key, snapshot(record()));
		clearDetailsCache();
		expect(readDetails(key, null)).toBeNull();
		expect(store.clearScreens).toHaveBeenCalled();
	});

	it('does not keep a title of one of several servers, whose items carry that server\'s access token', () => {
		saveDetails(key, snapshot(record({_serverUrl: 'http://other', _serverAccessToken: 'secret'})));
		expect(readDetails(key, null)).toBeNull();
	});

	it('keeps a screen apart per account, server, title and the settings that change its rows', () => {
		saveDetails(key, snapshot(record()));
		expect(readDetails(detailsKey('http://server', 'u2', 'm1', settings), null)).toBeNull();
		expect(readDetails(detailsKey('http://other', 'u1', 'm1', settings), null)).toBeNull();
		expect(readDetails(detailsKey('http://server', 'u1', 'm2', settings), null)).toBeNull();
		expect(readDetails(detailsKey('http://server', 'u1', 'm1', {...settings, detailScreenStyle: 'v4'}), null)).toBeNull();
	});

	it('does not take a screen back that was filtered under other rules', () => {
		saveDetails(key, snapshot(record()));
		expect(readDetails(detailsKey('http://server', 'u1', 'm1', {...settings, kidsModeEnabled: true}), null)).toBeNull();
		const spy = jest.spyOn(parentalControls, 'getBlockedRatings').mockReturnValue(['R']);
		expect(readDetails(detailsKey('http://server', 'u1', 'm1', settings), null)).toBeNull();
		spy.mockRestore();
	});

	it('only keeps titles whose screen is their own record and its rows', () => {
		['Movie', 'Episode', 'Series', 'Season', 'Video'].forEach((type) => expect(isCacheableType({Type: type})).toBe(true));
		['BoxSet', 'Playlist', 'MusicAlbum', 'MusicArtist', 'Person'].forEach((type) => expect(isCacheableType({Type: type})).toBe(false));
		saveDetails('boxset', snapshot(record({Id: 'b1', Type: 'BoxSet'})));
		expect(readDetails('boxset', null)).toBeNull();
	});

	it('holds two dozen screens and lets the one kept longest ago go', () => {
		for (let i = 0; i < 25; i++) {
			jest.advanceTimersByTime(1000);
			saveDetails(`k${i}`, snapshot(record({Id: `m${i}`})));
		}
		expect(readDetails('k0', null)).toBeNull();
		expect(readDetails('k24', null)).not.toBeNull();
		expect(keptAge('k1')).not.toBeNull();
	});

	it('reads user data laid over by what the client knows is newer', () => {
		const stamp = userDataStamp(record());
		userDataSync.publish('m1', {Played: true});
		expect(userDataStamp(record())).not.toBe(stamp);
	});

	it('writes a screen to the store a moment after it is kept', () => {
		store.putScreen.mockClear();
		saveDetails(key, snapshot(record()));
		expect(store.putScreen).not.toHaveBeenCalled();
		jest.advanceTimersByTime(2000);
		expect(store.putScreen).toHaveBeenCalledTimes(1);
		expect(store.putScreen.mock.calls[0][0].key).toBe(key);
		expect(store.putScreen.mock.calls[0][0].v).toBe(1);
	});

	it('takes back what an earlier run kept, leaving out what has aged out or was kept by another build', async () => {
		store.deleteScreen.mockClear();
		store.loadScreens.mockResolvedValueOnce([
			{v: 1, key, at: Date.now() - 60 * 60 * 1000, stamp: userDataStamp(record()), seedStamp: null, snapshot: snapshot(record())},
			{v: 1, key: 'old', at: Date.now() - 3 * 24 * 60 * 60 * 1000, stamp: '', seedStamp: null, snapshot: snapshot(record({Id: 'old'}))},
			{v: 0, key: 'other-build', at: Date.now(), stamp: '', seedStamp: null, snapshot: snapshot(record({Id: 'other-build'}))}
		]);
		await loadKeptScreens();
		const back = readDetails(key, null);
		expect(back).not.toBeNull();
		expect(back.fresh).toBe(false);
		expect(readDetails('old', null)).toBeNull();
		expect(readDetails('other-build', null)).toBeNull();
		expect(store.deleteScreen).toHaveBeenCalledWith('old');
		expect(store.deleteScreen).toHaveBeenCalledWith('other-build');
	});

	it('clears out of the store what it has no room to hold', async () => {
		store.deleteScreen.mockClear();
		store.loadScreens.mockResolvedValueOnce(Array.from({length: 26}, (_, i) => ({
			v: 1, key: 'k' + i, at: Date.now() - i * 1000, stamp: userDataStamp(record({Id: 'k' + i})), seedStamp: null, snapshot: snapshot(record({Id: 'k' + i}))
		})));
		await loadKeptScreens();
		expect(readDetails('k0', null)).not.toBeNull();
		expect(readDetails('k24', null)).toBeNull();
		expect(store.deleteScreen).toHaveBeenCalledWith('k24');
		expect(store.deleteScreen).toHaveBeenCalledWith('k25');
	});

	it('tells the one filling screens in ahead of time when one is kept', () => {
		const heard = jest.fn();
		const stop = onDetailsKept(heard);
		saveDetails(key, snapshot(record()));
		expect(heard).toHaveBeenCalledWith(key);
		stop();
		saveDetails(key, snapshot(record()));
		expect(heard).toHaveBeenCalledTimes(1);
	});
});
