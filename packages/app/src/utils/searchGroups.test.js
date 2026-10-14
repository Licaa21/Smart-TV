import {rankMostRelevant} from './searchGroups';

jest.mock('@enact/i18n/$L', () => ({__esModule: true, default: (str) => str}));
jest.mock('../services/gamesApi', () => ({}));

const title = (Name) => ({Id: Name, Name});

describe('rankMostRelevant', () => {
	it('puts the exact title first, then titles that start with the search (not counting a leading The), then ones that contain it', () => {
		const items = [title('Not Outer'), title('The Outer Limits'), title('Outer Banks'), title('Outer')];
		expect(rankMostRelevant(items, 'outer', 4).map((item) => item.Name))
			.toEqual(['Outer', 'The Outer Limits', 'Outer Banks', 'Not Outer']);
	});

	it('does not let a leading The, A or An keep a title behind ones that start with the search', () => {
		const items = [title('Flash Gordon'), title('The Flash'), title('Flashdance'), title('Flash')];
		expect(rankMostRelevant(items, 'Flash', 4).map((item) => item.Name)).toEqual(['Flash', 'The Flash', 'Flash Gordon', 'Flashdance']);
		expect(rankMostRelevant([title('Flash Gordon'), title('The Flash')], 'the flash', 2).map((item) => item.Name)).toEqual(['The Flash', 'Flash Gordon']);
		expect(rankMostRelevant([title('Thelma'), title('The')], 'the', 2).map((item) => item.Name)).toEqual(['The', 'Thelma']);
	});

	it('finds a translated title by the name it was made under', () => {
		const items = [{Name: 'The Wire Tapped'}, {Name: 'Cartelul Crimelor', _altNames: ['The Wire']}, {Name: 'Altceva'}];
		expect(rankMostRelevant(items, 'The Wire', 3).map((item) => item.Name)).toEqual(['Cartelul Crimelor', 'The Wire Tapped', 'Altceva']);
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
