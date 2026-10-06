import {applyPerfTier} from './perfTier';
import {ROW_CAP, grownRowCount, initialRowCount} from './rowCap';

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
		expect(grownRowCount(40, 10, 300)).toBe(40);
		expect(grownRowCount(40, 33, 300)).toBe(60);
		expect(grownRowCount(40, 39, 50)).toBe(50);
	});
});
