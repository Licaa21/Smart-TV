import {rankMostRelevant} from './searchGroups';

jest.mock('@enact/i18n/$L', () => ({__esModule: true, default: (str) => str}));
jest.mock('../services/gamesApi', () => ({}));

const title = (Name) => ({Id: Name, Name});

describe('rankMostRelevant', () => {
	it('puts the exact title first, then titles that start with the search, then ones that contain it', () => {
		const items = [title('Not Outer'), title('The Outer Limits'), title('Outer Banks'), title('Outer')];
		expect(rankMostRelevant(items, 'outer', 4).map((item) => item.Name))
			.toEqual(['Outer', 'Outer Banks', 'Not Outer', 'The Outer Limits']);
	});

	it('keeps the arrival order among equally close matches, which is Seerr\'s own ranking', () => {
		const items = [title('Zeta Outer'), title('Alpha Outer'), title('Beta Outer')];
		expect(rankMostRelevant(items, 'outer', 3).map((item) => item.Name)).toEqual(['Zeta Outer', 'Alpha Outer', 'Beta Outer']);
	});

	it('ignores case and accents', () => {
		const items = [title('Something Else'), title('Amélie')];
		expect(rankMostRelevant(items, 'AMELIE', 1)[0].Name).toBe('Amélie');
	});

	it('returns only as many as asked for, and nothing for no results', () => {
		expect(rankMostRelevant([title('a'), title('b'), title('c')], 'x', 2)).toHaveLength(2);
		expect(rankMostRelevant([], 'x', 2)).toEqual([]);
		expect(rankMostRelevant(undefined, 'x', 2)).toEqual([]);
	});
});
