export const computePerfTier = (ua) => {
	const match = (ua || '').match(/Chrome\/(\d+)/);
	if (!match) return 'low';
	const major = parseInt(match[1], 10);
	if (!(major >= 56)) return 'low';
	if (major < 85) return 'mid';
	return 'high';
};

// What the setting offers, best looking first. The values are the stored ones, so the three that
// existed before (high, mid and low, once called High Quality, Balanced and Performance) keep their
// meaning, and low stays the lowest of all.
export const PERF_LEVELS = ['ultra', 'high', 'midhigh', 'mid', 'lowmid', 'low'];

// The three engine tiers the stylesheets and the code already know. Several levels share one, and
// the extra classes below tell them apart without changing how anything looks until it has to.
const TIER_OF_LEVEL = {ultra: 'high', high: 'high', midhigh: 'high', mid: 'mid', lowmid: 'mid', low: 'low'};

let detectedTier = null;
let overrideTier = null;
let currentLevel = null;

export const getDetectedPerfTier = () => {
	if (detectedTier === null) {
		detectedTier = computePerfTier(typeof navigator !== 'undefined' ? navigator.userAgent : '');
	}
	return detectedTier;
};

export const getPerfTier = () => overrideTier || getDetectedPerfTier();

// Position in PERF_LEVELS, 0 being Ultra. Auto lands on the level that matches the engine.
export const getPerfLevelIndex = () => {
	const level = currentLevel || (getDetectedPerfTier() === 'high' ? 'high' : getDetectedPerfTier());
	return Math.max(0, PERF_LEVELS.indexOf(level));
};

// Layers and costs nobody can see go first, from High down. Medium-High and below drop effects
// that are hardly noticed, and Low and Performance drop the rest of the extras.
export const perfClassesFor = (levelIndex) => {
	const classes = [];
	if (levelIndex >= 1) classes.push('perf-lite');
	if (levelIndex >= 2) classes.push('perf-trim');
	if (levelIndex >= 4) classes.push('perf-lean');
	return classes;
};

export const applyPerfTier = (mode) => {
	currentLevel = PERF_LEVELS.indexOf(mode) >= 0 ? mode : null;
	overrideTier = currentLevel ? TIER_OF_LEVEL[currentLevel] : null;
	if (typeof document === 'undefined') return;
	const root = document.documentElement;
	const classes = [];
	const existing = root.className.split(/\s+/);
	for (let i = 0; i < existing.length; i++) {
		if (existing[i] && existing[i].indexOf('perf-') !== 0) classes.push(existing[i]);
	}
	classes.push('perf-' + getPerfTier());
	perfClassesFor(getPerfLevelIndex()).forEach((name) => classes.push(name));
	root.className = classes.join(' ');
};
