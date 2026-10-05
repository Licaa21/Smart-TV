import {
	BURST_COUNTS,
	BURST_SECONDS,
	COUNT_SHARE,
	FALL_COUNTS,
	FLYER_COUNTS,
	SPARKS_PER_BURST,
	buildSeasonalParticles
} from './seasonalParticles';

const seconds = (value) => parseFloat(value);

describe('buildSeasonalParticles', () => {
	test('density and the performance tier set how many particles fall', () => {
		for (const tier of ['low', 'mid', 'high']) {
			for (const effect of ['snow', 'leaves', 'confetti', 'christmas', 'petals', 'fireflies', 'halloween']) {
				for (const density of ['light', 'normal', 'heavy']) {
					const {falling, bursts} = buildSeasonalParticles(effect, density, 1, tier);
					const share = COUNT_SHARE[effect] || 1;
					expect(falling).toHaveLength(Math.round(FALL_COUNTS[tier][density] * share));
					expect(bursts).toHaveLength(0);
				}
			}
		}
	});

	test('density sets how many fireworks are in the air', () => {
		for (const density of ['light', 'normal', 'heavy']) {
			const {falling, bursts} = buildSeasonalParticles('fireworks', density, 1, 'low');
			expect(falling).toHaveLength(0);
			expect(bursts).toHaveLength(BURST_COUNTS[density]);
			for (const burst of bursts) expect(burst.sparks).toHaveLength(SPARKS_PER_BURST);
		}
	});

	test('the same seed gives the same particles', () => {
		expect(buildSeasonalParticles('confetti', 'heavy', 42)).toEqual(buildSeasonalParticles('confetti', 'heavy', 42));
		expect(buildSeasonalParticles('confetti', 'heavy', 42)).not.toEqual(buildSeasonalParticles('confetti', 'heavy', 43));
	});

	test('every particle starts somewhere along its fall, so the screen starts full', () => {
		for (const effect of ['snow', 'leaves', 'confetti', 'christmas', 'petals', 'halloween']) {
			for (const seed of [1, 2, 3]) {
				for (const {style, path} of buildSeasonalParticles(effect, 'heavy', seed).falling) {
					expect(path).toMatch(/^(snow|leaves|confetti|petals)[0-3]$/);
					const left = parseFloat(style.left);
					expect(left).toBeGreaterThanOrEqual(0);
					expect(left).toBeLessThan(100);

					const duration = seconds(style.animationDuration);
					const delay = seconds(style.animationDelay);
					expect(delay).toBeLessThanOrEqual(0);
					expect(delay).toBeGreaterThan(-duration);
				}
			}
		}
	});

	test('writes the Webkit animation names that Chrome 38 needs', () => {
		const [particle] = buildSeasonalParticles('snow', 'light', 1).falling;
		expect(particle.style.WebkitAnimationDuration).toBe(particle.style.animationDuration);
		expect(particle.style.WebkitAnimationDelay).toBe(particle.style.animationDelay);

		const [burst] = buildSeasonalParticles('fireworks', 'light', 1).bursts;
		expect(burst.partStyle.WebkitAnimationDuration).toBe(`${BURST_SECONDS}s`);
		// The mover steps through five spots, one per burst, in step with it.
		expect(seconds(burst.moverStyle.animationDuration)).toBe(BURST_SECONDS * 5);
		expect(burst.moverStyle.animationDelay).toBe(burst.partStyle.animationDelay);
	});

	test('nearer snow is bigger, brighter, quicker and sways wider', () => {
		const dots = buildSeasonalParticles('snow', 'heavy', 5).falling
			.filter(p => p.shape === 'dot')
			.sort((a, b) => parseFloat(a.style.width) - parseFloat(b.style.width));
		const small = dots[0];
		const big = dots[dots.length - 1];
		expect(big.style.opacity).toBeGreaterThan(small.style.opacity);
		expect(seconds(big.style.animationDuration)).toBeLessThan(seconds(small.style.animationDuration));
		expect(Number(small.path.slice(-1)) % 2).toBe(0);
		expect(Number(big.path.slice(-1)) % 2).toBe(1);
	});

	test('sparks land on the ring, inside its box', () => {
		for (const spark of buildSeasonalParticles('fireworks', 'heavy', 9).bursts[0].sparks) {
			const x = parseFloat(spark.style.left) - 50;
			const y = parseFloat(spark.style.top) - 50;
			const radius = Math.sqrt(x * x + y * y);
			expect(radius).toBeGreaterThan(30);
			expect(radius).toBeLessThanOrEqual(50.01);
		}
	});

	test('christmas mixes baubles and stars into the snow', () => {
		const {falling} = buildSeasonalParticles('christmas', 'heavy', 4);
		expect([...new Set(falling.map(p => p.shape))].sort()).toEqual(['bauble', 'dot', 'flake', 'star']);
		for (const p of falling) expect(p.path).toMatch(/^snow[0-3]$/);
	});

	test('spring drops petals and whole blossoms and sends bees across', () => {
		const {falling, flyers} = buildSeasonalParticles('petals', 'heavy', 6);
		expect(new Set(falling.map(p => p.shape))).toEqual(new Set(['petal', 'blossom']));
		for (const p of falling) expect(p.path).toMatch(/^petals[0-3]$/);
		for (const p of falling.filter(f => f.shape === 'petal')) {
			expect(parseFloat(p.style.width)).toBeLessThan(parseFloat(p.style.height));
		}
		expect(flyers).toHaveLength(FLYER_COUNTS.petals.heavy);
		for (const f of flyers) expect(f.sprite).toMatch(/^bee(Left|Right)$/);
	});

	test('bees turn to face the way their flight goes', () => {
		for (const f of buildSeasonalParticles('petals', 'heavy', 6).flyers) {
			expect(f.sprite).toBe(f.path.startsWith('flyLeft') ? 'beeLeft' : 'beeRight');
		}
	});

	test('fireflies sit at a spot of their own and glow in their own color', () => {
		for (const p of buildSeasonalParticles('fireflies', 'heavy', 8).falling) {
			expect(p.shape).toBe('firefly');
			expect(p.path).toMatch(/^fireflies[0-3]$/);
			expect(parseFloat(p.style.top)).toBeGreaterThanOrEqual(25);
			expect(p.style.backgroundImage).toMatch(/^radial-gradient/);
			expect(p.style.opacity).toBeUndefined();
		}
	});

	test('halloween flyers cross on their own paths at each density', () => {
		for (const density of ['light', 'normal', 'heavy']) {
			const {falling, flyers} = buildSeasonalParticles('halloween', density, 2);
			expect(flyers).toHaveLength(FLYER_COUNTS.halloween[density]);
			for (const p of falling) expect(p.path).toMatch(/^leaves[0-3]$/);
			for (const f of flyers) {
				expect(f.path).toMatch(/^fly(Left|Right)[01]$/);
				expect(f.style.WebkitAnimationDelay).toBe(f.style.animationDelay);
				expect(f.spriteStyle.WebkitAnimationDuration).toBe(f.spriteStyle.animationDuration);
			}
		}
	});

	test('halloween sends bats and a ghost over candy and leaves', () => {
		const {falling, flyers} = buildSeasonalParticles('halloween', 'heavy', 2);
		expect(new Set(flyers.map(f => f.sprite))).toEqual(new Set(['bat', 'ghost']));
		expect(new Set(falling.map(p => p.shape))).toEqual(new Set(['candy', 'leaf', 'leafMirror']));
	});

	test('only spring and halloween have flyers', () => {
		for (const effect of ['snow', 'christmas', 'fireflies', 'leaves', 'confetti', 'fireworks']) {
			expect(buildSeasonalParticles(effect, 'heavy', 1).flyers).toHaveLength(0);
		}
	});

	test('draws nothing for none or an effect it does not know', () => {
		const empty = {falling: [], flyers: [], bursts: []};
		expect(buildSeasonalParticles('none', 'normal', 1)).toEqual(empty);
		expect(buildSeasonalParticles('aurora', 'normal', 1)).toEqual(empty);
	});
});
