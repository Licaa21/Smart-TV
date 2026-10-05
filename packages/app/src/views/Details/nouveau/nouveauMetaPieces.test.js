import {nouveauMetaPieces} from './nouveauMetaPieces';

describe('nouveauMetaPieces', () => {
	it('leads with the year and the rating', () => {
		expect(nouveauMetaPieces({
			item: {Type: 'Movie'}, year: 1982, officialRating: 'R', runtime: '1h 57m'
		})).toEqual(['1982', 'R', '1h 57m']);
	});

	it('counts seasons for a series and episodes for a season', () => {
		expect(nouveauMetaPieces({item: {Type: 'Series'}, seasonCount: 4})).toContain('4 Seasons');
		expect(nouveauMetaPieces({item: {Type: 'Season'}, episodeCount: 12})).toContain('12 Episodes');
	});

	it('names where an episode sits in its run', () => {
		expect(nouveauMetaPieces({item: {Type: 'Episode', ParentIndexNumber: 2, IndexNumber: 7}}))
			.toContain('S2:E7');
	});

	it('gives a person their dates and where they are from instead', () => {
		const pieces = nouveauMetaPieces({
			item: {
				Type: 'Person',
				PremiereDate: '1955-02-24T00:00:00.0000000Z',
				ProductionLocations: ['San Francisco, California']
			},
			year: 1955,
			runtime: '2h'
		});
		expect(pieces[pieces.length - 1]).toBe('San Francisco, California');
		expect(pieces).not.toContain('2h');
	});

	it('leaves the birthplace off when the viewer hid it', () => {
		const pieces = nouveauMetaPieces({
			item: {Type: 'Person', ProductionLocations: ['San Francisco, California']},
			showsBirthplace: false
		});
		expect(pieces).not.toContain('San Francisco, California');
	});

	// A series has no runtime of its own, so the number belonging to one episode would be
	// misleading sat next to the season count.
	it('leaves the runtime off a series', () => {
		expect(nouveauMetaPieces({item: {Type: 'Series'}, runtime: '24m', seasonCount: 2}))
			.toEqual(['2 Seasons']);
	});

	it('says when a season would finish, and only for a season', () => {
		expect(nouveauMetaPieces({item: {Type: 'Season'}, runtime: '8h', endsAt: 'Ends at 11:15 PM'}))
			.toEqual(['8h', 'Ends at 11:15 PM']);
		expect(nouveauMetaPieces({item: {Type: 'Movie'}, runtime: '2h', endsAt: 'Ends at 9:00 PM'}))
			.toEqual(['2h']);
	});

	it('has nothing to say about an item the server was silent on', () => {
		expect(nouveauMetaPieces({item: {Type: 'Movie'}})).toEqual([]);
	});
});
