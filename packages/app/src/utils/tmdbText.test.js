import {keepingText, seasonFromTmdb, withTmdbText} from './tmdbText';

describe('seasonFromTmdb', () => {
	it('gives an episode the shape Seerr gives', () => {
		const season = seasonFromTmdb({season_number: 1, episodes: [{season_number: 1, episode_number: 2, name: 'Doi', overview: 'Descriere', air_date: '2008-01-27', runtime: 47, still_path: '/s.jpg', vote_average: 8, vote_count: 3, crew: [{name: 'A', job: 'Director'}], guest_stars: [{name: 'B'}]}]});
		expect(season).toEqual({seasonNumber: 1, episodes: [{seasonNumber: 1, episodeNumber: 2, name: 'Doi', overview: 'Descriere', airDate: '2008-01-27', runtime: 47, stillPath: '/s.jpg', voteAverage: 8, voteCount: 3, crew: [{name: 'A', job: 'Director'}], guestStars: [{name: 'B'}]}]});
	});
});

describe('withTmdbText', () => {
	const seerr = {id: 1, name: 'Breaking Bad', overview: 'A teacher.', tagline: '', status: 'Ended', seasons: [{seasonNumber: 1, name: 'Season 1'}, {seasonNumber: 2, name: 'Season 2'}]};

	it('takes the words and leaves the rest', () => {
		const merged = withTmdbText(seerr, {name: 'Breaking Bad', overview: 'Un profesor.', tagline: 'Fii cel mai bun', seasons: [{season_number: 1, name: 'Sezonul 1'}]});
		expect(merged).toMatchObject({status: 'Ended', overview: 'Un profesor.', tagline: 'Fii cel mai bun'});
		expect(merged.seasons.map((s) => s.name)).toEqual(['Sezonul 1', 'Season 2']);
	});

	it('keeps Seerr\'s words where TMDB has none', () => {
		expect(withTmdbText(seerr, {overview: '', tagline: ''})).toMatchObject({overview: 'A teacher.'});
		expect(withTmdbText(seerr, null)).toBe(seerr);
	});
});

describe('keepingText', () => {
	it('lays the words a title already has over a fresh answer', () => {
		const fresh = {overview: 'English.', status: 'Processing', seasons: [{seasonNumber: 1, name: 'Season 1'}]};
		const previous = {overview: 'Romanesc.', tagline: 'Slogan', seasons: [{seasonNumber: 1, name: 'Sezonul 1'}]};
		expect(keepingText(fresh, previous)).toMatchObject({status: 'Processing', overview: 'Romanesc.', tagline: 'Slogan', seasons: [{name: 'Sezonul 1'}]});
		expect(keepingText(fresh, null)).toBe(fresh);
	});
});
