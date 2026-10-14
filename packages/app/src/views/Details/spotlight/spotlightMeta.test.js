import {spotlightMetaPieces} from './spotlightMeta';

const mins = (m) => m * 60 * 10000000;
const kinds = (pieces) => pieces.map((p) => p.kind);
const texts = (pieces) => pieces.map((p) => p.text);

describe('spotlightMetaPieces', () => {
	it('leads with the year and the rating', () => {
		const pieces = spotlightMetaPieces({item: {Type: 'Movie'}, year: 1979, officialRating: 'R'});
		expect(texts(pieces)).toEqual(['1979', 'R']);
	});

	it('counts seasons on a series and episodes on a season', () => {
		expect(texts(spotlightMetaPieces({item: {Type: 'Series'}, seasonCount: 4}))).toEqual(['4 Seasons']);
		expect(texts(spotlightMetaPieces({item: {Type: 'Season'}, episodeCount: 10}))).toEqual(['10 Episodes']);
	});

	it('names where an episode sits', () => {
		expect(texts(spotlightMetaPieces({item: {Type: 'Episode', ParentIndexNumber: 2, IndexNumber: 5}}))).toEqual(['S2:E5']);
	});

	it('gives an episode its runtime alongside its number, not instead of it', () => {
		const pieces = spotlightMetaPieces({item: {Type: 'Episode', ParentIndexNumber: 2, IndexNumber: 5, RunTimeTicks: mins(48)}});
		expect(pieces).toEqual([
			{kind: 'text', text: 'S2:E5'},
			{kind: 'runtime', text: '48m'}
		]);
	});

	it('marks a series as running or finished', () => {
		const running = spotlightMetaPieces({item: {Type: 'Series', Status: 'Continuing'}});
		expect(running[0]).toEqual({kind: 'status', text: 'Continuing', ended: false});
		const done = spotlightMetaPieces({item: {Type: 'Series', Status: 'Ended'}});
		expect(done[0]).toEqual({kind: 'status', text: 'Ended', ended: true});
	});

	it('shows a status it has no wording of its own for, rather than dropping it', () => {
		expect(spotlightMetaPieces({item: {Type: 'Series', Status: 'Unreleased'}}))
			.toEqual([{kind: 'status', text: 'Unreleased', ended: false}]);
	});

	it('colours any spelling of ended as finished', () => {
		expect(spotlightMetaPieces({item: {Type: 'Series', Status: 'ended'}})[0].ended).toBe(true);
	});

	it('ignores a status on anything that isn\'t a series', () => {
		expect(spotlightMetaPieces({item: {Type: 'Movie', Status: 'Ended'}})).toEqual([]);
	});

	it('gives a runtime to everything but a series', () => {
		expect(kinds(spotlightMetaPieces({item: {Type: 'Movie', RunTimeTicks: mins(95)}}))).toEqual(['runtime']);
		expect(spotlightMetaPieces({item: {Type: 'Series', RunTimeTicks: mins(45)}})).toEqual([]);
	});

	it('names at most three genres', () => {
		const pieces = spotlightMetaPieces({item: {Type: 'Movie'}, genres: ['A', 'B', 'C', 'D']});
		expect(texts(pieces)).toEqual(['A · B · C']);
	});

	it('has nothing to say about an item carrying nothing', () => {
		expect(spotlightMetaPieces({item: {Type: 'Movie'}})).toEqual([]);
	});

	it('includes upcoming episode piece and respects custom metadata order', () => {
		const pieces = spotlightMetaPieces({
			item: {Type: 'Series', Status: 'Continuing'},
			year: 2024,
			upcomingEpisodeText: 'Next: Today (S2:E1)',
			settings: {
				detailMetadataOrderTv: ['upcomingEpisodeDate', 'year', 'status'],
				hiddenDetailMetadataTv: ['status']
			}
		});

		expect(pieces).toEqual([
			{kind: 'upcoming', text: 'Next: Today (S2:E1)'},
			{kind: 'text', text: '2024'}
		]);
	});

	it('closes the line with the running status and then what Seerr says, wherever the order puts them', () => {
		const pieces = spotlightMetaPieces({
			item: {Type: 'Series', Status: 'Continuing'},
			year: 2024,
			genres: ['Drama'],
			hasSeerrPills: true,
			settings: {detailMetadataOrderTv: ['seerrAvailability', 'status', 'year', 'genres']}
		});

		expect(pieces.map((piece) => piece.kind)).toEqual(['text', 'text', 'status', 'seerr']);
	});
});
