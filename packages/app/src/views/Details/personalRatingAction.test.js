// $L reaches for ilib, which a plain unit test has no way to load. Every key is its
// own English source string, so handing the string straight back is faithful enough.
jest.mock('@enact/i18n/$L', () => ({__esModule: true, default: (str) => str}));

import {personalRatingIconPath, personalRatingLabel} from './personalRatingAction';
import {RATING_ICON_PATHS} from '../../components/icons/ratingIcons';

describe('personal rating action', () => {
	it('asks for a rating until one is given', () => {
		expect(personalRatingLabel('thumbs', {})).toBe('Rate');
		expect(personalRatingLabel('stars', {})).toBe('Rate');
		expect(personalRatingLabel('numeric', {})).toBe('Rate');
	});

	it('says how the title was rated with thumbs', () => {
		expect(personalRatingLabel('thumbs', {Likes: true})).toBe('Like');
		expect(personalRatingLabel('thumbs', {Likes: false})).toBe('Dislike');
		expect(personalRatingLabel('thumbs', {Rating: 8})).toBe('Like');
		expect(personalRatingLabel('thumbs', {Rating: 2})).toBe('Dislike');
	});

	it('draws the score as stars', () => {
		expect(personalRatingLabel('stars', {Rating: 8})).toBe('★★★★');
		expect(personalRatingLabel('stars', {Rating: 9})).toBe('★★★★½');
		// A score too low to fill a single star still has to say something.
		expect(personalRatingLabel('stars', {Rating: 0})).toBe('Rate');
	});

	it('marks a numeric score as rated', () => {
		expect(personalRatingLabel('numeric', {Rating: 7})).toBe('Rated');
		expect(personalRatingLabel('numeric', {Rating: 0})).toBe('Rated');
	});

	it('draws the thumb for every style and whatever rating is behind it', () => {
		for (const style of ['thumbs', 'stars', 'numeric']) {
			expect(personalRatingIconPath(style, {})).toBe(RATING_ICON_PATHS.thumbUp);
			expect(personalRatingIconPath(style, {Likes: false, Rating: 3})).toBe(RATING_ICON_PATHS.thumbUp);
		}
	});
});
