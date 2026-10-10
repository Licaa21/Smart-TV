import {
	SEEK_THUMB_RADIUS, planTrickplayPreview, resolveSingleLeft, resolveStrip, resolveStripSlots, resolveTileSize,
	resolveVerticalTravel, resolveVerticalTravelMax, trackXForPosition
} from './trickplayLayout';

describe('trackXForPosition', () => {
	test('runs from one thumb radius in to one from the far end', () => {
		expect(trackXForPosition({positionMs: 0, durationMs: 100000, trackWidth: 1000})).toBe(SEEK_THUMB_RADIUS);
		expect(trackXForPosition({positionMs: 100000, durationMs: 100000, trackWidth: 1000})).toBe(1000 - SEEK_THUMB_RADIUS);
	});

	test('a zero duration doesnt divide by zero', () => {
		expect(trackXForPosition({positionMs: 500, durationMs: 0, trackWidth: 1000})).toBe(SEEK_THUMB_RADIUS);
	});
});

describe('resolveSingleLeft', () => {
	test('is centered on the track when not following the scrub', () => {
		expect(resolveSingleLeft({positionMs: 10000, durationMs: 100000, trackWidth: 1000, tileWidth: 200, followScrub: false})).toBe(400);
	});

	test('tracks the thumb when following, and stays on the track at both ends', () => {
		const thumbX = trackXForPosition({positionMs: 50000, durationMs: 100000, trackWidth: 1000});
		expect(resolveSingleLeft({positionMs: 50000, durationMs: 100000, trackWidth: 1000, tileWidth: 200, followScrub: true})).toBe(thumbX - 100);
		expect(resolveSingleLeft({positionMs: 0, durationMs: 100000, trackWidth: 1000, tileWidth: 200, followScrub: true})).toBeGreaterThanOrEqual(0);
		expect(resolveSingleLeft({positionMs: 100000, durationMs: 100000, trackWidth: 1000, tileWidth: 200, followScrub: true})).toBeLessThanOrEqual(800);
	});
});

describe('resolveStrip', () => {
	test('fills both sides evenly when the main tile is centered', () => {
		const layout = resolveStrip({mainTileLeft: 450, trackWidth: 1000, tileWidth: 100, spacing: 0});
		expect(layout.leftCount).toBe(layout.rightCount);
	});

	test('spawns fewer slots on the side the main tile is near', () => {
		const nearLeft = resolveStrip({mainTileLeft: 10, trackWidth: 1000, tileWidth: 100, spacing: 0});
		expect(nearLeft.leftCount).toBeLessThan(nearLeft.rightCount);
		const nearRight = resolveStrip({mainTileLeft: 890, trackWidth: 1000, tileWidth: 100, spacing: 0});
		expect(nearRight.rightCount).toBeLessThan(nearRight.leftCount);
	});

	test('leftOffset places the highlighted slot exactly at mainTileLeft', () => {
		const layout = resolveStrip({mainTileLeft: 273, trackWidth: 1000, tileWidth: 80, spacing: 8});
		expect(layout.leftOffset + layout.leftCount * 88).toBeCloseTo(273, 3);
	});

	test('always spawns one full slot past the last that fits, even at a true edge', () => {
		expect(resolveStrip({mainTileLeft: 895, trackWidth: 1000, tileWidth: 100, spacing: 10}).rightCount).toBe(1);
		expect(resolveStrip({mainTileLeft: 5, trackWidth: 1000, tileWidth: 100, spacing: 10}).leftCount).toBe(1);
	});

	test('doesnt run away when there is plenty of room', () => {
		expect(resolveStrip({mainTileLeft: 10, trackWidth: 1000, tileWidth: 50, spacing: 0}).rightCount).toBe(19);
	});

	test('overflowMargin lets the overflow slot reach further without moving leftOffset', () => {
		const args = {mainTileLeft: 95.6, trackWidth: 340, tileWidth: 51, spacing: 4};
		const withoutMargin = resolveStrip(args);
		const withMargin = resolveStrip({...args, overflowMargin: 8});
		expect(withMargin.leftCount).toBe(2);
		expect(withMargin.rightCount).toBe(4);
		expect(withMargin.leftOffset).toBeCloseTo(-14.4, 3);
		expect(withMargin.leftOffset).toBe(withoutMargin.leftOffset);
	});

	test('maxSlotsPerSide guards against a near zero tile, and a zero step gives no wings', () => {
		const tiny = resolveStrip({mainTileLeft: 500, trackWidth: 1000, tileWidth: 0.001, spacing: 0, maxSlotsPerSide: 50});
		expect(tiny.leftCount).toBeLessThanOrEqual(50);
		expect(tiny.rightCount).toBeLessThanOrEqual(50);
		expect(resolveStrip({mainTileLeft: 50, trackWidth: 1000, tileWidth: 0, spacing: 0})).toEqual({leftCount: 0, rightCount: 0, leftOffset: 50});
	});
});

describe('vertical travel', () => {
	test('is the share of the way to the ceiling, clamped into 0 to 100', () => {
		expect(resolveVerticalTravel(0, 100)).toBe(0);
		expect(resolveVerticalTravel(50, 100)).toBe(50);
		expect(resolveVerticalTravel(100, 100)).toBe(100);
		expect(resolveVerticalTravel(-20, 100)).toBe(0);
		expect(resolveVerticalTravel(150, 100)).toBe(100);
		expect(resolveVerticalTravel(100, 12)).toBeLessThanOrEqual(12);
	});

	test('a narrow track caps the travel at its width, and it never goes negative', () => {
		expect(resolveVerticalTravelMax({rawMaxTravel: 300, trackWidth: 1200})).toBe(300);
		expect(resolveVerticalTravelMax({rawMaxTravel: 900, trackWidth: 250})).toBe(250);
		expect(resolveVerticalTravelMax({rawMaxTravel: -40, trackWidth: 250})).toBe(0);
	});
});

describe('resolveTileSize', () => {
	const aspect = 9 / 16;

	test('100% fills the height budget and 40% is half of it', () => {
		const full = resolveTileSize({trackWidth: 1000, scalePercent: 100, aspect, maxHeightBudget: 500});
		expect(full.height).toBeCloseTo(500, 3);
		expect(full.width).toBeCloseTo(500 / aspect, 3);
		expect(resolveTileSize({trackWidth: 1000, scalePercent: 40, aspect, maxHeightBudget: 500}).height).toBeCloseTo(250, 3);
	});

	test('never shrinks below 24px or grows past the budget', () => {
		expect(resolveTileSize({trackWidth: 1000, scalePercent: 10, aspect, maxHeightBudget: 0}).height).toBeGreaterThanOrEqual(24);
		expect(resolveTileSize({trackWidth: 3800, scalePercent: 100, aspect, maxHeightBudget: 100}).height).toBeLessThanOrEqual(100.001);
	});

	test('a narrow track holds the width, even under the height floor', () => {
		expect(resolveTileSize({trackWidth: 100, scalePercent: 100, aspect, maxHeightBudget: 1000}).width).toBeCloseTo(100, 3);
		const narrow = resolveTileSize({trackWidth: 30, scalePercent: 100, aspect, maxHeightBudget: 1000});
		expect(narrow.width).toBeCloseTo(30, 3);
		expect(narrow.height).toBeLessThan(24);
	});

	test('keeps the aspect and clamps the percent into 10 to 100', () => {
		const size = resolveTileSize({trackWidth: 1000, scalePercent: 40, aspect: 3 / 4, maxHeightBudget: 1000});
		expect(size.height / size.width).toBeCloseTo(3 / 4, 3);
		expect(resolveTileSize({trackWidth: 1000, scalePercent: 0, aspect, maxHeightBudget: 1000}).width).toBeCloseTo(resolveTileSize({trackWidth: 1000, scalePercent: 10, aspect, maxHeightBudget: 1000}).width, 3);
		expect(resolveTileSize({trackWidth: 1000, scalePercent: 150, aspect, maxHeightBudget: 1000}).width).toBeCloseTo(resolveTileSize({trackWidth: 1000, scalePercent: 100, aspect, maxHeightBudget: 1000}).width, 3);
	});
});

describe('resolveStripSlots', () => {
	const durationMs = 600000;

	test('gives five slots around the middle by default', () => {
		const slots = resolveStripSlots({positionMs: 300000, durationMs, stepMs: 30000});
		expect(slots.map((slot) => slot.slotIndex)).toEqual([-2, -1, 0, 1, 2]);
		expect(slots[2].targetMs).toBe(300000);
	});

	test('slots past either end have no moment', () => {
		const nearStart = resolveStripSlots({positionMs: 15000, durationMs, stepMs: 30000});
		expect(nearStart.map((slot) => slot.targetMs)).toEqual([null, null, 15000, 45000, 75000]);
		const nearEnd = resolveStripSlots({positionMs: 585000, durationMs, stepMs: 30000});
		expect(nearEnd.map((slot) => slot.targetMs)).toEqual([525000, 555000, 585000, null, null]);
	});

	test('the highlight can sit off center, and is clamped into the strip', () => {
		expect(resolveStripSlots({positionMs: 300000, durationMs, stepMs: 30000, slotCount: 6, highlightIndex: 1}).map((slot) => slot.slotIndex)).toEqual([-1, 0, 1, 2, 3, 4]);
		expect(resolveStripSlots({positionMs: 300000, durationMs, stepMs: 30000, slotCount: 5, highlightIndex: 99}).map((slot) => slot.slotIndex)).toEqual([-4, -3, -2, -1, 0]);
	});
});

describe('planTrickplayPreview', () => {
	const planAt = (isStrip) => planTrickplayPreview({
		trackWidth: 1000, scalePercent: 30, aspect: 9 / 16, maxHeightBudget: 400, positionMs: 1800000, durationMs: 3600000,
		followScrub: true, verticalPositionPercent: 50, isStrip, spacing: 4, overflowMargin: 16, stepMs: 30000
	});

	test('agrees with the pieces it is built from', () => {
		const plan = planAt(true);
		const tile = resolveTileSize({trackWidth: 1000, scalePercent: 30, aspect: 9 / 16, maxHeightBudget: 400});
		expect(plan.tileWidth).toBe(tile.width);
		expect(plan.tileHeight).toBe(tile.height);
		const mainLeft = resolveSingleLeft({positionMs: 1800000, durationMs: 3600000, trackWidth: 1000, tileWidth: tile.width, followScrub: true});
		expect(plan.leftOffset).toBe(mainLeft - plan.leftCount * (tile.width + 4));
		expect(plan.verticalTravel).toBe(resolveVerticalTravel(50, resolveVerticalTravelMax({rawMaxTravel: 400 - tile.height, trackWidth: 1000})));
	});

	test('the highlighted slot is the seek position and the wings step out', () => {
		const plan = planAt(true);
		const at = (slotIndex) => plan.slots.find((slot) => slot.slotIndex === slotIndex).targetMs;
		expect(at(0)).toBe(1800000);
		expect(at(1)).toBe(1830000);
		expect(at(-1)).toBe(1770000);
		expect(plan.slots).toHaveLength(plan.leftCount + 1 + plan.rightCount);
		expect(plan.leftCount).toBeGreaterThan(0);
	});

	test('single mode has one slot and no wings', () => {
		const plan = planAt(false);
		expect(plan.leftCount).toBe(0);
		expect(plan.rightCount).toBe(0);
		expect(plan.slots.map((slot) => slot.slotIndex)).toEqual([0]);
	});
});
