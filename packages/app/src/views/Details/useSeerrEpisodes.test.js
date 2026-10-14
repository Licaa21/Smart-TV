import {act, renderHook} from '@testing-library/react';

import {loadSeerrSeason} from '../../utils/seerrSeasons';
import useSeerrEpisodes from './useSeerrEpisodes';

jest.mock('../../utils/seerrSeasons', () => ({
	...jest.requireActual('../../utils/seerrSeasons'),
	loadSeerrSeason: jest.fn()
}));
jest.mock('../../services/seerrApi', () => ({__esModule: true, default: {getImageUrl: (path) => path}}));

const details = {id: 7, name: 'Show', seasons: [
	{seasonNumber: 1, episodeCount: 2},
	{seasonNumber: 2, episodeCount: 2},
	{seasonNumber: 3, episodeCount: 2}
]};

const episode = (season, number) => ({Id: `e${season}${number}`, IndexNumber: number, ParentIndexNumber: season, ProviderIds: {Tmdb: '7'}});

// A season whose answer the test hands over by hand.
const pending = () => {
	const control = {};
	control.promise = new Promise((resolve, reject) => { control.resolve = resolve; control.reject = reject; });
	return control;
};

describe('useSeerrEpisodes', () => {
	let seasons;

	beforeEach(() => {
		seasons = {1: pending(), 2: pending(), 3: pending()};
		loadSeerrSeason.mockReset();
		loadSeerrSeason.mockImplementation((series, number) => seasons[number].promise);
	});

	it('shows seasons in season order, holding a late lower one back from a faster higher one', async () => {
		const {result} = renderHook(() => useSeerrEpisodes({details, enabled: true, language: 'ro-RO'}));
		expect(result.current.seasons.map((s) => s.IndexNumber)).toEqual([1, 2, 3]);

		await act(async () => seasons[2].resolve([episode(2, 1), episode(2, 2)]));
		expect(result.current.episodes).toEqual([]);

		await act(async () => seasons[1].resolve([episode(1, 1), episode(1, 2)]));
		expect(result.current.episodes.map((e) => e.Id)).toEqual(['e11', 'e12', 'e21', 'e22']);

		await act(async () => seasons[3].resolve([episode(3, 1)]));
		expect(result.current.episodes.map((e) => e.Id)).toEqual(['e11', 'e12', 'e21', 'e22', 'e31']);
	});

	it('loads the specials last, so the first season is what a viewer opens on', async () => {
		const withSpecials = {id: 7, name: 'Show', seasons: [{seasonNumber: 0, episodeCount: 1}, {seasonNumber: 1, episodeCount: 2}, {seasonNumber: 2, episodeCount: 2}]};
		seasons[0] = pending();
		renderHook(() => useSeerrEpisodes({details: withSpecials, enabled: true, language: 'ro-RO'}));
		expect(loadSeerrSeason.mock.calls.map((call) => call[1])).toEqual([1, 2, 0]);
	});

	it('does not hold the rest back for a season that fails', async () => {
		const {result} = renderHook(() => useSeerrEpisodes({details, enabled: true, language: 'ro-RO'}));
		await act(async () => seasons[1].reject(new Error('timeout')));
		await act(async () => seasons[2].resolve([episode(2, 1)]));
		expect(result.current.episodes.map((e) => e.Id)).toEqual(['e21']);
	});

	it('asks for nothing until it is enabled and the language is known', () => {
		renderHook(() => useSeerrEpisodes({details, enabled: false, language: 'ro-RO'}));
		renderHook(() => useSeerrEpisodes({details, enabled: true, language: null}));
		expect(loadSeerrSeason).not.toHaveBeenCalled();
	});
});
