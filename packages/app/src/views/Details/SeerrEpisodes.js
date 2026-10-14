import {useCallback, useMemo, useState} from 'react';
import $L from '@enact/i18n/$L';
import Spotlight from '@enact/spotlight';

import DetailsTabBar from '../../components/DetailsTabBar';
import {appLocale} from '../../utils/appLocale';
import {episodeCardTitle} from '../../utils/episodeCardTitle';
import {formatDuration} from '../../utils/helpers';
import {KEYS} from '../../utils/keys';
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
	// The episode opened with OK, which shows its whole description rather than the first lines of it.
	const [openId, setOpenId] = useState(null);

	const groups = useMemo(() => groupEpisodesBySeason(episodes), [episodes]);
	const numbers = useMemo(() => [...groups.keys()], [groups]);
	const tabs = useMemo(() => seasonOptions(groups, seasons), [groups, seasons]);
	// Specials sort first, but a viewer opens a show on its first real season.
	const active = effectiveSeason(numbers, picked, numbers.find((number) => number > 0));
	// Held steady across renders so the rail does not rebuild its cards every time.
	const shown = useMemo(() => groups.get(active) || [], [groups, active]);

	const handleActivate = useCallback((id) => {
		setPicked(Number(id));
		setOpenId(null);
	}, []);
	const handleToggle = useCallback((ev) => {
		const id = ev.currentTarget.dataset.episodeId;
		setOpenId((current) => (current === id ? null : id));
	}, []);

	// The rail keeps up and down for itself and hands them back, so leaving it is decided here: up to
	// the season tabs when there are some, and otherwise wherever the page puts focus.
	const hasTabs = tabs.length > 1;
	const handleUp = useCallback(() => {
		if (onNavigateUp) onNavigateUp();
		else if (!hasTabs || !Spotlight.focus(`${spotlightId}-season`)) Spotlight.move('up');
	}, [onNavigateUp, hasTabs, spotlightId]);
	const handleDown = useCallback(() => Spotlight.move('down'), []);

	// Down from the season bar goes to the episodes. The Classic page moves between its sections on
	// up and down, and would otherwise take this press and step past the episodes to the next one.
	const handleTabsKeyDown = useCallback((ev) => {
		if (ev.keyCode !== KEYS.DOWN) return;
		if (Spotlight.focus(`${spotlightId}-rail`)) {
			ev.preventDefault();
			ev.stopPropagation();
		}
	}, [spotlightId]);

	const renderEpisode = useCallback((episode, index) => {
		const meta = [
			airDateText(episode),
			episode.RunTimeTicks ? formatDuration(episode.RunTimeTicks) : '',
			episode.CommunityRating ? `\u2605 ${Number(episode.CommunityRating).toFixed(1)}` : ''
		].filter(Boolean).join(' \u00b7 ');
		const open = openId === episode.Id;
		// An episode that has not aired has no description yet, which is nothing to point out on every card.
		const unaired = episode.PremiereDate && new Date(episode.PremiereDate).getTime() > Date.now();
		return (
			// The first card is where the row is entered from the sections above and below it.
			<SpottableDiv
				className={`${css.card} ${open ? css.cardOpen : ''}`}
				style={{width: `${CARD_WIDTH}px`}}
				spotlightId={index === 0 ? firstSpotlightId : undefined}
				data-current={index === 0 ? 'true' : undefined}
				data-episode-id={episode.Id}
				onClick={handleToggle}
			>
				<div className={css.still}>
					{episode._externalPosterUrl ? <img src={episode._externalPosterUrl} alt="" /> : <div className={css.noStill} />}
				</div>
				<div className={css.title}>{episodeCardTitle(episode.Name, episode.IndexNumber)}</div>
				{meta && <div className={css.meta}>{meta}</div>}
				{!hidesMediaDescription(episode, settings) && (episode.Overview || !unaired) && (
					<div className={css.overview}>{episode.Overview || $L('No description available.')}</div>
				)}
			</SpottableDiv>
		);
	}, [openId, handleToggle, firstSpotlightId, settings]);

	// The episodes arrive a season at a time, and whoever draws this waits for the first.
	if (!shown.length) return null;

	return (
		<div className={css.episodes}>
			{hasTabs && (
				<div onKeyDown={handleTabsKeyDown}>
					<DetailsTabBar
						tabs={tabs}
						activeId={String(active)}
						expanded={false}
						onActivate={handleActivate}
						spotlightId={`${spotlightId}-seasons`}
						activeSpotlightId={`${spotlightId}-season`}
						className={css.seasonBar}
					/>
				</div>
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
