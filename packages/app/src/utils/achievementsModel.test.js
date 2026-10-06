import {
	groupBadges, leaderboardValue, parseBadge, parseLeaderboardEntry, parseLibraryCompletion,
	parseBadgeChase, parseQuest, parseQuests, parseRank, parseRecap, parseRerolledQuests,
	parseSummary, parsePowerUpState, parseShopCatalog, parseActivityFeed, parseCounters,
	parseWatchClock, parseServerStats, statsAreEmpty, parseCosmeticCatalog, buildCosmeticLoadout,
	cosmeticsOf, equippedCosmetic, ownsCosmetic, wornAvatarIcon, wornTitle, cosmeticsAreEmpty,
	wearingCosmetic, boughtCosmetic, COSMETIC_AVATAR, COSMETIC_RANK_TITLE,
	parseHexColor, rarityColor, scoreForRarity, parseUnlockToastSettings,
	parseFriendsList, parseThread, parseMessage, parseConversation, threadHasNewFromOthers, sameUserId
} from './achievementsModel';

const badge = (over) => parseBadge({
	Id: 'first-contact',
	Title: 'First Contact',
	Description: 'Watch your first item.',
	Icon: 'play_circle',
	Category: 'Getting Started',
	Rarity: 'Common',
	Unlocked: false,
	CurrentValue: 0,
	TargetValue: 1,
	...over
});

describe('scoreForRarity', () => {
	test('pays out by rarity, whatever case the plugin wrote it in', () => {
		expect(scoreForRarity('Common')).toBe(10);
		expect(scoreForRarity('uncommon')).toBe(20);
		expect(scoreForRarity(' Rare ')).toBe(35);
		expect(scoreForRarity('EPIC')).toBe(60);
		expect(scoreForRarity('Legendary')).toBe(100);
		expect(scoreForRarity('Mythic')).toBe(150);
	});

	test('treats a rarity it has never heard of as the cheapest one', () => {
		expect(scoreForRarity('Transcendent')).toBe(10);
		expect(scoreForRarity('')).toBe(10);
		expect(scoreForRarity(undefined)).toBe(10);
	});
});

describe('rarityColor', () => {
	test('gives each tier its own hue and anything unknown the common one', () => {
		expect(rarityColor('Legendary')).toBe('#FF9800');
		expect(rarityColor('mythic')).toBe('#E91E63');
		expect(rarityColor('Transcendent')).toBe('#9AA5B1');
	});
});

describe('parseUnlockToastSettings', () => {
	test('reads the plugin flags, with everything on and ungrouped only when it says so', () => {
		const settings = parseUnlockToastSettings({});
		expect(settings.enabled).toBe(true);
		expect(settings.minimumRarity).toBe('all');
		expect(settings.grouped).toBe(true);
		expect(settings.muteDuringPlayback).toBe(false);
		expect(parseUnlockToastSettings({EnableUnlockToasts: false, UnlockToastGrouping: 'individual', MuteToastsDuringPlayback: true}))
			.toMatchObject({enabled: false, grouped: false, muteDuringPlayback: true});
	});

	test('ranks rarities against the minimum the way the plugin does', () => {
		const rare = parseUnlockToastSettings({MinimumToastRarity: 'Rare'});
		expect(rare.allows('Common')).toBe(false);
		expect(rare.allows('rare')).toBe(true);
		expect(rare.allows('Legendary')).toBe(true);
		expect(parseUnlockToastSettings({MinimumToastRarity: 'all'}).allows('Common')).toBe(true);
	});
});

describe('parseHexColor', () => {
	test('takes six hex digits with or without the hash', () => {
		expect(parseHexColor('#2196f3')).toBe('#2196f3');
		expect(parseHexColor('2196F3')).toBe('#2196F3');
	});

	test('refuses anything else, so the caller keeps its own colour', () => {
		expect(parseHexColor('#abc')).toBeNull();
		expect(parseHexColor('#12345g')).toBeNull();
		expect(parseHexColor('')).toBeNull();
		expect(parseHexColor(null)).toBeNull();
	});
});

describe('parseBadge', () => {
	test('reads the plugin PascalCase names', () => {
		const item = badge({Unlocked: true, UnlockedAt: '2026-09-01T12:00:00Z', Rarity: 'Epic'});
		expect(item.id).toBe('first-contact');
		expect(item.title).toBe('First Contact');
		expect(item.category).toBe('Getting Started');
		expect(item.unlocked).toBe(true);
		expect(item.unlockedAt).toBeInstanceOf(Date);
		expect(item.score).toBe(60);
	});

	test('a locked badge keeps its progress and has no date at all', () => {
		const item = badge({CurrentValue: 4, TargetValue: 10});
		expect(item.unlockedAt).toBeNull();
		expect(item.progress).toBeCloseTo(0.4, 5);
	});

	test('an unlocked badge is finished whatever the counters say', () => {
		expect(badge({Unlocked: true, CurrentValue: 0, TargetValue: 10}).progress).toBe(1);
	});

	test('a badge that is only a flag has nothing to show progress against', () => {
		expect(badge({TargetValue: 0}).progress).toBe(0);
	});

	test('the mask on a locked title is the only sign a badge is secret', () => {
		expect(badge({Title: '???'}).isSecret).toBe(true);
		expect(badge({Title: '???', Unlocked: true}).isSecret).toBe(false);
		expect(badge({Description: '???'}).descriptionHidden).toBe(true);
	});

	test('a date it cannot read is no date rather than a crash', () => {
		expect(badge({Unlocked: true, UnlockedAt: 'not a date'}).unlockedAt).toBeNull();
	});
});

describe('parseSummary and parseRank', () => {
	test('reads a summary and leaves out what it has no use for', () => {
		const summary = parseSummary({Unlocked: 12, Total: 200, Percentage: 6, Score: 430, CurrentWatchStreak: 3, BestWatchStreak: 9, EquippedCount: 5});
		expect(summary).toEqual({unlocked: 12, total: 200, percentage: 6, score: 430, currentWatchStreak: 3, bestWatchStreak: 9});
	});

	test('a rank at the top has no next tier', () => {
		const rank = parseRank({Score: 9000, Tier: {Name: 'Maestro', MinScore: 8000, Color: '#fff000', Icon: 'star'}, ProgressToNext: 100});
		expect(rank.tier.name).toBe('Maestro');
		expect(rank.nextTier).toBeNull();
	});

	test('a missing tier still draws rather than coming back as nothing', () => {
		expect(parseRank({Score: 0}).tier).toEqual({name: '', minScore: 0, color: '', icon: ''});
	});
});

describe('parseQuests', () => {
	test('splits the two kinds and works out how far each has got', () => {
		const quests = parseQuests({
			Daily: [{Id: 'd1', Title: 'Movie Night', Reward: 30, Target: 4, Current: 1, Completed: false}],
			Weekly: []
		});
		expect(quests.daily[0].progress).toBeCloseTo(0.25, 5);
		expect(quests.weekly).toEqual([]);
		expect(quests.isEmpty).toBe(false);
	});

	test('knows when there is nothing to show', () => {
		expect(parseQuests({Daily: [], Weekly: []}).isEmpty).toBe(true);
		expect(parseQuests(null)).toBeNull();
	});

	test('a finished quest is full however the counters read', () => {
		expect(parseQuest({Completed: true, Current: 0, Target: 5}).progress).toBe(1);
	});

	test('carries what is left to reroll on each set', () => {
		const quests = parseQuests({Daily: [], Weekly: [], DailyRerollsRemaining: 1, WeeklyRerollsRemaining: 0});
		expect(quests.dailyRerollsLeft).toBe(1);
		expect(quests.weeklyRerollsLeft).toBe(0);
	});

	// A plugin too old to report the allowance offers nothing rather than a free reroll.
	test('an allowance the plugin never mentions is none', () => {
		const quests = parseQuests({Daily: [], Weekly: []});
		expect(quests.dailyRerollsLeft).toBe(0);
		expect(quests.weeklyRerollsLeft).toBe(0);
	});
});

describe('parseRerolledQuests', () => {
	test('reads the replacement set and what is left, so nothing needs refetching', () => {
		const result = parseRerolledQuests({
			Quests: [{Id: 'd1', Title: 'A fresh day', Target: 2, Current: 0, Reward: 30}],
			RerollsRemaining: 0
		});
		expect(result.quests).toHaveLength(1);
		expect(result.quests[0].title).toBe('A fresh day');
		expect(result.rerollsLeft).toBe(0);
	});

	test('an answer carrying no list is no quests rather than a crash', () => {
		expect(parseRerolledQuests({}).quests).toEqual([]);
		expect(parseRerolledQuests({}).rerollsLeft).toBe(0);
	});
});

describe('parseBadgeChase', () => {
	test('reads the progress envelope and the items under it', () => {
		const chase = parseBadgeChase({
			Progress: {Current: 4, Target: 10},
			Items: [{Id: 'item-1', Name: 'Trolls Band Together', Type: 'Movie', Year: 2023, RunTimeMinutes: 91}]
		});
		expect(chase.current).toBe(4);
		expect(chase.target).toBe(10);
		expect(chase.items[0]).toEqual({
			id: 'item-1', name: 'Trolls Band Together', type: 'Movie', year: 2023, runtimeMinutes: 91
		});
	});

	test('an answer with nothing to suggest still reads', () => {
		const chase = parseBadgeChase({Progress: {Current: 0, Target: 5}});
		expect(chase.items).toEqual([]);
		expect(chase.target).toBe(5);
	});

	test('a missing progress envelope reads as no progress', () => {
		expect(parseBadgeChase({})).toEqual({current: 0, target: 0, items: []});
	});

	test('a year or runtime the server does not hold reads as zero', () => {
		const chase = parseBadgeChase({Items: [{Id: 'x', Name: 'Untitled', Type: 'Video'}]});
		expect(chase.items[0].year).toBe(0);
		expect(chase.items[0].runtimeMinutes).toBe(0);
	});
});

describe('parsePowerUpState', () => {
	test('reads the bank and the inventory under it', () => {
		const state = parsePowerUpState({
			ScoreBank: 1240,
			Inventory: [{Type: 'XpBoost', Icon: 'bolt', Count: 2, Active: true}]
		});
		expect(state.bank).toBe(1240);
		expect(state.slots[0].type).toBe('XpBoost');
		expect(state.slots[0].icon).toBe('bolt');
		expect(state.slots[0].count).toBe(2);
		expect(state.slots[0].active).toBe(true);
	});

	test('a slot the plugin left bare reads as held but idle', () => {
		const state = parsePowerUpState({Inventory: [{Type: 'StreakFreeze', Count: 1}]});
		expect(state.slots[0].icon).toBe('');
		expect(state.slots[0].active).toBe(false);
		expect(state.bank).toBe(0);
	});

	test('an empty answer is a bank of nothing', () => {
		expect(parsePowerUpState({})).toEqual({bank: 0, slots: []});
	});
});

describe('cosmetics', () => {
	const CATALOG = {
		Cosmetics: [
			{Id: 'avatar-medal', Kind: 'Avatar', DisplayName: 'Medal', PriceScore: 0, PreviewIcon: 'military_tech'},
			{Id: 'avatar-crown', Kind: 'Avatar', DisplayName: 'Crown', PriceScore: 350, PreviewIcon: 'auto_awesome'},
			{Id: 'title-legend', Kind: 'RankTitle', DisplayName: 'Legend', PriceScore: 0, MilestoneScore: 7500, PreviewIcon: 'workspace_premium'},
			{Id: 'theme-sunset', Kind: 'ProfileTheme', DisplayName: 'Sunset', PriceScore: 250}
		]
	};

	const loadout = (state) => buildCosmeticLoadout(parseCosmeticCatalog(CATALOG), state);

	test('only the kinds this panel can draw are read', () => {
		const items = parseCosmeticCatalog(CATALOG);
		expect(items.map((item) => item.id)).toEqual(['avatar-medal', 'avatar-crown', 'title-legend']);
	});

	test('an id with a closer icon takes it, and anything else keeps the server one', () => {
		const items = parseCosmeticCatalog(CATALOG);
		expect(items.find((item) => item.id === 'avatar-crown').icon).toBe('crown');
		expect(items.find((item) => item.id === 'avatar-medal').icon).toBe('military_tech');
	});

	test('a free one is the starting look and a milestone one has to be earned', () => {
		const items = parseCosmeticCatalog(CATALOG);
		const medal = items.find((item) => item.id === 'avatar-medal');
		const legend = items.find((item) => item.id === 'title-legend');

		expect(medal.isDefault).toBe(true);
		expect(medal.isEarned).toBe(false);
		expect(legend.isEarned).toBe(true);
		expect(legend.isDefault).toBe(false);
	});

	test('the profile state is joined to the catalogue', () => {
		const worn = loadout({
			Owned: ['avatar-medal', 'avatar-crown'],
			EquippedAvatarId: 'avatar-crown',
			LifetimeScore: 3000,
			ScoreBank: 225
		});

		expect(cosmeticsOf(worn, COSMETIC_AVATAR)).toHaveLength(2);
		expect(cosmeticsOf(worn, COSMETIC_RANK_TITLE)).toHaveLength(1);
		expect(equippedCosmetic(worn, COSMETIC_AVATAR)).toBe('avatar-crown');
		expect(equippedCosmetic(worn, COSMETIC_RANK_TITLE)).toBeNull();
		expect(worn.lifetimeScore).toBe(3000);
		expect(worn.bank).toBe(225);
	});

	test('the free one counts as owned even when the server leaves it off the list', () => {
		const worn = loadout({Owned: []});
		const [medal, crown] = cosmeticsOf(worn, COSMETIC_AVATAR);

		expect(ownsCosmetic(worn, medal)).toBe(true);
		expect(ownsCosmetic(worn, crown)).toBe(false);
	});

	test('the header wears what is equipped and keeps the tier otherwise', () => {
		const dressed = loadout({EquippedAvatarId: 'avatar-crown', EquippedCustomTitleId: 'title-legend'});
		expect(wornAvatarIcon(dressed)).toBe('crown');
		expect(wornTitle(dressed)).toBe('Legend');

		const bare = loadout({EquippedAvatarId: '', EquippedCustomTitleId: ''});
		expect(wornAvatarIcon(bare)).toBeNull();
		expect(wornTitle(bare)).toBeNull();
	});

	test('a profile the plugin has never held still reads', () => {
		const worn = loadout(null);
		expect(worn.owned).toEqual([]);
		expect(worn.bank).toBe(0);
		expect(cosmeticsAreEmpty(worn)).toBe(false);
	});

	test('a catalogue with none of these kinds has nothing to wear', () => {
		const worn = buildCosmeticLoadout(parseCosmeticCatalog({Cosmetics: [{Id: 'bg-none', Kind: 'Background'}]}), null);
		expect(cosmeticsAreEmpty(worn)).toBe(true);
	});

	test('wearing one fills only its own slot, and null empties it', () => {
		const worn = loadout({EquippedAvatarId: 'avatar-medal', EquippedCustomTitleId: 'title-legend'});

		const swapped = wearingCosmetic(worn, COSMETIC_AVATAR, 'avatar-crown');
		expect(swapped.avatarId).toBe('avatar-crown');
		expect(swapped.titleId).toBe('title-legend');

		expect(wearingCosmetic(worn, COSMETIC_RANK_TITLE, null).titleId).toBeNull();
		expect(wearingCosmetic(worn, COSMETIC_RANK_TITLE, null).avatarId).toBe('avatar-medal');
	});

	test('buying one is held straight away, and the bank stands when none came back', () => {
		const worn = loadout({Owned: ['avatar-medal'], ScoreBank: 400});

		expect(boughtCosmetic(worn, 'avatar-crown', 50).owned).toEqual(['avatar-medal', 'avatar-crown']);
		expect(boughtCosmetic(worn, 'avatar-crown', 50).bank).toBe(50);
		expect(boughtCosmetic(worn, 'avatar-crown', null).bank).toBe(400);
	});
});

describe('stats', () => {
	test('a counter that is not a number is dropped rather than shown as one', () => {
		expect(parseCounters({TotalItemsWatched: 5, LongestItemMinutes: 21.4, MostCommonBadge: 'First Contact'}))
			.toEqual({TotalItemsWatched: 5, LongestItemMinutes: 21});
	});

	test('the clock keys come back as hours rather than the strings they arrived as', () => {
		expect(parseWatchClock({0: 0, 21: 4, notAnHour: 9})).toEqual({0: 0, 21: 4});
	});

	test('the server figures read into one shape', () => {
		const server = parseServerStats({
			TotalUsers: 3, TotalBadgesUnlocked: 17, TotalItemsWatched: 11, TotalMoviesWatched: 1,
			TotalSeriesCompleted: 0, MostCommonBadge: 'First Contact', TotalAchievementScore: 290
		});
		expect(server).toEqual({
			users: 3, badgesUnlocked: 17, itemsWatched: 11, moviesWatched: 1,
			seriesCompleted: 0, score: 290, mostCommonBadge: 'First Contact'
		});
	});

	test('nothing anywhere is an empty screen, but one counter is not', () => {
		expect(statsAreEmpty({records: {}, watchClock: {}, server: null})).toBe(true);
		expect(statsAreEmpty({records: {DaysWatched: 0}, watchClock: {}, server: null})).toBe(false);
		expect(statsAreEmpty({records: {}, watchClock: {}, server: {users: 3}})).toBe(false);
	});
});

describe('parseActivityFeed', () => {
	test('reads a row and leaves the paging and the ids behind', () => {
		const entries = parseActivityFeed({
			Page: 1,
			TotalEntries: 14,
			Entries: [{
				At: '2026-09-18T05:01:48Z', UserId: 'u1', UserName: 'moonfin', BadgeId: 'media-explorer',
				Title: 'Media Explorer', Rarity: 'Common', Icon: 'travel_explore', Category: 'Getting Started'
			}]
		});
		expect(entries).toEqual([{
			at: new Date('2026-09-18T05:01:48Z'),
			userName: 'moonfin',
			badgeTitle: 'Media Explorer',
			rarity: 'Common',
			icon: 'travel_explore'
		}]);
	});

	test('a row without a timestamp still reads', () => {
		const entries = parseActivityFeed({Entries: [{UserName: 'Ada', Title: 'First Contact'}]});
		expect(entries[0].at).toBeNull();
		expect(entries[0].userName).toBe('Ada');
	});

	test('a feed with nothing in it is nothing', () => {
		expect(parseActivityFeed({})).toEqual([]);
	});
});

describe('parseShopCatalog', () => {
	test('the cosmetics the panel cannot draw are left behind', () => {
		const items = parseShopCatalog({
			PowerUps: [{Id: 'pu-xp-boost-3', Type: 'XpBoost', BundleSize: 3, PriceScore: 130}],
			Cosmetics: [{Id: 'theme-sunset', Kind: 'ProfileTheme', PriceScore: 250}]
		});
		expect(items).toEqual([{id: 'pu-xp-boost-3', type: 'XpBoost', bundleSize: 3, priceScore: 130}]);
	});

	test('a catalogue with nothing in it sells nothing', () => {
		expect(parseShopCatalog({})).toEqual([]);
	});
});

describe('parseLeaderboardEntry', () => {
	test('an overall row carries a score and a badge count', () => {
		const entry = parseLeaderboardEntry({UserId: 'u1', UserName: 'Ada', Score: 430, Unlocked: 12, Total: 200});
		expect(entry.score).toBe(430);
		expect(entry.value).toBeNull();
		expect(leaderboardValue(entry)).toBe(430);
	});

	test('a category row carries one value and leaves the rest out', () => {
		const entry = parseLeaderboardEntry({UserId: 'u1', UserName: 'Ada', Value: 42});
		expect(entry.value).toBe(42);
		expect(entry.score).toBeNull();
		expect(entry.unlocked).toBeNull();
		expect(leaderboardValue(entry)).toBe(42);
	});

	// A key that is there but zero is a real zero, which is why presence decides this and not
	// whether the number is truthy.
	test('a zero that was sent is kept, and a key that was not sent is not', () => {
		const zero = parseLeaderboardEntry({UserId: 'u1', UserName: 'Ada', Score: 0});
		expect(zero.score).toBe(0);
		expect(leaderboardValue(zero)).toBe(0);
		expect(parseLeaderboardEntry({UserId: 'u1', UserName: 'Ada'}).score).toBeNull();
	});

	test('an empty shop title reads as none', () => {
		expect(parseLeaderboardEntry({CustomTitle: ''}).customTitle).toBeNull();
		expect(parseLeaderboardEntry({CustomTitle: 'The Completionist'}).customTitle).toBe('The Completionist');
	});
});

describe('parseRecap and parseLibraryCompletion', () => {
	test('reads the counts the recap carries', () => {
		const recap = parseRecap({
			Period: 'year', MoviesWatched: 4, EpisodesWatched: 18, DaysWatched: 11, BadgesUnlocked: 2,
			TopGenres: [{Name: 'Drama', Count: 9}], TopDirectors: [], TopActors: []
		});
		expect(recap.period).toBe('year');
		expect(recap.topGenres).toEqual([{name: 'Drama', count: 9}]);
		expect(recap.topDirectors).toEqual([]);
	});

	test('rounds each library percent and drops anything that is not a number', () => {
		expect(parseLibraryCompletion({LibraryCompletionPercents: {Movies: 62.6, Shows: 12, Books: 'lots'}}))
			.toEqual({Movies: 63, Shows: 12});
	});

	test('an empty envelope is no libraries', () => {
		expect(parseLibraryCompletion({LibraryCompletionPercents: {}})).toEqual({});
		expect(parseLibraryCompletion(null)).toEqual({});
	});
});

describe('groupBadges', () => {
	const badges = [
		badge({Id: 'a', Category: 'Getting Started', Unlocked: true}),
		badge({Id: 'b', Category: 'Binge'}),
		badge({Id: 'c', Category: 'Binge'}),
		badge({Id: 'd', Category: ''})
	];

	test('sorts the groups and counts what is unlocked in each', () => {
		const groups = groupBadges(badges, 'all', 'Other');
		expect(groups.map((group) => group.category)).toEqual(['Binge', 'Getting Started', 'Other']);
		expect(groups[1].unlocked).toBe(1);
		expect(groups[0].badges.map((item) => item.id)).toEqual(['b', 'c']);
	});

	// Filtering runs before grouping, so the only unlocked badge takes its category off the list
	// with it rather than leaving an empty heading behind.
	test('a category the filter emptied leaves the list', () => {
		expect(groupBadges(badges, 'locked', 'Other').map((group) => group.category))
			.toEqual(['Binge', 'Other']);
		expect(groupBadges(badges, 'unlocked', 'Other').map((group) => group.category))
			.toEqual(['Getting Started']);
	});

	test('a badge with no category of its own goes in the named bucket', () => {
		const groups = groupBadges([badges[3]], 'all', 'Elsewhere');
		expect(groups[0].category).toBe('Elsewhere');
	});
});

describe('friends and chat', () => {
	test('matches user ids with and without their dashes', () => {
		expect(sameUserId('ca44e8df-5139-4da3-bc13-5461b9ec62d8', 'CA44E8DF51394DA3BC135461B9EC62D8')).toBe(true);
		expect(sameUserId('a', 'b')).toBe(false);
	});

	test('reads the friends list and answers who is a friend or pending', () => {
		const list = parseFriendsList({
			Friends: [{UserId: 'f1', UserName: 'Ada', Online: true, NowPlaying: {Id: 'm1', Name: 'Heat'}}],
			Incoming: [{UserId: 'i1', UserName: 'Bob'}],
			Outgoing: [{UserId: 'o1', UserName: 'Cy'}],
			SimpleMode: false
		});
		expect(list.friends[0].nowPlaying.name).toBe('Heat');
		expect(list.isFriend('F1')).toBe(true);
		expect(list.isPending('o1')).toBe(true);
		expect(list.isPending('f1')).toBe(false);
	});

	test('reads the camelCase chat payloads', () => {
		const thread = parseThread({conversationId: 'c1', type: 'group', otherUserName: 'Crew', participants: [{userId: 'u1', userName: 'Ada'}], lastMessage: 'hi', lastFromMe: false, unreadCount: 2, hasAttachment: false});
		expect(thread).toMatchObject({conversationId: 'c1', isGroup: true, name: 'Crew', unreadCount: 2});
		expect(thread.participants[0].userName).toBe('Ada');

		const group = parseConversation({id: 'c1', type: 'group', title: 'Crew', participantIds: ['u1', 'u2'], createdByUserId: 'u1', adminIds: ['u2']});
		expect(group.isOwner('u1')).toBe(true);
		expect(group.isAdmin('u2')).toBe(true);
		expect(group.isAdmin('u3')).toBe(false);
	});

	test('a message counts as read once anyone but its sender read it', () => {
		expect(parseMessage({id: 'm1', fromUserId: 'u1', text: 'hi', readBy: ['u1']}).isRead).toBe(false);
		expect(parseMessage({id: 'm1', fromUserId: 'u1', text: 'hi', readBy: ['u1', 'u2']}).isRead).toBe(true);
		expect(parseMessage({id: 'm1', fromUserId: 'u1', text: 'hi', readAt: '2026-10-05T10:00:00Z'}).isRead).toBe(true);
	});

	test('only a thread that grew since the last read, from someone else, outside the open chat, is new', () => {
		const before = parseThread({conversationId: 'c1', unreadCount: 1, lastAt: '2026-10-05T10:00:00Z'});
		const grown = parseThread({conversationId: 'c1', unreadCount: 2, lastAt: '2026-10-05T10:01:00Z'});
		expect(threadHasNewFromOthers(grown, before, null)).toBe(true);
		expect(threadHasNewFromOthers(grown, grown, null)).toBe(false);
		expect(threadHasNewFromOthers(grown, before, 'c1')).toBe(false);
		expect(threadHasNewFromOthers(parseThread({conversationId: 'c1', unreadCount: 2, lastFromMe: true}), before, null)).toBe(false);
		expect(threadHasNewFromOthers(parseThread({conversationId: 'c2', unreadCount: 1}), undefined, null)).toBe(true);
	});
});
