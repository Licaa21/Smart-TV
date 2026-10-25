import {getExtraCategoryLabel, groupExtrasByCategory, splitAdditionalParts} from './extraCategories';

const part = {Id: 'cd2', _additionalPart: true};
const trailer = {Id: 'trailer', ExtraType: 'Trailer'};
const unlabelled = {Id: 'extra'};

describe('extraCategories', () => {
	it("leads with a movie's other parts under their own heading", () => {
		const groups = groupExtrasByCategory([trailer, unlabelled, part]);

		expect(groups.map((group) => group.key)).toEqual(['additionalParts', 'extras', 'trailers']);
		expect(groups[0].items).toEqual([part]);
		expect(getExtraCategoryLabel('additionalParts')).toBe('Additional Parts');
	});

	it('splits the parts from the rest of the extras', () => {
		expect(splitAdditionalParts([trailer, part, unlabelled])).toEqual({parts: [part], others: [trailer, unlabelled]});
	});
});
