import {useEffect, useMemo, useState} from 'react';

import {useSeerr} from '../context/SeerrContext';
import {useSettings} from '../context/SettingsContext';
import * as seerrApi from '../services/seerrApi';
import {prepareCredits, knownForBackdropPath, knownForKey, libraryRanking} from '../utils/personCredits';
import {normalizeMediaItem} from '../utils/seerrHomeRows';

const EMPTY = [];

/**
 * The work a person is credited with beyond what the server holds a copy of.
 * Quiet when there is no metadata id or no Seerr to ask.
 */
const usePersonSeerrCredits = (tmdbId) => {
	const {isEnabled} = useSeerr();
	const {settings: {personPageGroupItems: group, personPageSortOption: sortOption}} = useSettings();
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

	// The most popular first, with the title the backdrop comes from ahead of them all.
	const pinKey = useMemo(() => (credits ? knownForKey(credits.cast, credits.crew) : null), [credits]);
	const ranking = useMemo(() => libraryRanking(credits), [credits]);
	const appearances = useMemo(
		() => (credits ? prepareCredits(credits.cast, {isCrew: false, group, sortOption, pinKey}).map(normalizeMediaItem) : EMPTY),
		[credits, group, sortOption, pinKey]
	);
	const crewCredits = useMemo(
		() => (credits ? prepareCredits(credits.crew, {isCrew: true, group, sortOption, pinKey}).map(normalizeMediaItem) : EMPTY),
		[credits, group, sortOption, pinKey]
	);

	return {
		appearances,
		crewCredits,
		// For the library's own rows on the same page, which take their order from what Seerr says of the same titles
		ranking,
		// the cast first, then the crew work of a person who only directs or writes, as the Seerr person screen does
		backdropPath: credits ? (knownForBackdropPath(credits.cast) || knownForBackdropPath(credits.crew)) : null,
		// False while credits are still on their way, so a backdrop chosen from them is not
		// replaced a moment after another was drawn.
		creditsSettled: !tmdbId || !isEnabled || credits !== null,
		seerrEnabled: isEnabled
	};
};

export default usePersonSeerrCredits;
