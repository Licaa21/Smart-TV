import {getImageUrl} from './seerrApi';

describe('getImageUrl', () => {
	it('builds a TMDB address from a TMDB path', () => {
		expect(getImageUrl('/poster.jpg', 'w342')).toMatch(/^https?:\/\/image\.tmdb\.org\/t\/p\/w342\/poster\.jpg$/);
	});

	it('uses another site\'s picture as it is', () => {
		const imdb = 'https://m.media-amazon.com/images/M/poster.jpg';
		expect(getImageUrl(imdb, 'w342')).toBe(imdb);
	});
});
