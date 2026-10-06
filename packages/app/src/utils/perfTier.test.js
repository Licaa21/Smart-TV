import {PERF_LEVELS, applyPerfTier, computePerfTier, getPerfLevelIndex, getPerfTier, perfClassesFor} from './perfTier';

describe('computePerfTier', () => {
	test('Tizen 2.4 WebKit (no Chrome token) is low', () => {
		expect(computePerfTier('Mozilla/5.0 (SMART-TV; Linux; Tizen 2.4.0) AppleWebKit/538.1 (KHTML, like Gecko) Version/2.4 TV Safari/538.1')).toBe('low');
	});

	test('webOS 3.x Chromium 38 is low', () => {
		expect(computePerfTier('Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/38.0.2125.122 Safari/537.36 LG Browser/8.00.00(LGE; 55UH8500-UA; 03.20.50)')).toBe('low');
	});

	test('Tizen 3.0 Chromium 47 is low', () => {
		expect(computePerfTier('Mozilla/5.0 (SMART-TV; LINUX; Tizen 3.0) AppleWebKit/538.1 (KHTML, like Gecko) Version/3.0 Chrome/47.0.2526.69 TV safari/538.1')).toBe('low');
	});

	test('webOS 4.x Chromium 53 is low', () => {
		expect(computePerfTier('Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2785.34 Safari/537.36 WebAppManager')).toBe('low');
	});

	test('Tizen 4.0 Chromium 56 is mid', () => {
		expect(computePerfTier('Mozilla/5.0 (SMART-TV; LINUX; Tizen 4.0) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/56.0.2924.0 TV safari/537.36')).toBe('mid');
	});

	test('webOS 5.x Chromium 68 is mid', () => {
		expect(computePerfTier('Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.106 Safari/537.36 WebAppManager')).toBe('mid');
	});

	test('webOS 6.x Chromium 79 is mid', () => {
		expect(computePerfTier('Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.79 Safari/537.36 WebAppManager')).toBe('mid');
	});

	test('Tizen 6.5 Chromium 85 is high', () => {
		expect(computePerfTier('Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.93 TV Safari/537.36')).toBe('high');
	});

	test('webOS 22 Chromium 87 is high', () => {
		expect(computePerfTier('Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36 WebAppManager')).toBe('high');
	});

	test('Chromium 120 is high', () => {
		expect(computePerfTier('Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 WebAppManager')).toBe('high');
	});

	// The stick rasters on its GPU, so Home rows, the keyboard and details pages
	// all hold 60 fps on high, measured on a Fire TV Stick 4K 3rd Gen.
	test('a Fire TV stick on Vega OS is high', () => {
		expect(computePerfTier('Mozilla/5.0 (Linux; Kepler 2.0; AFTCR001 user/55; wv) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Chrome/144.0.7559.246 Safari/537.36')).toBe('high');
	});

	test('empty and garbage UAs are low', () => {
		expect(computePerfTier('')).toBe('low');
		expect(computePerfTier(undefined)).toBe('low');
		expect(computePerfTier('Mozilla/5.0 Chrome/NaN')).toBe('low');
	});
});

describe('performance levels', () => {
	const rootClasses = () => document.documentElement.className.split(' ').filter((name) => name.indexOf('perf-') === 0);

	afterEach(() => applyPerfTier(null));

	test('are listed best looking first, with the old three keeping their values', () => {
		expect(PERF_LEVELS).toEqual(['ultra', 'high', 'midhigh', 'mid', 'lowmid', 'low']);
	});

	test('Ultra drops nothing, and each step down adds only to what the one above dropped', () => {
		expect(perfClassesFor(0)).toEqual([]);
		expect(perfClassesFor(1)).toEqual(['perf-lite']);
		expect(perfClassesFor(2)).toEqual(['perf-lite', 'perf-trim']);
		expect(perfClassesFor(3)).toEqual(['perf-lite', 'perf-trim']);
		expect(perfClassesFor(4)).toEqual(['perf-lite', 'perf-trim', 'perf-lean']);
		expect(perfClassesFor(5)).toEqual(['perf-lite', 'perf-trim', 'perf-lean']);
	});

	test('the levels share the three engine tiers the stylesheets know', () => {
		const tierOf = (level) => { applyPerfTier(level); return getPerfTier(); };
		expect(['ultra', 'high', 'midhigh'].map(tierOf)).toEqual(['high', 'high', 'high']);
		expect(['mid', 'lowmid'].map(tierOf)).toEqual(['mid', 'mid']);
		expect(tierOf('low')).toBe('low');
	});

	test('picking a level sets its tier and extra classes on the page, and replaces the last ones', () => {
		applyPerfTier('midhigh');
		expect(rootClasses()).toEqual(['perf-high', 'perf-lite', 'perf-trim']);
		expect(getPerfLevelIndex()).toBe(2);
		applyPerfTier('low');
		expect(rootClasses()).toEqual(['perf-low', 'perf-lite', 'perf-trim', 'perf-lean']);
	});

	test('anything that is not a level, such as Auto, goes back to the engine', () => {
		applyPerfTier('low');
		applyPerfTier(null);
		expect(getPerfTier()).toBe(computePerfTier(navigator.userAgent));
		applyPerfTier('balanced');
		expect(getPerfTier()).toBe(computePerfTier(navigator.userAgent));
	});
});
