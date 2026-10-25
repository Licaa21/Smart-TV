import {useCallback, useEffect, useRef, useState} from 'react';
import Spotlight from '@enact/spotlight';

import {loadTmdbReviews, reviewsQuery} from '../../utils/tmdbReviews';

const NONE = [];

// BACK reaches the dialog through the screen's handler, like its other overlays, and closing it
// puts focus back on the card it came from.
const useDetailsReviews = ({item, effectiveApi, enabled, backRef}) => {
	const [reviews, setReviews] = useState(NONE);
	const [openReview, setOpenReview] = useState(null);
	const openerRef = useRef(null);

	const query = enabled ? reviewsQuery(item) : null;
	const tmdbId = query?.tmdbId;
	const type = query?.type;

	useEffect(() => {
		setReviews(NONE);
		setOpenReview(null);
		if (!tmdbId) return undefined;
		let cancelled = false;
		loadTmdbReviews(effectiveApi, {tmdbId, type}).then((list) => {
			if (!cancelled) setReviews(list);
		});
		return () => { cancelled = true; };
	}, [effectiveApi, tmdbId, type]);

	const handleSelectReview = useCallback((review) => {
		openerRef.current = Spotlight.getCurrent();
		setOpenReview(review);
	}, []);

	const handleCloseReview = useCallback(() => {
		const opener = openerRef.current;
		openerRef.current = null;
		setOpenReview(null);
		window.requestAnimationFrame(() => {
			if (opener) Spotlight.focus(opener);
		});
	}, []);

	useEffect(() => {
		if (!backRef) return undefined;
		const handler = () => {
			if (!openReview) return false;
			handleCloseReview();
			return true;
		};
		backRef.current = handler;
		return () => {
			if (backRef.current === handler) backRef.current = null;
		};
	}, [backRef, openReview, handleCloseReview]);

	return {reviews, openReview, handleSelectReview, handleCloseReview};
};

export default useDetailsReviews;
