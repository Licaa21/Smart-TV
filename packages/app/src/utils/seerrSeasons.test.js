import seerrApi from '../services/seerrApi';
import {isSeerrPseudo, loadSeerrSeason, seerrEpisodeItems, seerrSeasonItems, withEnglishGaps} from './seerrSeasons';

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

describe('withEnglishGaps', () => {
	it('fills only what is blank', () => {
		const filled = withEnglishGaps(
			[{IndexNumber: 1, Name: 'Pilot', Overview: ''}, {IndexNumber: 2, Name: 'Episodul 2', Overview: 'Românește.'}],
			[{IndexNumber: 1, Name: 'Pilot EN', Overview: 'In English.'}, {IndexNumber: 2, Name: 'Episode 2', Overview: 'English.'}]
		);
		expect(filled.map((e) => [e.Name, e.Overview])).toEqual([['Pilot', 'In English.'], ['Episodul 2', 'Românește.']]);
	});
});

describe('loadSeerrSeason', () => {
	beforeEach(() => seerrApi.getTvSeason.mockReset());

	it('asks for the language and only asks English when something is missing', async () => {
		seerrApi.getTvSeason.mockResolvedValueOnce(season([{name: 'Pilot', overview: 'Complet.'}]));
		const episodes = await loadSeerrSeason(details, 1, 'ro-RO');
		expect(seerrApi.getTvSeason).toHaveBeenCalledTimes(1);
		expect(seerrApi.getTvSeason).toHaveBeenCalledWith(1396, 1, 'ro-RO');
		expect(episodes[0].Overview).toBe('Complet.');
	});

	it('fills a missing description from English', async () => {
		seerrApi.getTvSeason
			.mockResolvedValueOnce(season([{name: 'Pilot', overview: ''}]))
			.mockResolvedValueOnce(season([{name: 'Pilot', overview: 'In English.'}]));
		const episodes = await loadSeerrSeason(details, 1, 'ro-RO');
		expect(seerrApi.getTvSeason).toHaveBeenLastCalledWith(1396, 1, 'en-US');
		expect(episodes[0].Overview).toBe('In English.');
	});

	it('does not ask English about episodes that have not aired', async () => {
		seerrApi.getTvSeason.mockResolvedValueOnce({seasonNumber: 1, episodes: [{seasonNumber: 1, episodeNumber: 1, name: 'Soon', overview: '', airDate: '2999-01-01'}]});
		await loadSeerrSeason(details, 1, 'ro-RO');
		expect(seerrApi.getTvSeason).toHaveBeenCalledTimes(1);
	});

	it('keeps what it has when English cannot be reached, and never asks it twice for English', async () => {
		seerrApi.getTvSeason
			.mockResolvedValueOnce(season([{name: 'Pilot', overview: ''}]))
			.mockRejectedValueOnce(new Error('down'));
		await expect(loadSeerrSeason(details, 1, 'ro-RO')).resolves.toHaveLength(1);

		seerrApi.getTvSeason.mockReset().mockResolvedValueOnce(season([{name: 'Pilot', overview: ''}]));
		await loadSeerrSeason(details, 1, 'en-US');
		expect(seerrApi.getTvSeason).toHaveBeenCalledTimes(1);
	});
});
