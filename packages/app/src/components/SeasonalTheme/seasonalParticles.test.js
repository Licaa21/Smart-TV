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
		for (const effect of ['snow', 'christmas', 'fireflies', 'leaves', 'confetti', 'fireworks', 'valentines', 'easter', 'pride', 'lunar', 'diwali']) {
			expect(buildSeasonalParticles(effect, 'heavy', 1).flyers).toHaveLength(0);
		}
	});

	test('the holiday effects fill the screen at their share of the count', () => {
		for (const tier of ['low', 'high']) {
			for (const effect of ['valentines', 'easter', 'pride', 'lunar', 'diwali']) {
				const {falling, flyers, bursts} = buildSeasonalParticles(effect, 'normal', 3, tier);
				expect(falling).toHaveLength(Math.round(FALL_COUNTS[tier].normal * (COUNT_SHARE[effect] || 1)));
				expect(flyers).toHaveLength(0);
				expect(bursts).toHaveLength(0);
			}
		}
		expect(COUNT_SHARE.lunar).toBe(0.5);
		expect(COUNT_SHARE.diwali).toBeUndefined();
	});

	test('valentines drops hearts in its own reds and pinks, turning over like petals', () => {
		for (const p of buildSeasonalParticles('valentines', 'heavy', 7).falling) {
			expect(p.shape).toBe('heart');
			expect(p.path).toMatch(/^petals[0-3]$/);
			expect(p.style.backgroundImage).toMatch(/^url\("data:image\/svg\+xml;charset=utf8,/);
			const fill = decodeURIComponent(p.style.backgroundImage).match(/stop-color="(#[0-9a-f]{6})"/)[1];
			expect(['#e53950', '#d81b60', '#ff4d6d', '#ff8fab', '#c2185b', '#ffb3c6']).toContain(fill);
		}
	});

	test('easter mixes painted eggs that only sway into pastel petals', () => {
		const {falling} = buildSeasonalParticles('easter', 'heavy', 5);
		const eggs = falling.filter(p => p.shape === 'egg');
		const petals = falling.filter(p => p.shape === 'petal');
		expect(eggs.length + petals.length).toBe(falling.length);
		expect(eggs.length).toBeGreaterThan(0);
		for (const egg of eggs) {
			expect(egg.path).toMatch(/^leaves[0-3]$/);
			expect(decodeURIComponent(egg.style.backgroundImage)).toContain('<polyline');
		}
		for (const petal of petals) {
			expect(petal.path).toMatch(/^petals[0-3]$/);
			expect(['#b3e5fc', '#f8bbd0', '#fff59d', '#c5e1a5', '#d1c4e9', '#ffccbc']).toContain(petal.style.backgroundColor);
		}
	});

	test('about a third of easter is eggs, a fifth of diwali stars and nearly half of lunar lanterns', () => {
		const share = (effect, shapes) => {
			let count = 0;
			let total = 0;
			for (let seed = 1; seed <= 40; seed++) {
				const {falling} = buildSeasonalParticles(effect, 'heavy', seed);
				count += falling.filter(p => shapes.includes(p.shape)).length;
				total += falling.length;
			}
			return count / total;
		};
		expect(share('easter', ['egg'])).toBeCloseTo(0.35, 1);
		expect(share('diwali', ['star', 'paleStar'])).toBeCloseTo(0.2, 1);
		expect(share('lunar', ['lantern'])).toBeCloseTo(0.45, 1);
	});

	test('pride is confetti in the flag colors', () => {
		const pride = ['#e40303', '#ff8c00', '#ffed00', '#008026', '#004dff', '#750787', '#5bcefa', '#f5a9b8', '#ffffff'];
		for (const p of buildSeasonalParticles('pride', 'heavy', 2).falling) {
			expect(p.path).toMatch(/^confetti[0-3]$/);
			expect(['strip', 'disc']).toContain(p.shape);
			expect(pride).toContain(p.style.backgroundColor);
		}
	});

	test('lunar new year sends lanterns and flickering embers up from below', () => {
		const {falling} = buildSeasonalParticles('lunar', 'heavy', 4);
		expect(new Set(falling.map(p => p.shape))).toEqual(new Set(['lantern', 'ember']));
		for (const p of falling.filter(f => f.shape === 'lantern')) {
			expect(p.path).toMatch(/^rise[0-3]$/);
			expect(p.style.opacity).toBeGreaterThan(0);
		}
		for (const p of falling.filter(f => f.shape === 'ember')) {
			expect(p.path).toMatch(/^riseFlicker[0-3]$/);
			expect(p.style.opacity).toBeUndefined();
			expect(p.style.backgroundImage).toMatch(/^radial-gradient/);
		}
		for (const p of falling) {
			// Between 0.03 and 0.06 screen heights a second over the 124vh climb.
			const rise = seconds(p.style.animationDuration);
			expect(rise).toBeGreaterThanOrEqual(20.5);
			expect(rise).toBeLessThanOrEqual(41);
		}
	});

	test('diwali sends twinkling stars and flickering embers up from below', () => {
		const {falling} = buildSeasonalParticles('diwali', 'heavy', 6);
		const stars = falling.filter(p => p.shape === 'star' || p.shape === 'paleStar');
		expect(stars.length).toBeGreaterThan(0);
		expect(stars.length).toBeLessThan(falling.length / 2);
		for (const p of stars) expect(p.path).toMatch(/^riseTwinkle[0-3]$/);
		for (const p of falling.filter(f => f.shape === 'ember')) expect(p.path).toMatch(/^riseFlicker[0-3]$/);
	});

	test('a flicker is a second animation on the same element, timed after the rise', () => {
		for (const p of buildSeasonalParticles('diwali', 'heavy', 6).falling) {
			const durations = p.style.animationDuration.split(', ');
			const delays = p.style.animationDelay.split(', ');
			expect(durations).toHaveLength(2);
			expect(delays).toHaveLength(2);
			expect(p.style.WebkitAnimationDuration).toBe(p.style.animationDuration);
			expect(p.style.WebkitAnimationDelay).toBe(p.style.animationDelay);
			expect(seconds(delays[0])).toBeGreaterThan(-seconds(durations[0]));
			// It runs back and forth, so a whole cycle is two of its durations.
			expect(seconds(delays[1])).toBeGreaterThanOrEqual(-2 * seconds(durations[1]));
		}
	});

	test('draws nothing for none or an effect it does not know', () => {
		const empty = {falling: [], flyers: [], bursts: []};
		expect(buildSeasonalParticles('none', 'normal', 1)).toEqual(empty);
		expect(buildSeasonalParticles('aurora', 'normal', 1)).toEqual(empty);
	});
});
