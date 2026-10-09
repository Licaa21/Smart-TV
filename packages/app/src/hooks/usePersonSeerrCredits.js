import {useState, useEffect} from 'react';

import {useSeerr} from '../context/SeerrContext';
import * as seerrApi from '../services/seerrApi';
import {prepareCredits, knownForBackdropPath} from '../utils/personCredits';
import {normalizeMediaItem} from '../utils/seerrHomeRows';

const EMPTY = [];

/**
 * The work a person is credited with beyond what the server holds a copy of.
 * Quiet when there is no metadata id or no Seerr to ask.
 */
const usePersonSeerrCredits = (tmdbId) => {
	const {isEnabled} = useSeerr();
	const [credits, setCredits] = useState(null);

	useEffect(() => {
		setCredits(null);
		if (!tmdbId || !isEnabled) return;

		let cancelled = false;
		seerrApi.getPersonCombinedCredits(tmdbId)
			.then((data) => {
				if (!cancelled) setCredits(data);
			})
			// Settled either way, so a screen waiting on these can stop waiting.
			.catch(() => {
				if (!cancelled) setCredits({cast: [], crew: []});
			});

		return () => { cancelled = true; };
	}, [tmdbId, isEnabled]);

	return {
		appearances: credits ? prepareCredits(credits.cast, {isCrew: false, group: true}).map(normalizeMediaItem) : EMPTY,
		crewCredits: credits ? prepareCredits(credits.crew, {isCrew: true, group: true}).map(normalizeMediaItem) : EMPTY,
		// the cast first, then the crew work of a person who only directs or writes, as the Seerr person screen does
		backdropPath: credits ? (knownForBackdropPath(credits.cast) || knownForBackdropPath(credits.crew)) : null,
		// False while credits are still on their way, so a backdrop chosen from them is not
		// replaced a moment after another was drawn.
		creditsSettled: !tmdbId || !isEnabled || credits !== null,
		seerrEnabled: isEnabled
	};
};

export default usePersonSeerrCredits;
