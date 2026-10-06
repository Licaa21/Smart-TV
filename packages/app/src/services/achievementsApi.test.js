import {platformFetch} from './secureFetch';
import * as api from './achievementsApi';

jest.mock('./secureFetch', () => ({platformFetch: jest.fn()}));

let mockServerUrl = 'http://badges.test';
let mockToken = 'mockToken';
let mockUserId = 'user1';
let mockServerType = 'jellyfin';

jest.mock('./jellyfinApi', () => ({
	getServerUrl: () => mockServerUrl,
	getAuthHeader: () => 'MediaBrowser Token="mockToken"',
	getApiKey: () => mockToken,
	getUserId: () => mockUserId,
	getServerType: () => mockServerType,
	getDeviceId: () => 'tv-1'
}));

jest.mock('../utils/serverRoutes', () => ({legacyAuthHeader: () => ({})}));

const ok = (body) => ({ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(body))});
const missing = {ok: false, status: 404, text: () => Promise.resolve('')};

// The plugin's own route shapes, matched by suffix so a path carrying a query still finds one.
const serve = (routes) => {
	platformFetch.mockImplementation((url) => {
		const path = url.split('/Plugins/AchievementBadges/')[1];
		const match = Object.keys(routes).find((suffix) => path === suffix || path.startsWith(`${suffix}?`));
		return Promise.resolve(match ? ok(routes[match]) : missing);
	});
};

const paths = () => platformFetch.mock.calls.map((call) => call[0].split('/Plugins/AchievementBadges/')[1]);

const CONFIG = {LeaderboardEnabled: true, QuestsEnabled: true};

// One reroll a day and one a week, the same budget the plugin grants.
let rerollsLeft = {daily: 1, weekly: 1};
const serveWithReroll = (routes) => {
	platformFetch.mockImplementation((url) => {
		const path = url.split('/Plugins/AchievementBadges/')[1];
		const set = /quests\/(daily|weekly)\/reroll$/.exec(path);
		if (set) {
			const which = set[1];
			if (rerollsLeft[which] <= 0) return Promise.resolve({ok: false, status: 429, text: () => Promise.resolve('')});
			rerollsLeft[which] = 0;
			return Promise.resolve(ok({
				Quests: [{Id: `${which}-new`, Title: which === 'weekly' ? 'A fresh week' : 'A fresh day', Target: 1, Current: 0, Reward: 10}],
				RerollsRemaining: 0
			}));
		}
		const match = Object.keys(routes).find((suffix) => path === suffix || path.startsWith(`${suffix}?`));
		return Promise.resolve(match ? ok(routes[match]) : missing);
	});
};
const FULL = {
	'public-config': CONFIG,
	'users/user1/summary': {Unlocked: 12, Total: 200, Percentage: 6, Score: 430, CurrentWatchStreak: 3, BestWatchStreak: 9},
	'users/user1/rank': {Score: 430, Tier: {Name: 'Viewer', MinScore: 300, Color: '#2196f3', Icon: 'visibility'}, NextTier: {Name: 'Regular', MinScore: 700, Color: '#03a9f4', Icon: 'person'}, ProgressToNext: 32},
	'users/user1': [{Id: 'first-contact', Title: 'First Contact', Rarity: 'Common', Unlocked: true, UnlockedAt: '2026-09-01T00:00:00Z', Category: 'Getting Started', CurrentValue: 1, TargetValue: 1}],
	'users/user1/equipped': [{Id: 'first-contact', Title: 'First Contact', Rarity: 'Common', Unlocked: true}],
	'users/user1/quests': {Daily: [{Id: 'd1', Title: 'Movie Night', Reward: 30, Target: 1, Current: 0, Completed: false}], Weekly: []},
	'leaderboard': [{UserId: 'u1', UserName: 'Ada', Score: 430, Unlocked: 12, Total: 200}],
	'users/user1/recap': {Period: 'month', MoviesWatched: 4, EpisodesWatched: 18, DaysWatched: 11, BadgesUnlocked: 2, TopGenres: [{Name: 'Drama', Count: 9}]},
	'users/user1/library-completion': {LibraryCompletionPercents: {Movies: 63, Shows: 12}}
};

beforeEach(() => {
	platformFetch.mockReset();
	mockServerUrl = 'http://badges.test';
	mockToken = 'mockToken';
	mockUserId = 'user1';
	mockServerType = 'jellyfin';
	rerollsLeft = {daily: 1, weekly: 1};
	api.reset();
});

describe('availability', () => {
	test('a server running the plugin is available and reports what the admin left on', async () => {
		serve({'public-config': {LeaderboardEnabled: true, QuestsEnabled: false, ActivityFeedEnabled: false}});
		expect(await api.probe()).toBe(true);
		expect(api.getFlags()).toEqual({leaderboardEnabled: true, questsEnabled: false, activityEnabled: false, unlockToastsEnabled: false, friendsEnabled: true, friendsSimpleMode: false});
	});

	// A plugin too old to report a flag still serves the section, so only a definite no turns
	// one off.
	test('a flag the plugin never mentions is still on', async () => {
		serve({'public-config': {}});
		await api.probe();
		expect(api.getFlags()).toEqual({leaderboardEnabled: true, questsEnabled: true, activityEnabled: true, unlockToastsEnabled: false, friendsEnabled: true, friendsSimpleMode: false});
	});

	// The unlock notifications need a route an older plugin does not have, so they stay off
	// until the plugin says it serves them.
	test('unlock notifications are on only when the plugin offers them', async () => {
		serve({'public-config': CONFIG, 'admin/ui-features': {EnableUnlockToasts: true}});
		await api.probe();
		expect(api.getFlags().unlockToastsEnabled).toBe(true);

		api.reset();
		serve({'public-config': CONFIG, 'admin/ui-features': {EnableUnlockToasts: false}});
		await api.probe();
		expect(api.getFlags().unlockToastsEnabled).toBe(false);
	});

	test('a server without the plugin is unavailable after one look', async () => {
		serve({});
		expect(await api.probe()).toBe(false);
		expect(paths()).toEqual(['public-config']);
	});

	test('an Emby server is never asked, since this is a Jellyfin plugin', async () => {
		mockServerType = 'emby';
		serve(FULL);
		expect(await api.probe()).toBe(false);
		expect(await api.loadOverview()).toBeNull();
		expect(platformFetch).not.toHaveBeenCalled();
	});

	test('a session with no token sends nothing', async () => {
		mockToken = null;
		serve(FULL);
		expect(await api.probe()).toBe(false);
		expect(platformFetch).not.toHaveBeenCalled();
	});

	test('reset puts the flags back, so they cannot survive a sign out', async () => {
		serve({'public-config': {LeaderboardEnabled: false, QuestsEnabled: false, ActivityFeedEnabled: false}});
		await api.probe();
		api.reset();
		expect(api.getFlags()).toEqual({leaderboardEnabled: true, questsEnabled: true, activityEnabled: true, unlockToastsEnabled: false, friendsEnabled: true, friendsSimpleMode: false});
	});
});

describe('overview', () => {
	test('reads the plugin PascalCase payloads into one shape', async () => {
		serve(FULL);
		await api.probe();
		const overview = await api.loadOverview();

		expect(overview.summary.unlocked).toBe(12);
		expect(overview.rank.tier.name).toBe('Viewer');
		expect(overview.rank.nextTier.name).toBe('Regular');
		expect(overview.badges).toHaveLength(1);
		expect(overview.equipped).toHaveLength(1);
		expect(overview.quests.daily).toHaveLength(1);
		expect(overview.leaderboard[0].userName).toBe('Ada');
		expect(overview.recap.moviesWatched).toBe(4);
		expect(overview.libraryCompletion).toEqual({Movies: 63, Shows: 12});
	});

	test('a section the admin switched off is not even asked for', async () => {
		serve({...FULL, 'public-config': {LeaderboardEnabled: false, QuestsEnabled: false}});
		await api.probe();
		const overview = await api.loadOverview();

		expect(overview.quests).toBeNull();
		expect(overview.leaderboard).toEqual([]);
		expect(paths().some((path) => path.indexOf('quests') >= 0)).toBe(false);
		expect(paths().some((path) => path.indexOf('leaderboard') >= 0)).toBe(false);
	});

	test('a plugin that answers nothing loads as nothing', async () => {
		serve({'public-config': CONFIG});
		await api.probe();
		expect(await api.loadOverview()).toBeNull();
	});

	test('a session without a user has nothing to load', async () => {
		mockUserId = null;
		serve(FULL);
		expect(await api.loadOverview()).toBeNull();
		expect(platformFetch).not.toHaveBeenCalled();
	});

	test('a trailing slash on the server address does not double up', async () => {
		mockServerUrl = 'http://badges.test/';
		serve(FULL);
		await api.probe();
		expect(platformFetch.mock.calls[0][0]).toBe('http://badges.test/Plugins/AchievementBadges/public-config');
	});

	test('a body that is not the shape asked for reads as no answer', async () => {
		platformFetch.mockResolvedValue(ok('a string, somehow'));
		await api.probe();
		expect(await api.loadOverview()).toBeNull();
	});

	test('a request that throws reads as no answer rather than breaking the screen', async () => {
		platformFetch.mockRejectedValue(new Error('network gone'));
		expect(await api.probe()).toBe(false);
		expect(await api.loadOverview()).toBeNull();
	});
});

describe('the boards and the recap', () => {
	test('an empty category asks for the overall board', async () => {
		serve(FULL);
		const entries = await api.fetchLeaderboard();
		expect(entries[0].score).toBe(430);
		expect(paths()).toEqual(['leaderboard?limit=10']);
	});

	test('a category board carries a value instead of a score', async () => {
		serve({'leaderboard/movies': [{UserId: 'u1', UserName: 'Ada', Value: 42}]});
		const entries = await api.fetchLeaderboard({category: 'movies'});
		expect(entries[0].value).toBe(42);
		expect(entries[0].score).toBeNull();
	});

	test('the board is not fetched when the admin turned it off', async () => {
		serve({...FULL, 'public-config': {LeaderboardEnabled: false}});
		await api.probe();
		platformFetch.mockClear();
		expect(await api.fetchLeaderboard()).toEqual([]);
		expect(platformFetch).not.toHaveBeenCalled();
	});

	test('the recap is refetched for the period asked for', async () => {
		serve({'users/user1/recap': {Period: 'year', DaysWatched: 11}});
		const recap = await api.fetchRecap('year');
		expect(recap.daysWatched).toBe(11);
		expect(paths()).toEqual(['users/user1/recap?period=year']);
	});
});

describe('the login ping', () => {
	test('is posted, since it is what keeps a daily streak alive', async () => {
		serve({'users/user1/login-ping': {}});
		await api.sendLoginPing();
		expect(platformFetch.mock.calls[0][0]).toBe('http://badges.test/Plugins/AchievementBadges/users/user1/login-ping');
		expect(platformFetch.mock.calls[0][1].method).toBe('POST');
	});

	test('has nowhere to go without a user', async () => {
		mockUserId = null;
		await api.sendLoginPing();
		expect(platformFetch).not.toHaveBeenCalled();
	});
});

describe('quest reroll', () => {
	test('a reroll swaps the set and spends the allowance', async () => {
		serveWithReroll(FULL);
		const result = await api.rerollQuests();

		expect(result.outcome).toBe('rerolled');
		expect(result.quests[0].title).toBe('A fresh day');
		expect(result.rerollsLeft).toBe(0);
		expect(paths()).toEqual(['users/user1/quests/daily/reroll']);
		expect(platformFetch.mock.calls[0][1].method).toBe('POST');
	});

	test('daily and weekly spend separately', async () => {
		serveWithReroll(FULL);
		await api.rerollQuests();

		const weekly = await api.rerollQuests({weekly: true});
		expect(weekly.outcome).toBe('rerolled');
		expect(weekly.quests[0].title).toBe('A fresh week');
	});

	test('a spent reroll reads as refused rather than broken', async () => {
		serveWithReroll(FULL);
		await api.rerollQuests();

		const again = await api.rerollQuests();
		expect(again.outcome).toBe('alreadyUsed');
		expect(again.quests).toBeUndefined();
	});

	test('anything else that goes wrong is a plain failure', async () => {
		platformFetch.mockResolvedValue({ok: false, status: 500, text: () => Promise.resolve('')});
		expect((await api.rerollQuests()).outcome).toBe('failed');

		platformFetch.mockRejectedValue(new Error('network gone'));
		expect((await api.rerollQuests()).outcome).toBe('failed');
	});

	test('a session without a user has nothing to reroll', async () => {
		mockUserId = null;
		serveWithReroll(FULL);
		expect((await api.rerollQuests()).outcome).toBe('failed');
		expect(platformFetch).not.toHaveBeenCalled();
	});

	test('the overview carries what is left to spend', async () => {
		serve({...FULL, 'users/user1/quests': {
			Daily: [{Id: 'd1', Title: 'Movie Night', Target: 1, Current: 0}],
			Weekly: [],
			DailyRerollsRemaining: 1,
			WeeklyRerollsRemaining: 0
		}});
		await api.probe();
		const overview = await api.loadOverview();

		expect(overview.quests.dailyRerollsLeft).toBe(1);
		expect(overview.quests.weeklyRerollsLeft).toBe(0);
	});
});

describe('badge suggestions', () => {
	const CHASE = {
		BadgeId: 'binge-titan',
		BadgeTitle: 'Binge Titan',
		Progress: {Current: 4, Target: 10},
		Items: [
			{Id: 'item-1', Name: 'Trolls Band Together', Type: 'Movie', Year: 2023, RunTimeMinutes: 91},
			{Id: 'item-2', Name: 'Turf War', Type: 'Episode', Year: 2012, RunTimeMinutes: 22}
		]
	};

	test('a badge carries its progress and what to watch', async () => {
		serve({'users/user1/chase/binge-titan': CHASE});
		const chase = await api.fetchBadgeChase('binge-titan');

		expect(chase.current).toBe(4);
		expect(chase.target).toBe(10);
		expect(chase.items).toHaveLength(2);
		expect(chase.items[0].name).toBe('Trolls Band Together');
		expect(chase.items[0].runtimeMinutes).toBe(91);
		expect(chase.items[0].id).toBe('item-1');
		expect(paths()).toEqual(['users/user1/chase/binge-titan?limit=10']);
	});

	test('a badge the plugin cannot recommend for comes back as nothing', async () => {
		serve({});
		expect(await api.fetchBadgeChase('binge-titan')).toBeNull();
	});

	test('a session without a user has nothing to ask for', async () => {
		mockUserId = null;
		serve({'users/user1/chase/binge-titan': CHASE});
		expect(await api.fetchBadgeChase('binge-titan')).toBeNull();
		expect(platformFetch).not.toHaveBeenCalled();
	});
});

describe('loadout', () => {
	// An account holding two boosts and no double credit, before and after one boost is spent.
	const inventory = ({boosts, running}) => [
		{Type: 'XpBoost', Icon: 'bolt', Count: boosts, Active: running},
		{Type: 'DoubleCredit', Icon: 'filter_2', Count: 0, Active: false},
		{Type: 'StreakFreeze', Icon: 'ac_unit', Count: 1, Active: false}
	];

	// The plugin answers a spend it will not grant with 400 and says why, rather than failing.
	const serveLoadout = () => {
		platformFetch.mockImplementation((url, options) => {
			const path = url.split('/Plugins/AchievementBadges/')[1];
			if (path === 'users/user1/powerups') {
				return Promise.resolve(ok({ScoreBank: 1240, Inventory: inventory({boosts: 2, running: false})}));
			}
			if (path === 'users/user1/powerups/use/XpBoost' && options.method === 'POST') {
				return Promise.resolve(ok({Message: 'Boost running.', Inventory: inventory({boosts: 1, running: true})}));
			}
			if (path === 'users/user1/powerups/use/DoubleCredit' && options.method === 'POST') {
				return Promise.resolve({
					ok: false,
					status: 400,
					text: () => Promise.resolve(JSON.stringify({Message: 'None left.'}))
				});
			}
			return Promise.resolve(missing);
		});
	};

	test('the bank and the inventory come back together', async () => {
		serveLoadout();
		const state = await api.fetchPowerUps();

		expect(state.bank).toBe(1240);
		expect(state.slots).toHaveLength(3);
		expect(state.slots.find((slot) => slot.type === 'XpBoost').count).toBe(2);
		expect(state.slots.find((slot) => slot.type === 'DoubleCredit').count).toBe(0);
	});

	test('spending one hands back the inventory it left', async () => {
		serveLoadout();
		const result = await api.usePowerUp('XpBoost');

		expect(result.outcome).toBe('used');
		const boost = result.slots.find((slot) => slot.type === 'XpBoost');
		expect(boost.count).toBe(1);
		expect(boost.active).toBe(true);
	});

	test("an empty slot is refused in the plugin's own wording", async () => {
		serveLoadout();
		const result = await api.usePowerUp('DoubleCredit');

		expect(result.outcome).toBe('refused');
		expect(result.message).toBe('None left.');
	});

	test('anything else that goes wrong is a plain failure', async () => {
		platformFetch.mockResolvedValue({ok: false, status: 500, text: () => Promise.resolve('')});
		expect((await api.usePowerUp('XpBoost')).outcome).toBe('failed');
		expect(await api.fetchPowerUps()).toBeNull();
	});

	test('a session without a user spends nothing', async () => {
		mockUserId = null;
		serveLoadout();
		expect((await api.usePowerUp('XpBoost')).outcome).toBe('failed');
		expect(await api.fetchPowerUps()).toBeNull();
		expect(platformFetch).not.toHaveBeenCalled();
	});
});

describe('cosmetics', () => {
	const CATALOG = {
		PowerUps: [{Id: 'pu-xp-boost-1', Type: 'XpBoost', BundleSize: 1, PriceScore: 50}],
		Cosmetics: [
			{Id: 'avatar-medal', Kind: 'Avatar', DisplayName: 'Medal', PriceScore: 0, PreviewIcon: 'military_tech'},
			{Id: 'avatar-crown', Kind: 'Avatar', DisplayName: 'Crown', PriceScore: 350, PreviewIcon: 'auto_awesome'}
		]
	};
	const WORN = {Owned: ['avatar-medal'], EquippedAvatarId: 'avatar-medal', LifetimeScore: 0, ScoreBank: 225};

	const serveCosmetics = () => {
		platformFetch.mockImplementation((url, options) => {
			const path = url.split('/Plugins/AchievementBadges/')[1];
			if (path === 'shop/catalog') return Promise.resolve(ok(CATALOG));
			if (path === 'users/user1/cosmetics') return Promise.resolve(ok(WORN));
			if (path === 'users/user1/cosmetics/equip' && options.method === 'POST') {
				return Promise.resolve(ok({Message: 'Equipped.'}));
			}
			if (path.indexOf('users/user1/cosmetics/unequip') === 0 && options.method === 'POST') {
				return Promise.resolve(ok({Message: 'Slot cleared.'}));
			}
			return Promise.resolve(missing);
		});
	};

	test('the catalogue and the profile state come back joined', async () => {
		serveCosmetics();
		const worn = await api.fetchCosmetics();

		expect(worn.avatars).toHaveLength(2);
		expect(worn.avatarId).toBe('avatar-medal');
		expect(worn.bank).toBe(225);
	});

	test('the catalogue is read once and kept, since only a server release changes it', async () => {
		serveCosmetics();
		await api.fetchCosmetics();
		await api.fetchCosmetics();
		await api.fetchShopPowerUps();

		expect(paths().filter((path) => path === 'shop/catalog')).toHaveLength(1);
	});

	test('a server with no catalogue leaves the profile with nothing to wear', async () => {
		serve({'users/user1/cosmetics': WORN});
		expect(await api.fetchCosmetics()).toBeNull();
	});

	test('equipping names the cosmetic in the body the plugin asks for', async () => {
		serveCosmetics();
		const result = await api.equipCosmetic('avatar-crown');

		expect(result.outcome).toBe('changed');
		const [, init] = platformFetch.mock.calls.find((call) => call[0].indexOf('cosmetics/equip') >= 0);
		expect(JSON.parse(init.body)).toEqual({CosmeticId: 'avatar-crown'});
	});

	test('unequipping asks by kind and sends no body', async () => {
		serveCosmetics();
		const result = await api.unequipCosmetic('Avatar');

		expect(result.outcome).toBe('changed');
		const [url, init] = platformFetch.mock.calls.find((call) => call[0].indexOf('cosmetics/unequip') >= 0);
		expect(url).toContain('cosmetics/unequip?kind=Avatar');
		expect(init.body).toBeUndefined();
	});

	test("one the profile does not own is refused in the plugin's own wording", async () => {
		platformFetch.mockResolvedValue({
			ok: false,
			status: 400,
			text: () => Promise.resolve(JSON.stringify({Message: "You don't own that cosmetic."}))
		});
		const result = await api.equipCosmetic('avatar-crown');

		expect(result.outcome).toBe('refused');
		expect(result.message).toBe("You don't own that cosmetic.");
	});

	test('a session without a user changes nothing', async () => {
		mockUserId = null;
		serveCosmetics();

		expect(await api.fetchCosmetics()).toBeNull();
		expect((await api.equipCosmetic('avatar-crown')).outcome).toBe('failed');
		expect(platformFetch).not.toHaveBeenCalled();
	});
});

describe('stats', () => {
	const STATS = {
		'users/user1/records': {TotalItemsWatched: 5, BestWatchStreak: 1, LongestItemMinutes: 21},
		'users/user1/watch-clock': {0: 0, 21: 4},
		'server/stats': {TotalUsers: 3, TotalBadgesUnlocked: 17, MostCommonBadge: 'First Contact'}
	};

	test('the records, the clock and the server figures come back in one pass', async () => {
		serve({'public-config': CONFIG, ...STATS});
		await api.probe();
		const stats = await api.fetchStats();

		expect(stats.records.TotalItemsWatched).toBe(5);
		expect(stats.watchClock[21]).toBe(4);
		expect(stats.server.users).toBe(3);
		expect(stats.server.mostCommonBadge).toBe('First Contact');
	});

	test('privacy mode leaves the server figures unasked', async () => {
		serve({'public-config': {...CONFIG, ForcePrivacyMode: true}, ...STATS});
		await api.probe();
		const stats = await api.fetchStats();

		expect(stats.server).toBeNull();
		expect(stats.records.TotalItemsWatched).toBe(5);
		expect(paths()).not.toContain('server/stats');
	});

	test('a server that answers none of it still reads as a shape', async () => {
		serve({'public-config': CONFIG});
		await api.probe();
		expect(await api.fetchStats()).toEqual({records: {}, watchClock: {}, server: null});
	});

	test('a session without a user asks for nothing', async () => {
		mockUserId = null;
		serve({'public-config': CONFIG, ...STATS});

		expect(await api.fetchStats()).toEqual({records: {}, watchClock: {}, server: null});
		expect(platformFetch).not.toHaveBeenCalled();
	});
});

describe('activity feed', () => {
	const FEED = {
		Page: 1,
		PageSize: 30,
		TotalEntries: 2,
		Entries: [
			{
				At: '2026-09-18T05:01:48Z', UserId: 'u1', UserName: 'moonfin',
				BadgeId: 'media-explorer', Title: 'Media Explorer', Rarity: 'Common',
				Icon: 'travel_explore', Category: 'Getting Started'
			},
			{At: '2026-09-18T04:11:44Z', UserName: 'Ada', Title: 'First Contact', Rarity: 'Rare', Icon: 'play_circle'}
		]
	};

	test('the feed comes back the way the server ordered it', async () => {
		serve({'public-config': CONFIG, 'activity-feed': FEED});
		await api.probe();
		const entries = await api.fetchActivity();

		expect(entries).toHaveLength(2);
		expect(entries[0].userName).toBe('moonfin');
		expect(entries[0].badgeTitle).toBe('Media Explorer');
		expect(entries[0].rarity).toBe('Common');
		expect(entries[0].at).toBeInstanceOf(Date);
		expect(entries[1].userName).toBe('Ada');
	});

	test('the page size asked for is the limit given', async () => {
		serve({'public-config': CONFIG, 'activity-feed': FEED});
		await api.probe();
		await api.fetchActivity({limit: 5});

		expect(paths()).toContain('activity-feed?page=1&pageSize=5');
	});

	test('a feed the admin switched off is not even asked for', async () => {
		serve({'public-config': {...CONFIG, ActivityFeedEnabled: false}, 'activity-feed': FEED});
		await api.probe();

		expect(await api.fetchActivity()).toEqual([]);
		expect(paths().some((path) => path.indexOf('activity-feed') >= 0)).toBe(false);
	});

	test('a server that answers nothing has unlocked nothing', async () => {
		serve({'public-config': CONFIG});
		await api.probe();
		expect(await api.fetchActivity()).toEqual([]);
	});
});

describe('shop', () => {
	const CATALOG = {
		PowerUps: [
			{Id: 'pu-xp-boost-1', Type: 'XpBoost', BundleSize: 1, PriceScore: 50},
			{Id: 'pu-xp-boost-3', Type: 'XpBoost', BundleSize: 3, PriceScore: 130},
			{Id: 'pu-streak-freeze-1', Type: 'StreakFreeze', BundleSize: 1, PriceScore: 100}
		],
		Cosmetics: [{Id: 'theme-sunset', Kind: 'ProfileTheme', PriceScore: 250}]
	};

	// Only the pack is granted. Anything else comes back the way the plugin answers a bank that
	// cannot cover it.
	const serveShop = () => {
		platformFetch.mockImplementation((url, options) => {
			const path = url.split('/Plugins/AchievementBadges/')[1];
			if (path === 'shop/catalog') return Promise.resolve(ok(CATALOG));
			if (path === 'users/user1/shop/purchase' && options.method === 'POST') {
				const {ItemId} = JSON.parse(options.body);
				if (ItemId !== 'pu-xp-boost-3') {
					return Promise.resolve({
						ok: false,
						status: 400,
						text: () => Promise.resolve(JSON.stringify({Message: 'Not enough score.'}))
					});
				}
				return Promise.resolve(ok({Success: true, Message: 'Bought.', ScoreBalanceAfter: 1240 - 130}));
			}
			return Promise.resolve(missing);
		});
	};

	test('only the power-ups are read from the catalogue', async () => {
		serveShop();
		const items = await api.fetchShopPowerUps();

		expect(items).toHaveLength(3);
		expect(items[0].id).toBe('pu-xp-boost-1');
		expect(items[0].priceScore).toBe(50);
		expect(items[1].bundleSize).toBe(3);
	});

	test('the catalogue is the same for everyone, so it carries no user', async () => {
		serveShop();
		await api.fetchShopPowerUps();

		expect(paths()).toEqual(['shop/catalog']);
	});

	test('buying names the item and says what the bank holds after', async () => {
		serveShop();
		const result = await api.buyShopItem('pu-xp-boost-3');

		expect(result.outcome).toBe('bought');
		expect(result.bankAfter).toBe(1110);

		const [, init] = platformFetch.mock.calls[0];
		expect(init.headers['Content-Type']).toBe('application/json');
		expect(JSON.parse(init.body)).toEqual({ItemId: 'pu-xp-boost-3'});
	});

	test('a bank too short is refused, not broken', async () => {
		serveShop();
		const result = await api.buyShopItem('pu-streak-freeze-1');

		expect(result.outcome).toBe('refused');
		expect(result.message).toBe('Not enough score.');
	});

	test('a session without a user buys nothing', async () => {
		mockUserId = null;
		serveShop();

		expect((await api.buyShopItem('pu-xp-boost-1')).outcome).toBe('failed');
		expect(platformFetch).not.toHaveBeenCalled();
	});
});

describe('unlock notifications', () => {
	const PREFERENCES = {EnableUnlockToasts: true, MinimumToastRarity: 'rare', UnlockToastGrouping: 'grouped', MuteToastsDuringPlayback: true};
	const unlocked = (id, rarity, at) => ({Id: id, Title: id, Rarity: rarity, Unlocked: true, UnlockedAt: at});
	const withUnlocks = (preferences, badges) => serve({
		'public-config': CONFIG,
		'admin/ui-features': {EnableUnlockToasts: true},
		'users/user1/preferences': preferences,
		'users/user1/unlocks-since': {Now: '2026-10-05T12:00:00Z', Badges: badges}
	});
	const sinceOf = () => decodeURIComponent(/since=([^&]*)/.exec(paths().filter((path) => path.startsWith('users/user1/unlocks-since')).pop())[1]);

	test('reads the user settings from the plugin and writes the switch over a fresh copy', async () => {
		withUnlocks(PREFERENCES, []);
		expect(await api.fetchUnlockToastSettings()).toMatchObject({enabled: true, minimumRarity: 'rare', grouped: true, muteDuringPlayback: true});

		expect(await api.saveUnlockToasts(false)).toBe(true);
		const [, init] = platformFetch.mock.calls.find((call) => call[1].method === 'POST');
		expect(JSON.parse(init.body)).toEqual({...PREFERENCES, EnableUnlockToasts: false});
	});

	test('the first read only records the clock, the next one hands back what cleared the minimum', async () => {
		withUnlocks(PREFERENCES, [unlocked('b1', 'Common', '2026-10-05T11:59:00Z'), unlocked('b2', 'Epic', '2026-10-05T11:59:30Z')]);
		await api.probe();
		expect(await api.refreshUnlocks()).toBeNull();

		const unlocks = await api.refreshUnlocks();
		expect(sinceOf()).toBe('2026-10-05T12:00:00Z');
		expect(unlocks.badges.map((badge) => badge.id)).toEqual(['b2']);
		expect(unlocks).toMatchObject({grouped: true, muteDuringPlayback: true});
		// The same unlock is never passed on twice.
		expect(await api.refreshUnlocks()).toBeNull();
	});

	test('notifications the user switched off read nothing and start fresh once back on', async () => {
		withUnlocks({EnableUnlockToasts: false}, [unlocked('b1', 'Epic', '2026-10-05T11:59:00Z')]);
		await api.probe();
		expect(await api.refreshUnlocks()).toBeNull();
		expect(paths().some((path) => path.startsWith('users/user1/unlocks-since'))).toBe(false);
	});

	test('a plugin without the route is never asked', async () => {
		serve({'public-config': CONFIG, 'users/user1/preferences': PREFERENCES});
		await api.probe();
		expect(await api.refreshUnlocks()).toBeNull();
		expect(paths().some((path) => path.startsWith('users/user1/preferences'))).toBe(false);
	});
});

describe('friends and chat', () => {
	const SOCIAL = {
		'public-config': {...CONFIG, FriendsEnabled: true, FriendsSimpleMode: true},
		'users/user1/friends': {Friends: [{UserId: 'f1', UserName: 'Ada', Online: true}], Incoming: [], Outgoing: [], SimpleMode: true},
		'users/user1/messages/threads': {Threads: [{conversationId: 'c1', otherUserName: 'Ada', lastMessage: 'hi', unreadCount: 1}]},
		'users/user1/messages/f1': {ConversationId: 'c1'},
		'users/user1/conversations/c1/messages': {Messages: [{id: 'm1', fromUserId: 'f1', text: 'hi'}]},
		'users/user1/blocked': {Blocked: ['b1']},
		'users/user1/directory': [{Id: 'f1', Name: 'Ada'}, {Id: 'x', Name: 'Hidden'}]
	};

	test('the probe reports whether friends are on and whether everyone already is one', async () => {
		serve(SOCIAL);
		await api.probe();
		expect(api.getFlags()).toMatchObject({friendsEnabled: true, friendsSimpleMode: true});
	});

	test('reads the friends, the chats and a direct chat id', async () => {
		serve(SOCIAL);
		expect((await api.fetchFriends()).friends[0].userName).toBe('Ada');
		expect((await api.fetchThreads())[0]).toMatchObject({conversationId: 'c1', unreadCount: 1});
		expect(await api.openDirectChat('f1')).toBe('c1');
		expect((await api.fetchMessages('c1'))[0].text).toBe('hi');
		expect(await api.fetchBlocked()).toEqual(['b1']);
	});

	test('people come from the plugin directory, which a build without one leaves to /Users', async () => {
		serve(SOCIAL);
		expect((await api.fetchServerUsers()).map((user) => user.userName)).toEqual(['Ada', 'Hidden']);

		platformFetch.mockImplementation((url) => Promise.resolve(url.endsWith('/Users')
			? {ok: true, status: 200, json: () => Promise.resolve([{Id: 'u2', Name: 'Eve'}])}
			: missing));
		expect((await api.fetchServerUsers()).map((user) => user.userName)).toEqual(['Eve']);
	});

	test('a write carries the plugin answer, and its rate limit reads as a refusal with its wording', async () => {
		platformFetch.mockImplementation((url, init) => {
			const path = url.split('/Plugins/AchievementBadges/')[1];
			if (path === 'users/user1/friends/f1' && init.method === 'POST') return Promise.resolve(ok({Success: true}));
			if (path === 'users/user1/conversations/c1/messages') return Promise.resolve({ok: false, status: 429, text: () => Promise.resolve(JSON.stringify({Message: 'Slow down.'}))});
			return Promise.resolve(missing);
		});
		expect((await api.sendFriendRequest('f1')).ok).toBe(true);
		expect(await api.sendMessage('c1', 'hi')).toMatchObject({ok: false, message: 'Slow down.'});
	});

	test('saving privacy writes over a fresh copy of the preferences', async () => {
		serve({...SOCIAL, 'users/user1/preferences': {AppearOffline: false, EnableUnlockToasts: true}});
		expect(await api.saveSocialPrivacy({appearOffline: true, hideNowPlaying: false, hideLastWatched: false, messageNotifications: false})).toBe(true);
		const [, init] = platformFetch.mock.calls.find((call) => call[1].method === 'POST');
		expect(JSON.parse(init.body)).toEqual({AppearOffline: true, EnableUnlockToasts: true, HideNowPlaying: false, HideLastWatched: false, MessageNotifications: false});
	});
});
