import {getNextEpisode, getPreviousEpisode} from './playback';

jest.mock('./deviceProfile', () => ({}));
jest.mock('./video', () => ({}));
jest.mock('./storage', () => ({}));
jest.mock('./serverLogger', () => ({serverLogger: {}}));
jest.mock('../utils/deviceProfileTuning', () => ({}));
jest.mock('../utils/alternateAudio', () => ({}));
jest.mock('./systemVolume', () => ({getVolumeState: jest.fn(), lastVolumeState: jest.fn()}));

const mockApi = {getEpisodes: jest.fn(), getSeasons: jest.fn()};
jest.mock('./jellyfinApi', () => ({
	api: {getEpisodes: (...a) => mockApi.getEpisodes(...a), getSeasons: (...a) => mockApi.getSeasons(...a)},
	createApiForServer: jest.fn()
}));

const ep = (id, n, extra) => ({Id: id, IndexNumber: n, ...extra});
const current = {Id: 'e1', Type: 'Episode', SeriesId: 'show', SeasonId: 's2', ParentIndexNumber: 2};

beforeEach(() => jest.clearAllMocks());

describe('getPreviousEpisode', () => {
	test('returns the episode before in the same season', async () => {
		mockApi.getEpisodes.mockResolvedValue({Items: [ep('e0', 1), ep('e1', 2), ep('e2', 3)]});
		expect((await getPreviousEpisode(current)).Id).toBe('e0');
	});

	test('rolls back into the last episode of the previous season from the first', async () => {
		mockApi.getEpisodes.mockImplementation(async (series, season) => (
			season === 's2' ? {Items: [ep('e1', 1)]} : {Items: [ep('a', 1), ep('b', 2), ep('c', 3, {LocationType: 'Virtual'})]}
		));
		mockApi.getSeasons.mockResolvedValue({Items: [{Id: 's0', IndexNumber: 0}, {Id: 's1', IndexNumber: 1}, {Id: 's2', IndexNumber: 2}]});
		expect((await getPreviousEpisode(current)).Id).toBe('b');
	});

	test('returns null on the first episode of the first season', async () => {
		mockApi.getEpisodes.mockResolvedValue({Items: [ep('e1', 1)]});
		mockApi.getSeasons.mockResolvedValue({Items: [{Id: 's0', IndexNumber: 0}, {Id: 's2', IndexNumber: 2}]});
		expect(await getPreviousEpisode(current)).toBeNull();
	});

	test('returns null for anything but an episode, and when the server fails', async () => {
		expect(await getPreviousEpisode({Id: 'm', Type: 'Movie'})).toBeNull();
		mockApi.getEpisodes.mockRejectedValue(new Error('offline'));
		jest.spyOn(console, 'warn').mockImplementation(() => {});
		expect(await getPreviousEpisode(current)).toBeNull();
	});

	test('next and previous agree about the neighbours', async () => {
		mockApi.getEpisodes.mockResolvedValue({Items: [ep('e0', 1), ep('e1', 2), ep('e2', 3)]});
		expect((await getNextEpisode(current)).Id).toBe('e2');
		expect((await getPreviousEpisode(current)).Id).toBe('e0');
	});
});
