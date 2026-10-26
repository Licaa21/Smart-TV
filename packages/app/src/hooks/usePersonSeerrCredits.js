import {useEffect, useMemo, useState} from 'react';

import {useSeerr} from '../context/SeerrContext';
import {useSettings} from '../context/SettingsContext';
import * as seerrApi from '../services/seerrApi';
import {prepareCredits} from '../utils/personCredits';
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
			.catch(() => {});

		return () => { cancelled = true; };
	}, [tmdbId, isEnabled]);

	const appearances = useMemo(
		() => (credits ? prepareCredits(credits.cast, {isCrew: false, group, sortOption}).map(normalizeMediaItem) : EMPTY),
		[credits, group, sortOption]
	);
	const crewCredits = useMemo(
		() => (credits ? prepareCredits(credits.crew, {isCrew: true, group, sortOption}).map(normalizeMediaItem) : EMPTY),
		[credits, group, sortOption]
	);

	return {appearances, crewCredits, seerrEnabled: isEnabled};
};

export default usePersonSeerrCredits;
