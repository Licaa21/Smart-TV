import $L from '@enact/i18n/$L';

import {RATING_ICON_PATHS} from '../../components/icons/ratingIcons';
import {displayRatingLikes, personalRatingOf, starRatingLabel} from '../../utils/personalRating';

// What the rating button says and draws, which depends on both the chosen style
// and whatever rating the server already holds.

// The button wears the thumb whatever the style, so it reads as the same Rate button on every detail screen. The style
// only changes the words and the dialog it opens.
export const personalRatingIconPath = () => RATING_ICON_PATHS.thumbUp;

export const personalRatingLabel = (style, userData) => {
	const rating = personalRatingOf(userData);
	if (style === 'thumbs') {
		// A thumb rating only stores whether the title was liked, so the score on
		// its own cant say whether one was ever given.
		const likes = displayRatingLikes(userData);
		if (likes === null) return $L('Rate');
		return likes ? $L('Like') : $L('Dislike');
	}
	if (rating === null) return $L('Rate');
	if (style === 'stars') {
		return starRatingLabel(rating) || $L('Rate');
	}
	return $L('Rated');
};
