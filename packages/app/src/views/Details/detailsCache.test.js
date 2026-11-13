import * as userDataSync from '../../services/userDataSync';
import * as parentalControls from '../../services/parentalControls';
import {clearDetailsCache, detailsKey, isCacheableType, readDetails, saveDetails, userDataStamp} from './detailsCache';

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

	it('drops everything when anything played, watched or favorited changes', () => {
		saveDetails(key, snapshot(record()));
		userDataSync.publish('someEpisode', {Played: true, PlaybackPositionTicks: 0});
		expect(readDetails(key, null)).toBeNull();
	});

	it('drops a title whose own user data moved after it was kept', () => {
		saveDetails(key, snapshot(record()));
		userDataSync.publish('m1', {PlaybackPositionTicks: 5000});
		expect(readDetails(key, null)).toBeNull();
	});

	it('lets a screen go after a few minutes', () => {
		saveDetails(key, snapshot(record()));
		jest.advanceTimersByTime(3 * 60 * 1000 - 1000);
		expect(readDetails(key, null)).not.toBeNull();
		jest.advanceTimersByTime(2000);
		expect(readDetails(key, null)).toBeNull();
	});

	it('is emptied when Home is refreshed or its rows change', () => {
		saveDetails(key, snapshot(record()));
		window.dispatchEvent(new CustomEvent('moonfin:browseRefresh'));
		expect(readDetails(key, null)).toBeNull();
		saveDetails(key, snapshot(record()));
		window.dispatchEvent(new CustomEvent('moonfin:homeRowsChanged'));
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

	it('holds a dozen screens and lets the oldest go', () => {
		for (let i = 0; i < 13; i++) saveDetails(`k${i}`, snapshot(record({Id: `m${i}`})));
		expect(readDetails('k0', null)).toBeNull();
		expect(readDetails('k12', null)).not.toBeNull();
	});

	it('reads user data laid over by what the client knows is newer', () => {
		const stamp = userDataStamp(record());
		userDataSync.publish('m1', {Played: true});
		expect(userDataStamp(record())).not.toBe(stamp);
	});
});
