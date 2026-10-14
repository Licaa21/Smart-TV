import {useCallback, useMemo, useState} from 'react';
import Spotlight from '@enact/spotlight';

import DetailsTabBar from '../../components/DetailsTabBar';
import {appLocale} from '../../utils/appLocale';
import {episodeCardTitle} from '../../utils/episodeCardTitle';
import {formatDuration} from '../../utils/helpers';
import {hidesMediaDescription} from './detailsMedia';
import {SpottableDiv} from './detailsSpottables';
import {effectiveSeason, groupEpisodesBySeason, seasonOptions} from './nouveau/nouveauSeasons';
import NouveauRail from './nouveau/sections/NouveauRail';

import css from './SeerrEpisodes.module.less';

const CARD_WIDTH = 340;
const CARD_GAP = 24;

// What a viewer is told about when an episode airs, in the app's language.
const airDateText = (episode) => {
	if (!episode.PremiereDate) return '';
	const date = new Date(episode.PremiereDate);
	if (Number.isNaN(date.getTime())) return '';
	return date.toLocaleDateString(appLocale(), {year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC'});
};

// A Seerr series' episodes, read only: season tabs over a row of cards showing the still, the number
// and name, when it airs and the description. Every style that has no row of its own for this draws
// it, so what an episode says reads the same in each.
const SeerrEpisodes = ({seasons = [], episodes = [], navbarPosition, spotlightId = 'seerr-episodes', onNavigateUp, settings, firstSpotlightId}) => {
	const [picked, setPicked] = useState(null);

	const groups = useMemo(() => groupEpisodesBySeason(episodes), [episodes]);
	const numbers = useMemo(() => [...groups.keys()], [groups]);
	const tabs = useMemo(() => seasonOptions(groups, seasons), [groups, seasons]);
	// Specials sort first, but a viewer opens a show on its first real season.
	const active = effectiveSeason(numbers, picked, numbers.find((number) => number > 0));
	// Held steady across renders so the rail does not rebuild its cards every time.
	const shown = useMemo(() => groups.get(active) || [], [groups, active]);

	const handleActivate = useCallback((id) => setPicked(Number(id)), []);

	// The rail keeps up and down for itself and hands them back, so leaving it is decided here: up to
	// the season tabs when there are some, and otherwise wherever the page puts focus.
	const hasTabs = tabs.length > 1;
	const handleUp = useCallback(() => {
		if (onNavigateUp) onNavigateUp();
		else if (!hasTabs || !Spotlight.focus(`${spotlightId}-season`)) Spotlight.move('up');
	}, [onNavigateUp, hasTabs, spotlightId]);
	const handleDown = useCallback(() => Spotlight.move('down'), []);

	const renderEpisode = useCallback((episode, index) => {
		const meta = [airDateText(episode), episode.RunTimeTicks ? formatDuration(episode.RunTimeTicks) : ''].filter(Boolean).join(' · ');
		return (
			<SpottableDiv className={css.card} style={{width: `${CARD_WIDTH}px`}} spotlightId={index === 0 ? firstSpotlightId : undefined}>
				<div className={css.still}>
					{episode._externalPosterUrl ? <img src={episode._externalPosterUrl} alt="" /> : <div className={css.noStill} />}
				</div>
				<div className={css.title}>{episodeCardTitle(episode.Name, episode.IndexNumber)}</div>
				{meta && <div className={css.meta}>{meta}</div>}
				{episode.Overview && !hidesMediaDescription(episode, settings) && <div className={css.overview}>{episode.Overview}</div>}
			</SpottableDiv>
		);
	}, [settings, firstSpotlightId]);

	// The episodes arrive a season at a time, and whoever draws this waits for the first.
	if (!shown.length) return null;

	return (
		<div className={css.episodes}>
			{hasTabs && (
				<DetailsTabBar
					tabs={tabs}
					activeId={String(active)}
					expanded={false}
					onActivate={handleActivate}
					spotlightId={`${spotlightId}-seasons`}
					activeSpotlightId={`${spotlightId}-season`}
					className={css.seasonBar}
				/>
			)}
			{/* Keyed by season, so a new season opens at its first episode rather than where the last was scrolled to. */}
			<NouveauRail
				key={active}
				items={shown}
				gap={CARD_GAP}
				spotlightId={`${spotlightId}-rail`}
				navbarPosition={navbarPosition}
				onNavigateUp={handleUp}
				onNavigateDown={handleDown}
				renderItem={renderEpisode}
			/>
		</div>
	);
};

export default SeerrEpisodes;
