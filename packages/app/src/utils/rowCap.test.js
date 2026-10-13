import {applyPerfTier} from './perfTier';
import {ROW_CAP, forgetRowCountsExcept, grownRowCount, initialRowCount, rememberRowCount, rememberedRowCount} from './rowCap';

describe('row cap', () => {
	afterEach(() => applyPerfTier(null));

	test('draws every card down to Medium-High', () => {
		['ultra', 'high', 'midhigh'].forEach((level) => {
			applyPerfTier(level);
			expect(initialRowCount(300)).toBe(300);
		});
	});

	test('draws only the first cards from Medium down, and never more than there are', () => {
		['mid', 'lowmid', 'low'].forEach((level) => {
			applyPerfTier(level);
			expect(initialRowCount(300)).toBe(ROW_CAP);
			expect(initialRowCount(12)).toBe(12);
		});
	});

	test('draws more once focus is near the end of what is drawn, up to the total', () => {
		expect(grownRowCount(12, 4, 300)).toBe(12);
		expect(grownRowCount(12, 5, 300)).toBe(22);
		expect(grownRowCount(22, 15, 300)).toBe(32);
		expect(grownRowCount(12, 11, 15)).toBe(15);
	});

	test('forgets the cards drawn for every row but the one focus returns to', () => {
		rememberRowCount('resume', 60);
		rememberRowCount('latest', 80);
		rememberRowCount('discover-trending', 27);
		forgetRowCountsExcept('latest');
		expect(rememberedRowCount('resume')).toBeNull();
		expect(rememberedRowCount('latest')).toBe(80);
		expect(rememberedRowCount('discover-trending')).toBe(27);
	});
});
