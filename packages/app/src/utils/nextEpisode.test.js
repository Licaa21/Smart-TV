import {
	findNextInSeason, findNextSeason, findPreviousInSeason, findPreviousSeason, firstPlayableEpisode, isPlayableEpisode, lastPlayableEpisode
} from './nextEpisode';

const ep = (id, index, extra) => ({Id: id, IndexNumber: index, ...extra});
const season = (id, index) => ({Id: id, IndexNumber: index});

describe('findNextInSeason', () => {
	test('returns the following episode', () => {
		const list = [ep('a', 1), ep('b', 2), ep('c', 3)];
		expect(findNextInSeason(list, 'b')).toBe(list[2]);
	});

	test('returns null on the last episode', () => {
		expect(findNextInSeason([ep('a', 1), ep('b', 2)], 'b')).toBeNull();
	});

	test('matches ids across types, because Emby returns numbers', () => {
		const list = [ep(1, 1), ep(2, 2)];
		expect(findNextInSeason(list, '1')).toBe(list[1]);
	});

	test('skips an unaired episode and takes the next real one', () => {
		const list = [ep('a', 1), ep('b', 2, {LocationType: 'Virtual'}), ep('c', 3)];
		expect(findNextInSeason(list, 'a')).toBe(list[2]);
	});

	test('returns null when only unaired episodes follow', () => {
		const list = [ep('a', 1), ep('b', 2, {LocationType: 'Virtual'})];
		expect(findNextInSeason(list, 'a')).toBeNull();
	});

	test('returns null when the current episode is not in the list', () => {
		expect(findNextInSeason([ep('a', 1)], 'zzz')).toBeNull();
	});

	test('tolerates a missing list', () => {
		expect(findNextInSeason(undefined, 'a')).toBeNull();
	});
});

describe('findNextSeason', () => {
	test('picks the next season by number, not list position', () => {
		const list = [season('specials', 0), season('s1', 1), season('s2', 2)];
		expect(findNextSeason(list, 's1', 1)).toBe(list[2]);
	});

	test('does not fall back into Specials when it is listed last', () => {
		const list = [season('s1', 1), season('s2', 2), season('specials', 0)];
		expect(findNextSeason(list, 's2', 2)).toBeNull();
	});

	test('skips a gap in the numbering', () => {
		const list = [season('s1', 1), season('s4', 4), season('s7', 7)];
		expect(findNextSeason(list, 's1', 1)).toBe(list[1]);
	});

	test('reads the current number from the list when the item has none', () => {
		const list = [season('s1', 1), season('s2', 2)];
		expect(findNextSeason(list, 's1', undefined)).toBe(list[1]);
	});

	test('falls back to list order when nothing is numbered', () => {
		const list = [{Id: 's1'}, {Id: 's2'}];
		expect(findNextSeason(list, 's1', undefined)).toBe(list[1]);
	});

	test('returns null on the last season', () => {
		const list = [season('s1', 1), season('s2', 2)];
		expect(findNextSeason(list, 's2', 2)).toBeNull();
	});

	test('tolerates a missing list', () => {
		expect(findNextSeason(undefined, 's1', 1)).toBeNull();
	});
});

describe('firstPlayableEpisode', () => {
	test('skips unaired entries at the start of a season', () => {
		const list = [ep('a', 1, {LocationType: 'Virtual'}), ep('b', 2)];
		expect(firstPlayableEpisode(list)).toBe(list[1]);
	});

	test('returns null when a season has nothing playable', () => {
		expect(firstPlayableEpisode([ep('a', 1, {LocationType: 'Virtual'})])).toBeNull();
	});

	test('tolerates a missing list', () => {
		expect(firstPlayableEpisode(undefined)).toBeNull();
	});
});

describe('isPlayableEpisode', () => {
	test('treats an episode with no location as playable', () => {
		expect(isPlayableEpisode(ep('a', 1))).toBe(true);
	});

	test('rejects nothing at all', () => {
		expect(isPlayableEpisode(null)).toBe(false);
	});
});

describe('findPreviousInSeason', () => {
	test('returns the episode before', () => {
		const list = [ep('a', 1), ep('b', 2), ep('c', 3)];
		expect(findPreviousInSeason(list, 'b')).toBe(list[0]);
	});

	test('returns null on the first episode', () => {
		expect(findPreviousInSeason([ep('a', 1), ep('b', 2)], 'a')).toBeNull();
	});

	test('skips an unaired episode going back', () => {
		const list = [ep('a', 1), ep('b', 2, {LocationType: 'Virtual'}), ep('c', 3)];
		expect(findPreviousInSeason(list, 'c')).toBe(list[0]);
	});

	test('matches ids across types, because Emby returns numbers', () => {
		const list = [ep(1, 1), ep(2, 2)];
		expect(findPreviousInSeason(list, '2')).toBe(list[0]);
	});

	test('returns null when the episode is not in the list', () => {
		expect(findPreviousInSeason([ep('a', 1)], 'z')).toBeNull();
	});
});

describe('findPreviousSeason', () => {
	const seasons = [season('s0', 0), season('s1', 1), season('s2', 2), season('s3', 3)];

	test('returns the numbered season below', () => {
		expect(findPreviousSeason(seasons, 's3', 3)).toBe(seasons[2]);
	});

	test('does not step back from season 1 into the Specials', () => {
		expect(findPreviousSeason(seasons, 's1', 1)).toBeNull();
	});

	test('goes by number, not by the order the server listed them in', () => {
		const shuffled = [season('s2', 2), season('s0', 0), season('s1', 1)];
		expect(findPreviousSeason(shuffled, 's2', 2)).toBe(shuffled[2]);
	});

	test('returns null with nothing to compare', () => {
		expect(findPreviousSeason([{Id: 'x'}], 'x', undefined)).toBeNull();
	});
});

describe('lastPlayableEpisode', () => {
	test('skips unaired entries at the end of a season', () => {
		const list = [ep('a', 1), ep('b', 2), ep('c', 3, {LocationType: 'Virtual'})];
		expect(lastPlayableEpisode(list)).toBe(list[1]);
	});

	test('tolerates a missing list', () => {
		expect(lastPlayableEpisode(undefined)).toBeNull();
	});
});
