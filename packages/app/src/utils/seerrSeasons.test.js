import seerrApi from '../services/seerrApi';
import {tmdbGet} from './tmdbText';
import {isSeerrPseudo, loadSeerrSeason, seerrEpisodeItems, seerrSeasonItems, withEnglishGaps} from './seerrSeasons';

jest.mock('./tmdbText', () => ({...jest.requireActual('./tmdbText'), tmdbGet: jest.fn()}));
jest.mock('../services/seerrApi', () => ({
	__esModule: true,
	default: {getTvSeason: jest.fn(), getImageUrl: (path, size) => `tmdb/${size}${path}`}
}));

const details = {id: 1396, name: 'Breaking Bad', seasons: [
	{seasonNumber: 0, episodeCount: 0, name: 'Specials'},
	{seasonNumber: 1, episodeCount: 7, name: 'Sezonul 1', posterPath: '/s1.jpg'},
	{seasonNumber: 2, episodeCount: 13, name: 'Sezonul 2'}
]};

const season = (episodes) => ({seasonNumber: 1, episodes: episodes.map((e, i) => ({seasonNumber: 1, episodeNumber: i + 1, ...e}))});

describe('seerrSeasonItems', () => {
	it('makes a season item of each season, and leaves out an empty specials one', () => {
		const items = seerrSeasonItems(details);
		expect(items.map((s) => s.IndexNumber)).toEqual([1, 2]);
		expect(items[0]).toMatchObject({Type: 'Season', Name: 'Sezonul 1', SeriesName: 'Breaking Bad', _externalPosterUrl: 'tmdb/w342/s1.jpg'});
		expect(isSeerrPseudo(items[0])).toBe(true);
	});

	it('keeps specials when they have episodes, and leaves out a season that has none yet', () => {
		const withSpecials = {...details, seasons: [{seasonNumber: 0, episodeCount: 3, name: 'Specials'}, {seasonNumber: 3, episodeCount: 0, name: 'Sezonul 3'}]};
		expect(seerrSeasonItems(withSpecials).map((s) => s.IndexNumber)).toEqual([0]);
	});

	it('leaves a season TMDB only names in English unnamed, so the app labels it in its own language', () => {
		const untranslated = {...details, seasons: [{seasonNumber: 1, episodeCount: 2, name: 'Season 1'}, {seasonNumber: 2, episodeCount: 2, name: 'Sezonul 2'}, {seasonNumber: 0, episodeCount: 2, name: 'Specials'}]};
		expect(seerrSeasonItems(untranslated).map((s) => s.Name)).toEqual(['', 'Sezonul 2', '']);
	});
});

describe('seerrEpisodeItems', () => {
	it('shapes an episode the way the screens read one', () => {
		const [episode] = seerrEpisodeItems(season([{name: 'Pilot', overview: 'Un profesor.', airDate: '2008-01-20', runtime: 58, stillPath: '/e1.jpg'}]), details);
		expect(episode).toMatchObject({
			Type: 'Episode', Name: 'Pilot', Overview: 'Un profesor.', IndexNumber: 1, ParentIndexNumber: 1,
			PremiereDate: '2008-01-20', RunTimeTicks: 58 * 600000000, SeriesName: 'Breaking Bad',
			_externalPosterUrl: 'tmdb/w500/e1.jpg', _externalBackdropUrl: 'tmdb/w500/e1.jpg'
		});
	});
});

describe('seerrEpisodeItems rating', () => {
	it('shows a score only when votes stand behind it', () => {
		const rated = seerrEpisodeItems(season([
			{name: 'a', voteAverage: 1, voteCount: 0},
			{name: 'b', voteAverage: 8.4, voteCount: 120},
			{name: 'c', voteAverage: 1, voteCount: 1},
			{name: 'd', voteAverage: 1},
			{name: 'e', voteAverage: 7.2}
		]), details).map((episode) => episode.CommunityRating);
		expect(rated).toEqual([null, 8.4, null, null, 7.2]);
	});
});

describe('seerrEpisodeItems people', () => {
	it('lists the director, the writers and the guests, and leaves out what is not there', () => {
		const [full, bare] = seerrEpisodeItems(season([
			{name: 'Pilot', voteCount: 12, crew: [{name: 'A', job: 'Director'}, {name: 'B', job: 'Writer'}, {name: 'B', job: 'Screenplay'}, {name: 'C', job: 'Editor'}], guestStars: [{id: 7, name: 'D', character: 'Cop', profile_path: '/d.jpg'}, {name: 'E', profilePath: '/e.jpg'}]},
			{name: 'Next'}
		]), details);
		expect(full).toMatchObject({_voteCount: 12, _directors: ['A'], _writers: ['B']});
		expect(full._guestStars).toEqual([
			{id: '7', name: 'D', character: 'Cop', photo: 'tmdb/w185/d.jpg'},
			{id: '', name: 'E', character: '', photo: 'tmdb/w185/e.jpg'}
		]);
		expect(bare).toMatchObject({_voteCount: 0, _directors: [], _writers: [], _guestStars: []});
	});
});

describe('withEnglishGaps', () => {
	it('fills only what is blank', () => {
		const filled = withEnglishGaps(
			[{IndexNumber: 1, Name: 'Pilot', Overview: ''}, {IndexNumber: 2, Name: 'Episodul 2', Overview: 'Românește.'}],
			[{IndexNumber: 1, Name: 'Pilot EN', Overview: 'In English.'}, {IndexNumber: 2, Name: 'Episode 2', Overview: 'English.'}]
		);
		expect(filled.map((e) => [e.Name, e.Overview])).toEqual([['Pilot', 'In English.'], ['Episodul 2', 'Românește.']]);
	});
});

// What TMDB answers, which is not the shape Seerr's answer has.
const tmdbSeason = (episodes) => ({season_number: 1, episodes: episodes.map((e, i) => ({season_number: 1, episode_number: i + 1, ...e}))});

describe('loadSeerrSeason', () => {
	beforeEach(() => {
		seerrApi.getTvSeason.mockReset();
		tmdbGet.mockReset();
	});

	it('is the Seerr answer, asked in the metadata language, when there is no TMDB key', async () => {
		seerrApi.getTvSeason.mockResolvedValueOnce(season([{name: 'Pilot', overview: 'In English.'}]));
		const episodes = await loadSeerrSeason(details, 1, 'ro');
		expect(seerrApi.getTvSeason).toHaveBeenCalledWith(1396, 1, 'ro');
		expect(tmdbGet).not.toHaveBeenCalled();
		expect(episodes[0].Overview).toBe('In English.');
	});

	it('asks Seerr for English when its own language has no description', async () => {
		seerrApi.getTvSeason
			.mockResolvedValueOnce(season([{name: 'Episodul 1', overview: '', airDate: '2008-01-20'}]))
			.mockResolvedValueOnce(season([{name: 'Pilot', overview: 'In English.', airDate: '2008-01-20'}]));
		const episodes = await loadSeerrSeason(details, 1, 'ro');
		expect(seerrApi.getTvSeason).toHaveBeenLastCalledWith(1396, 1, 'en-US');
		expect(episodes[0].Name).toBe('Episodul 1');
		expect(episodes[0].Overview).toBe('In English.');
	});

	it('reads the language from TMDB, and only asks English when an aired episode lacks text', async () => {
		tmdbGet.mockResolvedValueOnce(tmdbSeason([{name: 'Pilot', overview: 'Complet.', air_date: '2008-01-20'}]));
		const episodes = await loadSeerrSeason(details, 1, 'ro', 'key');
		expect(tmdbGet).toHaveBeenCalledTimes(1);
		expect(tmdbGet).toHaveBeenCalledWith('/tv/1396/season/1', 'ro', 'key');
		expect(episodes[0].Overview).toBe('Complet.');
		expect(seerrApi.getTvSeason).not.toHaveBeenCalled();
	});

	it('fills a missing description from English', async () => {
		tmdbGet
			.mockResolvedValueOnce(tmdbSeason([{name: 'Pilot', overview: '', air_date: '2008-01-20'}]))
			.mockResolvedValueOnce(tmdbSeason([{name: 'Pilot', overview: 'In English.', air_date: '2008-01-20'}]));
		const episodes = await loadSeerrSeason(details, 1, 'ro', 'key');
		expect(tmdbGet).toHaveBeenLastCalledWith('/tv/1396/season/1', 'en-US', 'key');
		expect(episodes[0].Overview).toBe('In English.');
	});

	it('does not ask English about episodes that have not aired', async () => {
		tmdbGet.mockResolvedValueOnce(tmdbSeason([{name: 'Soon', overview: '', air_date: '2999-01-01'}]));
		await loadSeerrSeason(details, 1, 'ro', 'key');
		expect(tmdbGet).toHaveBeenCalledTimes(1);
	});

	it('keeps what it has when English cannot be reached, and never asks English for English', async () => {
		tmdbGet.mockResolvedValueOnce(tmdbSeason([{name: 'Pilot', overview: '', air_date: '2008-01-20'}])).mockRejectedValueOnce(new Error('down'));
		await expect(loadSeerrSeason(details, 1, 'ro', 'key')).resolves.toHaveLength(1);

		tmdbGet.mockReset().mockResolvedValueOnce(tmdbSeason([{name: 'Pilot', overview: '', air_date: '2008-01-20'}]));
		await loadSeerrSeason(details, 1, 'en-US', 'key');
		expect(tmdbGet).toHaveBeenCalledTimes(1);
	});

	it('is the Seerr answer when TMDB cannot be reached', async () => {
		tmdbGet.mockRejectedValueOnce(new Error('401'));
		seerrApi.getTvSeason.mockResolvedValueOnce(season([{name: 'Pilot', overview: 'In English.'}]));
		const episodes = await loadSeerrSeason(details, 1, 'ro', 'bad');
		expect(episodes[0].Overview).toBe('In English.');
	});
});
