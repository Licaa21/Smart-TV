import {act, renderHook} from '@testing-library/react';

jest.mock('@enact/i18n/$L', () => ({__esModule: true, default: (text) => text}));
jest.mock('../../services/playback', () => ({getNextEpisode: jest.fn(() => Promise.resolve(null))}));
jest.mock('../../services/mdblistApi', () => ({
	fetchTmdbSeasonRatings: jest.fn(), resolveSeriesTmdbId: jest.fn(), isRatingSourceAllowed: () => false
}));
jest.mock('../../services/subtitlePrefs', () => ({
	getItemAudioPref: jest.fn(), getSeriesAudioPref: jest.fn(), syncSeriesTrackChoices: jest.fn(() => Promise.resolve())
}));
jest.mock('../../services/homeRecommendations', () => ({
	canScoreSeedLocally: () => false, getOnlineRecommendations: jest.fn(), getRecommendations: jest.fn(), mergeRecommendations: jest.fn()
}));
jest.mock('../../services/blockedContentGate', () => ({
	isBlocked: () => Promise.resolve(false), isBlockedNow: () => false, observeItem: () => {}
}));
jest.mock('../../services/parentalControls', () => ({
	getActiveParentalFilter: () => ({isActive: false}), withoutBlockedItems: (items) => items,
	getBlockedRatings: () => [], getBlockedSeriesIds: () => []
}));
jest.mock('./parentCollection', () => ({findParentCollections: () => Promise.resolve([])}));

import * as userDataSync from '../../services/userDataSync';
import useDetailsItem from './useDetailsItem';
import {clearDetailsCache} from './detailsCache';

const SERIES = {Id: 'series', Type: 'Series', Name: 'Show'};
const episode = (id, userData = {}) => ({Id: id, Type: 'Episode', SeriesId: 'series', UserData: userData});
const page = (items) => ({Items: items});

// A promise the test settles by hand, for a request that's still out.
const deferred = () => {
	let resolve;
	let reject;
	const promise = new Promise((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return {promise, resolve, reject};
};

const makeApi = (getNextUp) => ({
	getItemForDetail: jest.fn(() => Promise.resolve(SERIES)),
	getSeasons: jest.fn(() => Promise.resolve(page([]))),
	getEpisodes: jest.fn(() => Promise.resolve(page([]))),
	getNextUp: jest.fn(getNextUp),
	getSimilar: jest.fn(() => Promise.resolve(page([]))),
	getSpecialFeatures: jest.fn(() => Promise.resolve([]))
});

const settle = () => act(async () => {
	await new Promise((resolve) => setTimeout(resolve, 0));
});

const SETTINGS = {recommendationSystemSource: 'server', detailScreenStyle: 'v2'};
const identity = (items) => items;

const renderSeries = (api) => renderHook(() => useDetailsItem({
	itemId: 'series',
	initialItem: null,
	effectiveApi: api,
	effectiveServerUrl: 'https://server',
	settings: SETTINGS,
	recommendationsSupported: false,
	seerrEnabled: false,
	tagWithServerInfo: identity,
	skip: false
}));

afterEach(() => {
	act(() => userDataSync.reset());
});

describe('a series Next Up', () => {
	test('is asked for again once an episode is marked played', async () => {
		const answers = [page([episode('e2')]), page([episode('e3')])];
		const api = makeApi(() => Promise.resolve(answers.shift()));
		const {result} = renderSeries(api);
		await settle();
		expect(result.current.nextUp[0].Id).toBe('e2');

		act(() => userDataSync.publish('e2', {Played: true}));
		await settle();

		expect(api.getNextUp).toHaveBeenCalledTimes(2);
		expect(result.current.nextUp[0].Id).toBe('e3');
	});

	test('keeps the shown one when the new request fails', async () => {
		const api = makeApi(() => Promise.resolve(page([episode('e2')])));
		const {result} = renderSeries(api);
		await settle();

		api.getNextUp.mockImplementationOnce(() => Promise.reject(new Error('offline')));
		act(() => userDataSync.publish('e2', {Played: true}));
		await settle();

		expect(result.current.nextUp[0].Id).toBe('e2');
		expect(result.current.nextUp[0].UserData.Played).toBe(true);
	});

	test('takes the newest answer when an older one lands after it', async () => {
		const first = deferred();
		const api = makeApi(() => first.promise);
		const {result} = renderSeries(api);
		await settle();

		api.getNextUp.mockImplementationOnce(() => Promise.resolve(page([episode('e3')])));
		act(() => userDataSync.publish('e1', {Played: true}));
		await settle();
		await act(async () => {
			first.resolve(page([episode('e2')]));
			await first.promise;
		});
		await settle();

		expect(result.current.nextUp[0].Id).toBe('e3');
	});
});

describe('a title opened again', () => {
	beforeEach(() => clearDetailsCache());

	const MOVIE = {Id: 'movie', Type: 'Movie', Name: 'Film', UserData: {Played: false, PlaybackPositionTicks: 0}, People: [{Id: 'p1', Name: 'Actor', Type: 'Actor'}]};
	const movieApi = () => ({
		...makeApi(() => Promise.resolve(page([]))),
		getItemForDetail: jest.fn(() => Promise.resolve(MOVIE)),
		getSimilar: jest.fn(() => Promise.resolve(page([{Id: 'sim1', Type: 'Movie'}])))
	});
	const renderMovie = (api, initialItem = null) => renderHook(() => useDetailsItem({
		itemId: 'movie',
		initialItem,
		effectiveApi: api,
		effectiveServerUrl: 'https://server',
		settings: {...SETTINGS, uiLanguage: 'ro-opened-again'},
		recommendationsSupported: false,
		seerrEnabled: false,
		tagWithServerInfo: identity,
		skip: false
	}));
	const loadAndKeep = async (api, seed) => {
		const view = renderMovie(api, seed);
		await settle();
		// the screen is kept once the rows and the picks are in, a moment after the load
		await act(async () => { await new Promise((resolve) => setTimeout(resolve, 600)); });
		view.unmount();
	};

	test('is drawn whole in the first frame with no request when nothing changed', async () => {
		const api = movieApi();
		await loadAndKeep(api, {...MOVIE});
		expect(api.getItemForDetail).toHaveBeenCalledTimes(1);

		const view = renderMovie(api, {...MOVIE});
		expect(view.result.current.item.Id).toBe('movie');
		expect(view.result.current.isLoading).toBe(false);
		expect(view.result.current.isSeed).toBe(false);
		expect(view.result.current.similar.map((s) => s.Id)).toEqual(['sim1']);
		expect(view.result.current.cast).toHaveLength(1);
		await settle();
		expect(api.getItemForDetail).toHaveBeenCalledTimes(1);
		expect(api.getSimilar).toHaveBeenCalledTimes(1);
	});

	test('is drawn at once and read again behind itself when it was kept a while ago', async () => {
		const api = movieApi();
		await loadAndKeep(api, {...MOVIE});
		const later = Date.now() + 10 * 60 * 1000;
		const clock = jest.spyOn(Date, 'now').mockReturnValue(later);
		const seen = [];
		const view = renderHook(() => {
			const data = useDetailsItem({
				itemId: 'movie', initialItem: {...MOVIE}, effectiveApi: api, effectiveServerUrl: 'https://server',
				settings: {...SETTINGS, uiLanguage: 'ro-opened-again'}, recommendationsSupported: false, seerrEnabled: false,
				tagWithServerInfo: identity, skip: false
			});
			seen.push(data.isSeed);
			return data;
		});
		// whole in the first frame, from the kept screen
		expect(view.result.current.item.Id).toBe('movie');
		expect(view.result.current.isLoading).toBe(false);
		await settle();
		clock.mockRestore();
		// read again, and the screen never went back to showing the row it was opened from
		expect(api.getItemForDetail).toHaveBeenCalledTimes(2);
		expect(seen.every((isSeed) => isSeed === false)).toBe(true);
		expect(view.result.current.item.Id).toBe('movie');
	});

	test('opens the normal way when the card it is opened from has changed', async () => {
		const api = movieApi();
		await loadAndKeep(api, {...MOVIE});

		const resumed = {...MOVIE, UserData: {Played: false, PlaybackPositionTicks: 90000000}};
		const view = renderMovie(api, resumed);
		await settle();
		expect(api.getItemForDetail).toHaveBeenCalledTimes(2);
		expect(view.result.current.item.Id).toBe('movie');
	});

	test('is not kept when a row it asked for failed, so the next open asks again', async () => {
		const api = movieApi();
		api.getSimilar.mockImplementation(() => Promise.reject(new Error('plugin down')));
		await loadAndKeep(api, {...MOVIE});

		renderMovie(api, {...MOVIE});
		await settle();
		expect(api.getItemForDetail).toHaveBeenCalledTimes(2);
	});

	test('opens the normal way once anything played or watched changed in the app', async () => {
		const api = movieApi();
		await loadAndKeep(api, {...MOVIE});

		act(() => userDataSync.publish('some-episode', {Played: true}));
		renderMovie(api, {...MOVIE});
		await settle();
		expect(api.getItemForDetail).toHaveBeenCalledTimes(2);
	});

	test('read again behind itself, drops a next up the series no longer has', async () => {
		const series = {Id: 'show', Type: 'Series', Name: 'Show', UserData: {Played: false}};
		let answers = [page([episode('e2')]), page([])];
		const api = {
			...makeApi(() => Promise.resolve(answers.shift())),
			getItemForDetail: jest.fn(() => Promise.resolve(series))
		};
		const renderShow = () => renderHook(() => useDetailsItem({
			itemId: 'show', initialItem: {...series}, effectiveApi: api, effectiveServerUrl: 'https://server',
			settings: {...SETTINGS, uiLanguage: 'ro-next-up'}, recommendationsSupported: false, seerrEnabled: false,
			tagWithServerInfo: identity, skip: false
		}));
		const {result: openedResult, unmount: closeOpened} = renderShow();
		await settle();
		await act(async () => { await new Promise((resolve) => setTimeout(resolve, 600)); });
		expect(openedResult.current.nextUp[0].Id).toBe('e2');
		closeOpened();

		const clock = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 10 * 60 * 1000);
		const view = renderShow();
		expect(view.result.current.nextUp[0].Id).toBe('e2');
		await settle();
		clock.mockRestore();
		expect(view.result.current.nextUp).toEqual([]);
		answers = [];
	});

	test('read again behind itself, lets go of a title the server no longer has', async () => {
		const api = movieApi();
		await loadAndKeep(api, {...MOVIE});
		const clock = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 10 * 60 * 1000);
		api.getItemForDetail.mockImplementation(() => Promise.reject(Object.assign(new Error('Not found'), {status: 404})));
		const view = renderMovie(api, {...MOVIE});
		expect(view.result.current.item.Id).toBe('movie');
		await settle();
		clock.mockRestore();
		view.unmount();
		// the kept screen was dropped, so the next open goes to the server
		api.getItemForDetail.mockImplementation(() => Promise.resolve(MOVIE));
		const count = api.getItemForDetail.mock.calls.length;
		renderMovie(api, {...MOVIE});
		await settle();
		expect(api.getItemForDetail.mock.calls.length).toBe(count + 1);
	});
});
