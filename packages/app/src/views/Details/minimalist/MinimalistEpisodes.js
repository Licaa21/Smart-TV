import {useCallback, useMemo, useState} from 'react';
import Spotlight from '@enact/spotlight';

import DetailsTabBar from '../../../components/DetailsTabBar';
import {RowContainer} from '../detailsSpottables';
import {effectiveSeason, groupEpisodesBySeason, seasonOptions} from '../nouveau/nouveauSeasons';
import NouveauRail from '../nouveau/sections/NouveauRail';
import MinimalistEpisodeCard from './MinimalistEpisodeCard';
import {minimalistCardUrl} from './minimalistRules';

import css from './MinimalistDetailContent.module.less';

// Whatever sits at the top of this section, which is the season tabs when there are seasons to
// choose between and the episode rail when there are not. Coming down from the buttons aims here,
// so it has to be something that is on screen either way.
export const EPISODES_ID = 'minimalist-episodes';

const SEASON_TABS_ID = 'minimalist-season-tabs';
const CARD_WIDTH = 266;
const CARD_IMAGE_HEIGHT = (CARD_WIDTH * 9) / 16;
const CARD_GAP = 20;

// Season tabs over a rail of episodes, and nothing else. The flow is one way on purpose: a tab picks
// the season and the rail follows.
const MinimalistEpisodes = ({
	item, settings, serverUrl, seasons = [], episodes = [], seriesEpisodes = [], onSelectEpisode
}) => {
	const [pickedSeason, setPickedSeason] = useState(null);

	// A season already carries its own episodes. A series, or one episode of one, is given the whole
	// run at once, so the tabs filter a list that is already here.
	const all = item.Type === 'Season' ? episodes : seriesEpisodes;

	const groups = useMemo(() => groupEpisodesBySeason(all), [all]);
	const numbers = useMemo(() => [...groups.keys()], [groups]);
	const tabs = useMemo(() => seasonOptions(groups, seasons), [groups, seasons]);
	// Landing on an episode opens its own season rather than the first one.
	const arrivedIn = item.Type === 'Episode' ? item.ParentIndexNumber : undefined;
	const activeSeason = effectiveSeason(numbers, pickedSeason, arrivedIn);
	// Held steady across renders, or the select handler below would be rebuilt every time.
	const seasonEpisodes = useMemo(() => groups.get(activeSeason) || [], [groups, activeSeason]);

	// One season is no choice at all, so the strip only earns its space when there is somewhere else
	// to go, and the rail takes over as the way in.
	const showsTabs = numbers.length > 1;

	const handleSeasonActivate = useCallback((id) => setPickedSeason(Number(id)), []);

	const handleSelect = useCallback((ev) => {
		const key = ev.currentTarget.dataset.selectKey;
		const episode = seasonEpisodes.find((candidate) => String(candidate.Id) === key);
		if (episode) onSelectEpisode(episode);
	}, [seasonEpisodes, onSelectEpisode]);

	// Up out of the rail lands on the tabs when there are any, and otherwise carries on to the
	// buttons, which is where the section starts without them.
	const handleNavigateUp = useCallback(() => {
		Spotlight.focus(showsTabs ? SEASON_TABS_ID : 'details-action-buttons');
	}, [showsTabs]);

	const renderEpisode = useCallback((episode) => (
		<MinimalistEpisodeCard
			imageUrl={minimalistCardUrl(serverUrl, episode, {settings, cardWidth: CARD_WIDTH})}
			title={episode.Name}
			number={episode.IndexNumber}
			watched={episode.UserData?.Played}
			width={CARD_WIDTH}
			imageHeight={CARD_IMAGE_HEIGHT}
			selectKey={episode.Id}
			onSelect={handleSelect}
			episode={episode}
			serverUrl={serverUrl}
		/>
	), [serverUrl, settings, handleSelect]);

	if (!seasonEpisodes.length) return null;

	return (
		<RowContainer className={css.episodes} spotlightId={EPISODES_ID}>
			{showsTabs && (
				<DetailsTabBar
					tabs={tabs}
					activeId={String(activeSeason)}
					expanded={false}
					onActivate={handleSeasonActivate}
					spotlightId={SEASON_TABS_ID}
					className={css.seasonBar}
				/>
			)}
			<NouveauRail
				items={seasonEpisodes}
				gap={CARD_GAP}
				spotlightId='minimalist-episode-rail'
				navbarPosition={settings.navbarPosition}
				onNavigateUp={handleNavigateUp}
				renderItem={renderEpisode}
				itemMenu
			/>
		</RowContainer>
	);
};

export default MinimalistEpisodes;
