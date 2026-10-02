import {loadCollectionRowItems} from './collectionRowItems';

jest.mock('../../services/jellyfinApi', () => ({HOME_ROW_ITEM_FIELDS: 'Overview'}));
jest.mock('../../services/parentalControls', () => ({
	withoutBlockedItems: (items, fallbackRating) => items.filter((item) => (item.OfficialRating || fallbackRating) !== 'TV-MA')
}));

const movieA = {Id: 'movieA', Type: 'Movie', Name: 'Alpha', IsFolder: false};
const movieB = {Id: 'movieB', Type: 'Movie', Name: 'Bravo', IsFolder: false};
const series = {Id: 'show', Type: 'Series', Name: 'The Show', IsFolder: true};
const season = {Id: 'season2', Type: 'Season', Name: 'Season 2', SeriesId: 'show', SeriesName: 'The Show', IsFolder: true};
const episode1 = {Id: 'ep1', Type: 'Episode', Name: 'One', SeriesId: 'show', SeriesName: 'The Show', SeasonId: 'season2', IsFolder: false, UserData: {Played: true}};
const episode2 = {Id: 'ep2', Type: 'Episode', Name: 'Two', SeriesId: 'show', SeriesName: 'The Show', SeasonId: 'season2', IsFolder: false};

const fakeApi = ({members, flat = [], episodes = [], order = null}) => ({
	getItems: jest.fn(async (params) => {
		if (params.ParentId === 'box') return {Items: params.Recursive ? flat : members};
		return {Items: episodes};
	}),
	getCollectionOrder: jest.fn(async () => {
		if (order instanceof Error) throw order;
		return order;
	})
});

const load = (api, options) => loadCollectionRowItems(api, 'box', {
	limit: 20,
	usePlaylistOrder: true,
	sortBy: 'SortName',
	sortOrder: 'Ascending',
	showEpisodes: false,
	...options
});

const ids = (items) => items.map((item) => item.Id);

test('only the collection members come back, not the episodes under a season', async () => {
	const api = fakeApi({members: [season, movieA]});
	expect(ids(await load(api))).toEqual(['season2', 'movieA']);
	const params = api.getItems.mock.calls[0][0];
	expect(params.Recursive).toBeUndefined();
	expect(params.SortBy).toBeNull();
});

test('a picked sort goes to the server and skips the stored order', async () => {
	const api = fakeApi({members: [movieA, movieB], order: ['movieB', 'movieA']});
	await load(api, {usePlaylistOrder: false, sortBy: 'PremiereDate', sortOrder: 'Descending'});
	expect(api.getCollectionOrder).not.toHaveBeenCalled();
	expect(api.getItems.mock.calls[0][0]).toMatchObject({SortBy: 'PremiereDate', SortOrder: 'Descending'});
});

test('a stored order arranges the items and folds episodes into one series card', async () => {
	const api = fakeApi({order: ['movieB', 'ep2', 'ep1', 'movieA'], flat: [series, season, episode1, episode2, movieA, movieB]});
	const items = await load(api);
	expect(ids(items)).toEqual(['movieB', 'show', 'movieA']);
	expect(items[1]).toMatchObject({Type: 'Series', Name: 'The Show'});
	expect(items[1].UserData).toBeUndefined();
});

test('with episodes on, a stored order keeps them where it put them', async () => {
	const api = fakeApi({order: ['ep2', 'movieA', 'ep1'], flat: [season, episode1, episode2, movieA]});
	expect(ids(await load(api, {showEpisodes: true}))).toEqual(['ep2', 'movieA', 'ep1']);
});

test('items the stored order leaves out follow in the order the server sent them', async () => {
	const api = fakeApi({order: ['movieB'], flat: [episode1, movieA, movieB, episode2]});
	expect(ids(await load(api, {showEpisodes: true}))).toEqual(['movieB', 'ep1', 'movieA', 'ep2']);
});

test('a blocked series stays out of a stored order, as episodes and as a card', async () => {
	const blockedSeries = {...series, OfficialRating: 'TV-MA'};
	const api = fakeApi({order: ['ep1', 'movieA', 'ep2'], flat: [blockedSeries, season, episode1, episode2, movieA]});
	expect(ids(await load(api, {showEpisodes: true}))).toEqual(['movieA']);
	expect(ids(await load(api))).toEqual(['movieA']);
});

test('a stored order that cant be read falls back to the members', async () => {
	const api = fakeApi({members: [movieA], order: new Error('no plugin')});
	expect(ids(await load(api))).toEqual(['movieA']);
});

test('with episodes on and nothing stored, a series opens into its episodes', async () => {
	const api = fakeApi({members: [series, movieA], episodes: [episode1, episode2]});
	expect(ids(await load(api, {showEpisodes: true}))).toEqual(['ep1', 'ep2', 'movieA']);
});
