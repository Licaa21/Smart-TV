import {MAX_RESULTS, buildSettingsIndex, matchSettings, normalize, resultSpotlightId} from './settingsSearch';

// A stand-in schema so these tests never reach for i18n or the real settings tree.
const resolve = (value, ctx) => (typeof value === 'function' ? value(ctx) : value);
const spotlightIdOf = (row) => {
	if (row.kind === 'info') return `info-${row.id}`;
	if (row.kind === 'nav') return `setting-${row.id}`;
	return `setting-${row.key}`;
};
const deps = {resolve, spotlightIdOf};

const schema = [
	{
		id: 'playback',
		label: 'Playback',
		icon: 'playback',
		subcategories: [
			{
				id: 'video',
				label: 'Video',
				description: 'Quality and seeking',
				rows: [
					{kind: 'toggle', key: 'autoPlay', label: 'Auto Play Next', desc: 'Play the next episode'},
					{kind: 'option', key: 'maxBitrate', label: 'Maximum Bitrate', options: () => [{value: 0, label: 'Auto'}]},
					{kind: 'divider', id: 'sep'},
					{kind: 'section', id: 'advanced', label: 'Advanced'},
					{kind: 'toggle', key: 'forceDirectPlay', label: 'Force Direct Play'}
				]
			},
			{
				id: 'queue',
				label: 'Automation',
				description: 'Next up behavior',
				rows: [
					{kind: 'toggle', key: 'autoPlay', label: 'Episode Queuing', desc: 'Play the next episode'}
				]
			},
			{
				id: 'subtitles',
				label: 'Subtitles',
				rows: [
					{kind: 'option', key: 'subtitlePosition', label: 'Subtitle Position', options: () => []},
					{
						kind: 'slider',
						key: 'subtitlePositionAbsolute',
						label: 'Absolute Position',
						when: (ctx) => ctx.settings.subtitlePosition === 'absolute'
					}
				]
			},
			{id: 'downloads', label: 'Offline Downloads', description: 'Nothing yet', search: false, rows: []},
			{id: 'empty', label: 'Empty Screen', rows: []},
			{
				id: 'hidden',
				label: 'Hidden Screen',
				when: (ctx) => ctx.showHidden,
				rows: [{kind: 'toggle', key: 'hiddenThing', label: 'Hidden Thing'}]
			}
		]
	}
];

const ctxWith = (overrides = {}) => ({
	settings: {subtitlePosition: 'bottom'},
	showHidden: false,
	...overrides
});

const build = (ctx = ctxWith()) => buildSettingsIndex(schema, ctx, deps);
const idsOf = (entries) => entries.map((entry) => entry.id);

describe('buildSettingsIndex', () => {
	test('skips rows whose condition is not met', () => {
		const ids = idsOf(build());
		expect(ids).not.toContain('playback.subtitles.subtitlePositionAbsolute');
	});

	test('includes a gated row once its condition is met', () => {
		const ctx = ctxWith({settings: {subtitlePosition: 'absolute'}});
		expect(idsOf(build(ctx))).toContain('playback.subtitles.subtitlePositionAbsolute');
	});

	test('skips a whole screen whose condition is not met', () => {
		expect(idsOf(build())).not.toContain('playback.hidden.hiddenThing');
		expect(idsOf(build(ctxWith({showHidden: true})))).toContain('playback.hidden.hiddenThing');
	});

	test('a key used on two screens becomes two entries with their own labels', () => {
		const matches = build().filter((entry) => entry.spotlightId === 'setting-autoPlay');
		expect(matches).toHaveLength(2);
		expect(matches.map((entry) => entry.title).sort()).toEqual(['Auto Play Next', 'Episode Queuing']);
		expect(matches[0].breadcrumb).not.toBe(matches[1].breadcrumb);
	});

	test('every entry id is unique', () => {
		const ids = idsOf(build(ctxWith({showHidden: true, settings: {subtitlePosition: 'absolute'}})));
		expect(new Set(ids).size).toBe(ids.length);
	});

	test('dividers and section titles are not searchable', () => {
		const ids = idsOf(build());
		expect(ids).not.toContain('playback.video.sep');
		expect(ids).not.toContain('playback.video.advanced');
	});

	test('a section title is searchable but stays out of the breadcrumb', () => {
		const entry = build().find((e) => e.id === 'playback.video.forceDirectPlay');
		expect(entry.breadcrumb).toBe('Playback › Video');
		expect(entry.haystackBody).toContain('advanced');
	});

	test('a nested screen names the screen it opens from, and a root page is not named twice', () => {
		const nested = [{
			id: 'appearance',
			label: 'Appearance',
			subcategories: [
				{id: 'appearance', label: 'Appearance', rows: [{kind: 'toggle', key: 'cardFocusZoom', label: 'Focus Expansion'}]},
				{id: 'homeScreen', label: 'Home Screen', menu: false, rows: [{kind: 'toggle', key: 'fullScreenRows', label: 'Expanded Rows'}]},
				{id: 'rowOptions', label: 'Row Options', menu: false, parent: 'homeScreen', rows: [
					{kind: 'section', id: 'genres', label: 'Genres'},
					{kind: 'toggle', key: 'displayGenresRows', label: 'Display Genres Rows'}
				]}
			]
		}];
		const entries = buildSettingsIndex(nested, {}, deps);
		const byId = (id) => entries.find((entry) => entry.id === id);

		expect(byId('appearance.appearance.cardFocusZoom').breadcrumb).toBe('Appearance');
		expect(byId('appearance.homeScreen.fullScreenRows').breadcrumb).toBe('Appearance › Home Screen');
		expect(byId('appearance.rowOptions.displayGenresRows').breadcrumb).toBe('Appearance › Home Screen › Row Options');
		expect(byId('screen:appearance.rowOptions').breadcrumb).toBe('Appearance › Home Screen');
	});

	test('screens with no rows are not offered as destinations', () => {
		const ids = idsOf(build());
		expect(ids).not.toContain('screen:playback.downloads');
		expect(ids).not.toContain('screen:playback.empty');
		expect(ids).toContain('screen:playback.video');
	});
});

describe('matchSettings', () => {
	const index = build();

	test('ignores a query shorter than the minimum', () => {
		expect(matchSettings(index, 'a')).toEqual([]);
		expect(matchSettings(index, '')).toEqual([]);
	});

	test('finds a setting by a word in its title', () => {
		expect(idsOf(matchSettings(index, 'bitrate'))).toContain('playback.video.maxBitrate');
	});

	test('requires every word to match', () => {
		expect(matchSettings(index, 'auto play')).not.toHaveLength(0);
		expect(matchSettings(index, 'auto zzzz')).toEqual([]);
	});

	test('a title match outranks a description only match', () => {
		const results = matchSettings(index, 'episode');
		// "Episode Queuing" has it in the title, "Auto Play Next" only in its description.
		expect(results[0].id).toBe('playback.queue.autoPlay');
	});

	test('a setting outranks a screen when both match by title', () => {
		// "Subtitle Position" and the "Subtitles" screen both start with the query, so the
		// tie is broken in favour of the actual setting.
		const results = matchSettings(index, 'subtitle');
		expect(results[0].id).toBe('playback.subtitles.subtitlePosition');
	});

	test('a screen still wins when only its own title matches', () => {
		// Nothing on the Video screen is called "video", so the screen is the useful hit.
		const results = matchSettings(index, 'video');
		expect(results[0].id).toBe('screen:playback.video');
	});

	test('honours the result cap', () => {
		const big = [];
		for (let i = 0; i < 50; i++) {
			big.push({
				id: `x${i}`, type: 'setting', title: 'Match', breadcrumb: '',
				haystackTitle: 'match', haystackBody: ''
			});
		}
		expect(matchSettings(big, 'match')).toHaveLength(MAX_RESULTS);
	});

	test('is not case sensitive', () => {
		expect(idsOf(matchSettings(index, 'BITRATE'))).toContain('playback.video.maxBitrate');
	});
});

describe('normalize', () => {
	test('collapses whitespace and lowercases', () => {
		expect(normalize('  Auto   Play  ')).toBe('auto play');
	});

	test('handles null and undefined', () => {
		expect(normalize(null)).toBe('');
		expect(normalize(undefined)).toBe('');
	});
});

describe('resultSpotlightId', () => {
	// The same check Spotlight.focus makes before it looks a string up as a spotlight id rather
	// than as a CSS selector.
	test('gives every entry an id spotlight can focus by name', () => {
		const entries = build(ctxWith({showHidden: true, settings: {subtitlePosition: 'absolute'}}));
		entries.forEach((entry) => {
			expect(resultSpotlightId(entry)).toMatch(/^[\w\d-]+$/);
		});
	});
});
