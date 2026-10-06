import {useCallback} from 'react';

import * as achievementsApi from '../../../services/achievementsApi';
import {useAchievements} from '../../../context/AchievementsContext';
import {
	AchievementsView, AchievementsBadgesView, AchievementsBadgeView, AchievementsQuestsView,
	AchievementsLeaderboardView, AchievementsRecapView, AchievementsLibraryView,
	AchievementsLoadoutView, AchievementsShopView, AchievementsActivityView, AchievementsStatsView,
	AchievementsAppearanceView, useLoadOnOpen
} from './AchievementsViews';

// Every achievement screen renders from here so the one load survives moving between them. Each
// of them reads a slice of it, and only the leaderboard and the recap ask the server for
// anything more.
export const ACHIEVEMENT_VIEWS = [
	'achievements', 'achievementsBadges', 'achievementsBadge', 'achievementsQuests',
	'achievementsLeaderboard', 'achievementsRecap', 'achievementsLibrary', 'achievementsLoadout',
	'achievementsShop', 'achievementsActivity', 'achievementsStats', 'achievementsAppearance'
];

const AchievementsScreens = ({view, badgeId, onOpen, onSelectItem}) => {
	const {data: overview, loading, reload} = useLoadOnOpen(achievementsApi.loadOverview);
	const {unlockToastsAvailable, socialAvailable} = useAchievements();

	const openBadge = useCallback(
		(id) => onOpen('achievementsBadge', `achievement-badge-${id}`, id),
		[onOpen]
	);

	if (view === 'achievementsBadges') {
		return (
			<AchievementsBadgesView
				badges={overview ? overview.badges : []}
				onOpenBadge={openBadge}
			/>
		);
	}
	if (view === 'achievementsBadge') {
		const badge = (overview ? overview.badges : []).find((entry) => entry.id === badgeId);
		return badge ? <AchievementsBadgeView badge={badge} onSelectItem={onSelectItem} /> : null;
	}
	if (view === 'achievementsQuests') {
		return <AchievementsQuestsView quests={overview && overview.quests ? overview.quests : {daily: [], weekly: []}} />;
	}
	if (view === 'achievementsLeaderboard') {
		return <AchievementsLeaderboardView initial={overview ? overview.leaderboard : []} />;
	}
	if (view === 'achievementsRecap') {
		return <AchievementsRecapView initial={overview ? overview.recap : null} />;
	}
	if (view === 'achievementsLoadout') {
		return <AchievementsLoadoutView onOpen={onOpen} />;
	}
	if (view === 'achievementsShop') {
		return <AchievementsShopView />;
	}
	if (view === 'achievementsActivity') {
		return <AchievementsActivityView />;
	}
	if (view === 'achievementsStats') {
		return <AchievementsStatsView />;
	}
	if (view === 'achievementsAppearance') {
		return <AchievementsAppearanceView onChanged={reload} />;
	}
	if (view === 'achievementsLibrary') {
		return <AchievementsLibraryView completion={overview ? overview.libraryCompletion : {}} />;
	}

	return <AchievementsView overview={overview} loading={loading} onReload={reload} onOpen={onOpen} unlockToastsAvailable={unlockToastsAvailable} socialAvailable={socialAvailable} />;
};

export default AchievementsScreens;
