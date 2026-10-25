import {buildThemeOverrideCss} from './themeOverrides';
import {resolveThemeById} from './themeRegistry';
import {contrastRatio, inkOn, toCssColor, MIN_BUTTON_CONTRAST} from './themeSpec';

describe('buildThemeOverrideCss', () => {
	it('scopes every rule to the active theme id', () => {
		const css = buildThemeOverrideCss(resolveThemeById('moonfin'));
		const selectors = css.split('\n').filter(Boolean);
		expect(selectors.length).toBeGreaterThan(50);
		for (const line of selectors) {
			expect(line.startsWith("html[data-theme-id='moonfin'][data-theme-id]")).toBe(true);
		}
	});

	it('emits literal theme colors instead of custom properties', () => {
		const css = buildThemeOverrideCss(resolveThemeById('moonfin'));
		expect(css).toContain('rgb(0, 164, 220)');
		expect(css).not.toContain('var(--theme');
	});

	it('emits the nav color cycle per slot for themes that have one', () => {
		const css = buildThemeOverrideCss(resolveThemeById('neon_pulse'));
		expect(css).toContain("[data-nav-slot='1'] { color: rgb(255, 46, 146); }");
		expect(css).toContain("[data-nav-slot='2'] { color: rgb(0, 229, 255); }");
		const moonfin = buildThemeOverrideCss(resolveThemeById('moonfin'));
		expect(moonfin).not.toContain('data-nav-slot');
	});

	it('squares off radii for pixel themes', () => {
		const css = buildThemeOverrideCss(resolveThemeById('8bit_hero'));
		expect(css).toContain('border-radius: 0;');
		const moonfin = buildThemeOverrideCss(resolveThemeById('moonfin'));
		const rounded = moonfin.split('\n').filter((line) => !line.includes('].vega '));
		expect(rounded.join('\n')).not.toContain('border-radius: 0;');
	});

	it('squares the preview frame, ring and container on the Fire TV for both card styles', () => {
		const css = buildThemeOverrideCss(resolveThemeById('moonfin'));
		const squared = css.split('\n').filter((line) => line.includes('border-radius: 0;'));
		expect(squared).toHaveLength(2);
		for (const line of squared) {
			expect(line.startsWith("html[data-theme-id='moonfin'][data-theme-id].vega .")).toBe(true);
			expect(line.split('].vega .')).toHaveLength(4);
		}
	});

	it('carries theme fonts as far as the wrapper that names its own', () => {
		const eightbit = buildThemeOverrideCss(resolveThemeById('8bit_hero'));
		expect(eightbit).toContain('.sandstone-theme');
		expect(eightbit).toContain("font-family: 'EightBitHero', sans-serif;");
		// Neon Pulse saves its display face for titles and reads body copy in the
		// condensed companion.
		const neon = buildThemeOverrideCss(resolveThemeById('neon_pulse'));
		expect(neon).toContain("font-family: 'NeonPulseBody', sans-serif; letter-spacing: 0.6px;");
		const moonfin = buildThemeOverrideCss(resolveThemeById('moonfin'));
		expect(moonfin).not.toContain('font-family');
	});

	it('fills the media bar card from its own overlay setting', () => {
		const theme = resolveThemeById('moonfin');
		// Three quarters of the chosen opacity.
		expect(buildThemeOverrideCss(theme, {mediaBarOverlayColor: 'black', mediaBarOverlayOpacity: 100}))
			.toContain('background-color: rgba(0, 0, 0, 0.75)');
		expect(buildThemeOverrideCss(theme)).toContain('background-color: rgba(107, 114, 128, 0.375)');
	});

	it('prefers the focus border color setting over the theme focus border', () => {
		const theme = resolveThemeById('moonfin');
		expect(buildThemeOverrideCss(theme, {focusBorderColor: '#ff0000'})).toContain('rgb(255, 0, 0)');
		expect(buildThemeOverrideCss(theme, {focusBorderColor: 'nonsense'})).not.toContain('nonsense');
	});
});

describe('ink on a focused row', () => {
	it('picks dark text on a bright fill and light on a dim one', () => {
		expect(inkOn('#FF00E5FF')).toBe('0, 0, 0');
		expect(inkOn('#FFFFCD75')).toBe('0, 0, 0');
		expect(inkOn('#FF00A4DC')).toBe('0, 0, 0');
		expect(inkOn('#FF101010')).toBe('255, 255, 255');
		expect(inkOn('#FF2A2A2A')).toBe('255, 255, 255');
	});

	// A focused settings row fills with the theme's focused button colour and writes on it in that
	// colour's ink.
	it('fills every theme\'s focused settings rows with its focused button colour and writes in its ink', () => {
		for (const id of ['moonfin', 'neon_pulse', '8bit_hero']) {
			const theme = resolveThemeById(id);
			const fill = theme.colors.buttonFocused;
			const ink = inkOn(fill);
			const css = buildThemeOverrideCss(theme);

			expect(css).toContain(`rgba(${ink}, 0.87)`);
			expect(css).toContain(`rgba(${ink}, 0.54)`);
			expect(css).toContain(`background: ${toCssColor(fill)};`);
		}
	});

	// The one rule that fills a button with the theme's focus colour and writes on it.
	const focusedButtonRule = (id) => buildThemeOverrideCss(resolveThemeById(id))
		.split('\n')
		.find((line) => line.includes('.actionButton:focus'));

	it('drops a button colour the theme asked for when it cannot be read on its own fill', () => {
		// Neon Pulse asks for white on a bright cyan, which comes to 1.5 to 1.
		const neon = resolveThemeById('neon_pulse');
		expect(contrastRatio(neon.colors.buttonFocused, neon.colors.onButtonFocused)).toBeLessThan(MIN_BUTTON_CONTRAST);
		expect(focusedButtonRule('neon_pulse')).toContain('color: rgba(0, 0, 0, 0.92)');
	});

	it('keeps a button colour the theme asked for when it holds up', () => {
		// 8bit Hero pairs a dark ink with its own amber, which reads at 11 to 1.
		const pixel = resolveThemeById('8bit_hero');
		expect(contrastRatio(pixel.colors.buttonFocused, pixel.colors.onButtonFocused)).toBeGreaterThan(MIN_BUTTON_CONTRAST);
		expect(focusedButtonRule('8bit_hero')).toContain(`color: ${toCssColor(pixel.colors.onButtonFocused)}`);
	});

	it('leaves every theme with readable text on a focused button', () => {
		for (const id of ['moonfin', 'neon_pulse', '8bit_hero']) {
			const theme = resolveThemeById(id);
			const declared = contrastRatio(theme.colors.buttonFocused, theme.colors.onButtonFocused);
			const fallback = contrastRatio(theme.colors.buttonFocused, inkOn(theme.colors.buttonFocused) === '0, 0, 0' ? '#FF000000' : '#FFFFFFFF');
			expect(Math.max(declared, fallback)).toBeGreaterThanOrEqual(MIN_BUTTON_CONTRAST);
		}
	});
});

describe('per-surface accents', () => {
	const moonfin = resolveThemeById('moonfin');
	const rulesFor = (accents) => buildThemeOverrideCss(moonfin, {accents}).split('\n');
	const withHandRule = (lines, needle) => lines.find((line) => line.includes(needle));

	it('changes nothing until a surface is given a color', () => {
		expect(buildThemeOverrideCss(moonfin, {accents: {}})).toBe(buildThemeOverrideCss(moonfin));
	});

	it('colors only the surface it was given to', () => {
		const lines = rulesFor({settings: '#ff0000'});
		expect(withHandRule(lines, '.toggleOn')).toContain('rgb(255, 0, 0)');
		// The details screen and the nav pill keep the theme's cyan.
		expect(withHandRule(lines, '.seasonEpCheck')).toContain('rgb(0, 164, 220)');
		expect(withHandRule(lines, '.active')).toContain('rgba(0, 164, 220');
	});

	it('takes each surface from its own pick', () => {
		const lines = rulesFor({navigation: '#00ff00', details: '#3b82f6'});
		expect(withHandRule(lines, '.active')).toContain('rgba(0, 255, 0');
		expect(withHandRule(lines, '.episodeProgressBar')).toContain('rgb(59, 130, 246)');
		expect(withHandRule(lines, '.toggleOn')).toContain('rgb(0, 164, 220)');
	});

	it('replays the stylesheets\' own accent declarations for a surface that has a pick', () => {
		const none = buildThemeOverrideCss(moonfin);
		const player = buildThemeOverrideCss(moonfin, {accents: {player: '#ff8800'}});
		expect(player.length).toBeGreaterThan(none.length);
		expect(player).toContain('rgb(255, 136, 0)');
		expect(player).toContain('rgba(255, 136, 0, 0.3)');
		expect(player).not.toContain('var(--');
	});

	it('keeps every rule scoped to the theme, media queries included', () => {
		const css = buildThemeOverrideCss(moonfin, {accents: {other: '#ff8800', liveTv: '#ff8800', home: '#ff8800'}});
		for (const line of css.split('\n').filter(Boolean)) {
			const body = line.startsWith('@') ? line.slice(line.indexOf('{') + 1).trim() : line;
			expect(body.startsWith("html[data-theme-id='moonfin'][data-theme-id]")).toBe(true);
		}
	});

	it('gives one selector its own rule so an unknown pseudo cannot void the rest', () => {
		const css = buildThemeOverrideCss(moonfin, {accents: {player: '#ff8800'}});
		const withFocusWithin = css.split('\n').filter((line) => line.includes(':focus-within'));
		expect(withFocusWithin.length).toBeGreaterThan(0);
		withFocusWithin.forEach((line) => expect(line.split('{')[0]).not.toContain(','));
	});

	it('ignores a value that is not a color', () => {
		expect(buildThemeOverrideCss(moonfin, {accents: {player: 'nonsense'}})).not.toContain('nonsense');
	});

	it('writes readable ink on a bright pick and keeps the theme ink on a dark one', () => {
		const bright = withHandRule(rulesFor({settings: '#ffff00'}), '.toggleOn .');
		const dark = withHandRule(rulesFor({settings: '#000080'}), '.toggleOn .');
		expect(bright).toContain('rgba(0, 0, 0, 0.92)');
		expect(dark).toBeDefined();
		expect(dark).not.toContain('rgba(0, 0, 0, 0.92)');
	});

	describe('visibility', () => {
		it('lifts a black pick so text drawn in the accent still shows on the dark screens', () => {
			const lines = rulesFor({details: '#000000'});
			const readMore = withHandRule(lines, '.readMoreBtn');
			expect(readMore).not.toContain('color: rgb(0, 0, 0)');
			const [r, g, b] = readMore.match(/rgb\((\d+), (\d+), (\d+)\)/).slice(1).map(Number);
			expect(r).toBeGreaterThan(60);
			expect([r, g, b].every((v) => v === r)).toBe(true);
		});

		it('leaves a pick that already shows exactly as it was picked', () => {
			expect(withHandRule(rulesFor({details: '#ffffff'}), '.readMoreBtn')).toContain('rgb(255, 255, 255)');
		});

		it('writes dark ink on the buttons of a surface that was given white, in the label as well', () => {
			const css = buildThemeOverrideCss(moonfin, {accents: {other: '#ffffff'}});
			const lines = css.split('\n');
			const button = lines.find((line) => line.includes('.btn:focus {') && line.includes('background: rgb(255, 255, 255)'));
			expect(button).toContain('color: rgba(0, 0, 0, 0.92)');
			expect(lines.some((line) => line.includes('.btn:focus *') && line.includes('color: rgba(0, 0, 0, 0.92)'))).toBe(true);
		});

		it('keeps the stylesheet\'s own text on a fill that white text still reads on', () => {
			const css = buildThemeOverrideCss(moonfin, {accents: {other: '#0a3d91'}});
			expect(css).not.toContain('.btn:focus *');
		});

		it('gives a heavy white tint dark ink and leaves a faint one alone', () => {
			const css = buildThemeOverrideCss(moonfin, {accents: {other: '#ffffff'}});
			const heavy = css.split('\n').find((line) => line.includes('.createBtn {') && line.includes('rgba(255, 255, 255, 0.85)'));
			expect(heavy).toContain('rgba(0, 0, 0, 0.92)');
			const faint = css.split('\n').find((line) => line.includes('rgba(255, 255, 255, 0.2)') && !line.includes('rgba(0, 0, 0, 0.92)'));
			expect(faint).toBeDefined();
		});

		it('keeps a black focus outline visible', () => {
			const css = buildThemeOverrideCss(moonfin, {focusBorderColor: '#000000'});
			expect(css).not.toContain('border-color: rgb(0, 0, 0)');
		});

		it('picks ink that reads on a bright accent for the hand written buttons too', () => {
			expect(withHandRule(rulesFor({settings: '#ffffff'}), '.toggleOn .')).toContain('rgba(0, 0, 0, 0.92)');
		});
	});

	describe('focused fills', () => {
		const focusRule = (lines, selector) => lines.find((line) => line.includes(`${selector} {`));

		it('gives Settings rows the picked color as their focused fill, with dark text on a white one', () => {
			const lines = rulesFor({settingsFocus: '#ffffff'});
			const row = focusRule(lines, '.themeCard:focus');
			expect(row).toContain('background: rgb(255, 255, 255)');
			expect(withHandRule(lines, '.listItem:focus .listItemHeading')).toContain('rgba(0, 0, 0, 0.96)');
			expect(lines.find((line) => line.includes('.actionButton:focus {') && line.includes('background'))).toContain('background: rgb(255, 255, 255)');
		});

		it('picks the text ink from the fill, dark on a bright pick', () => {
			const lines = rulesFor({settingsFocus: '#4a72d7'});
			expect(focusRule(lines, '.themeCard:focus')).toContain('background: rgb(74, 114, 215)');
			expect(withHandRule(lines, '.listItem:focus .listItemHeading')).toContain('rgba(0, 0, 0, 0.96)');
		});

		it('gives the details buttons the picked fill and readable icons', () => {
			const lines = rulesFor({details: '#ffffff'});
			expect(withHandRule(lines, '.btnWrapper:focus .btnAction {')).toContain('background: rgb(255, 255, 255)');
			expect(withHandRule(lines, '.btnWrapper:focus .btnAction .btnIcon')).toContain('rgba(0, 0, 0, 0.92)');
		});

		it('draws the check of a watched button in the focused ink since the focused fill is the pick itself, white or dark', () => {
			// A dark pick gets the light ink and a white one the dark ink. The stylesheet's own replay of the accent comes first and the hand rule after it, so the last one is what shows
			const last = (lines, needle) => lines.filter((line) => line.includes(needle)).pop();
			const white = rulesFor({details: '#ffffff'});
			expect(last(white, '.btnWrapper:focus .btnAction .watched')).toContain('color: rgba(0, 0, 0, 0.92)');
			expect(white.filter((line) => line.includes('.watched {') && !line.includes(':focus')).pop()).toContain('color: rgb(255, 255, 255)');
			const blue = rulesFor({details: '#123456'});
			expect(last(blue, '.btnWrapper:focus .btnAction .watched')).toContain('color: rgba(255, 255, 255, 0.92)');
		});

		it('leaves the check of a watched button in the theme accent while no details accent is picked', () => {
			const focused = rulesFor({}).filter((line) => line.includes('.btnWrapper:focus .btnAction .watched')).pop();
			expect(focused).toContain(toCssColor(moonfin.colors.accent));
		});

		it('keeps the focused fill and the rest of Settings apart, so each takes only its own pick', () => {
			const focusOnly = rulesFor({settingsFocus: '#ffffff'});
			expect(focusRule(focusOnly, '.themeCard:focus')).toContain('background: rgb(255, 255, 255)');
			// The theme's own cyan only reads at 2.86:1 against white, under the 3:1 floor, so
			// picking white for Settings Focus alone (with no pick of its own for Settings) is
			// already enough to nudge the toggle just off the theme's blue to stay visible on it -
			// not snapped to the focus pick itself, which would be a much bigger jump than this.
			const toggleOnFocusWhite = withHandRule(focusOnly, '.toggleOn');
			expect(toggleOnFocusWhite).not.toContain('rgb(0, 164, 220)');
			expect(toggleOnFocusWhite).not.toContain('rgb(255, 255, 255)');

			const restOnly = rulesFor({settings: '#ff0000'});
			expect(withHandRule(restOnly, '.toggleOn')).toContain('rgb(255, 0, 0)');
			expect(focusRule(restOnly, '.themeCard:focus')).not.toContain('background: rgb(255, 0, 0)');
		});

		it('leaves the theme\'s fill alone on a surface that was not picked', () => {
			const lines = rulesFor({details: '#123456'});
			expect(focusRule(lines, '.themeCard:focus')).not.toContain('background: rgb(18, 52, 86)');
		});

		describe('the circle counting the unplayed episodes of a series', () => {
			const countRules = (accents) => rulesFor(accents).filter((line) => line.includes('.unplayedCount {'));

			it('keeps the theme badge color until the surface was given an accent', () => {
				const rules = countRules({});
				expect(rules.length).toBeGreaterThan(0);
				rules.forEach((rule) => expect(rule).toContain('background: rgb(0, 164, 220)'));
			});

			it('follows the Home accent on the cards, and the Details accent on the details screen', () => {
				const home = countRules({home: '#ff8800'});
				expect(home.some((rule) => rule.includes('background: rgb(255, 136, 0)'))).toBe(true);
				expect(home.some((rule) => rule.includes('background: rgb(0, 164, 220)'))).toBe(true);
				const details = countRules({details: '#ff8800'});
				expect(details.some((rule) => rule.includes('background: rgb(255, 136, 0)'))).toBe(true);
			});

			it('writes dark ink on a white one', () => {
				const white = countRules({home: '#ffffff'}).filter((rule) => rule.includes('background: rgb(255, 255, 255)'));
				expect(white.length).toBeGreaterThan(0);
				white.forEach((rule) => expect(rule).toContain('color: rgba(0, 0, 0, 0.92)'));
			});
		});

		it('keeps the rules for the playlist sort and filter pills', () => {
			const lines = rulesFor({});
			expect(lines.some((line) => line.includes('.pill:focus'))).toBe(true);
			expect(lines.some((line) => line.includes('.pillActive'))).toBe(true);
		});

		describe('the check on a watched title', () => {
			const watchedRules = (accents) => rulesFor(accents).filter((line) => line.includes('.watchedBadge {') || line.includes('.posterBadgeWatched') || line.includes('.episodeWatched {'));

			it('keeps the theme badge color until the surface was given an accent', () => {
				const rules = watchedRules({});
				expect(rules.length).toBeGreaterThan(0);
				const fills = rules.filter((rule) => rule.includes('background:')).map((rule) => /background: ([^;]+);/.exec(rule)[1]);
				// one color everywhere, the theme's, and none of a pick
				expect(new Set(fills).size).toBe(1);
				expect(fills[0]).not.toBe('rgb(255, 136, 0)');
			});

			it('follows the Home accent on the cards and the library screens', () => {
				const rules = watchedRules({home: '#ff8800'}).filter((rule) => rule.includes('background:'));
				// the cards of both styles, the library, favorites and genre screens
				expect(rules.filter((rule) => rule.includes('background: rgb(255, 136, 0)')).length).toBeGreaterThanOrEqual(5);
			});

			it('follows the Details accent on the details screens and the Player accent in the episode browser', () => {
				expect(watchedRules({details: '#ff8800'}).some((rule) => rule.includes('background: rgb(255, 136, 0)'))).toBe(true);
				expect(watchedRules({player: '#ff8800'}).filter((rule) => rule.includes('background: rgb(255, 136, 0)')).length).toBe(1);
			});
		});

		describe('the check on a watched title, whatever color it sits on', () => {
			const toHex = (css) => `#${(/rgba?\((\d+), (\d+), (\d+)/.exec(css) || []).slice(1, 4).map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
			const colorsOf = (accents) => {
				const lines = rulesFor(accents);
				const badge = lines.find((line) => line.includes('.watchedBadge {') && line.includes('background:'));
				const check = lines.find((line) => line.includes('.watchedBadge svg path {'));
				return {fill: toHex(/background: ([^;]+);/.exec(badge)[1]), ink: toHex(/ fill: ([^;]+);/.exec(check)[1])};
			};

			['#ffffff', '#000000', '#808080', '#ff8800'].forEach((pick) => {
				it(`keeps the check readable on a ${pick} pick`, () => {
					const {fill, ink} = colorsOf({home: pick});
					expect(fill).not.toBe(ink);
					expect(contrastRatio(fill, ink)).toBeGreaterThanOrEqual(4.5);
				});
			});

			it('colors the check on the path as well, and on every badge of a list of selectors', () => {
				const lines = rulesFor({home: '#ffffff', details: '#ffffff'});
				const checkRules = lines.filter((line) => /(watchedBadge|posterBadgeWatched|watchedIndicator|episodeWatched)[^,{]* svg path/.test(line));
				expect(checkRules.length).toBeGreaterThan(8);
				// the poster badge, first of the details pair, is named with its own svg and path
				expect(lines.some((line) => /posterBadgeWatched[^,]* svg, [^,]*posterBadgeWatched[^,]* svg path/.test(line))).toBe(true);
			});

			it('keeps it readable on the theme badge too', () => {
				const {fill, ink} = colorsOf({});
				expect(contrastRatio(fill, ink)).toBeGreaterThanOrEqual(4.5);
			});
		});

		describe('the bars in Settings', () => {
			// the last rule is the one that wins, the hand written one after the stylesheets' own
			const bars = (accents) => {
				const lines = rulesFor(accents);
				const of = (name) => /background: ([^;]+);/.exec(lines.filter((line) => line.includes(name) && line.includes('background:')).pop())[1];
				return {slider: of('.sliderActive {'), thumb: of('.sliderThumb {'), time: of('.playbackTimeBarFill {')};
			};

			it('keep the theme colors until the Settings accent is picked', () => {
				const theme = bars({});
				const picked = bars({settings: '#c2185b'});
				expect(picked.slider).not.toBe(theme.slider);
				expect(picked.thumb).not.toBe(theme.thumb);
				expect(picked.time).not.toBe(theme.time);
			});

			it('follow the Settings accent once it is picked', () => {
				const picked = bars({settings: '#c2185b'});
				expect(picked.slider).toBe(picked.thumb);
				expect(picked.slider).toBe(picked.time);
				// near the pick, nudged at most to stay seen
				const [r, g, b] = /(\d+), (\d+), (\d+)/.exec(picked.slider).slice(1).map(Number);
				expect(r).toBeGreaterThan(g);
				expect(r).toBeGreaterThan(b);
			});

			it('stay visible on the focused row when the pick is the same as its fill', () => {
				const picked = bars({settings: '#ffffff'});
				expect(picked.slider).not.toBe('rgb(255, 255, 255)');
				expect(picked.thumb).not.toBe('rgb(255, 255, 255)');
				expect(picked.time).not.toBe('rgb(255, 255, 255)');
			});
		});

		describe('the achievements screens inside Settings', () => {
			it('wear the Settings accent when they were given none, and their own once they have one', () => {
				const inherited = rulesFor({settings: '#ff8800'}).filter((line) => line.includes('.accentRow'));
				expect(inherited.length).toBe(3);
				inherited.forEach((line) => expect(line).toContain('255, 136, 0'));
				const own = rulesFor({settings: '#ff8800', achievements: '#33cc33'}).filter((line) => line.includes('.accentRow'));
				own.forEach((line) => expect(line).toContain('51, 204, 51'));
			});

			it('ring a focused badge in the accent when there is one, and in the focus color otherwise', () => {
				const ring = (accents) => rulesFor(accents).find((line) => line.includes('.showcaseItem:focus'));
				expect(ring({achievements: '#ff8800'})).toContain('border-color: rgb(255, 136, 0)');
				expect(ring({})).not.toContain('rgb(255, 136, 0)');
				expect(ring({})).toContain('border-color:');
			});
		});

		describe('the rows of the achievements and friends screens', () => {
			it('keep the look of the theme while no accent was picked', () => {
				expect(rulesFor({}).some((line) => line.includes('.accentRow'))).toBe(false);
			});

			it('wear the Achievements accent once it was picked, ahead of the Settings rules', () => {
				const lines = rulesFor({achievements: '#ff8800', settings: '#0000ff'}).filter((line) => line.includes('.accentRow'));
				expect(lines.length).toBe(3);
				lines.forEach((line) => expect(line).toContain('255, 136, 0'));
				lines.forEach((line) => expect(line).toMatch(/\.listItem\S*\.accentRow|\.listItem\.\S*accentRow/));
			});
		});

		describe('the icon box on a focused Settings row', () => {
			const iconRule = (accents) => rulesFor(accents).find((line) => line.includes('.listItem:focus .listItemIcon {'));

			it('stays visible when the row focuses with the same white as the Settings accent', () => {
				const rule = iconRule({settings: '#ffffff', settingsFocus: '#ffffff'});
				expect(rule).toBeDefined();
				// The tint and the outline are the nudged color, never white laid on a white row.
				expect(rule).not.toContain('background: rgba(255, 255, 255');
				expect(rule).not.toContain('border-color: rgba(255, 255, 255');
				// And the glyph is dark ink on that light box.
				expect(rule).toContain('color: rgba(0, 0, 0, 0.92)');
			});

			it('keeps the outline of the focused row itself visible on a white fill', () => {
				const row = focusRule(rulesFor({settings: '#ffffff', settingsFocus: '#ffffff'}), '.themeCard:focus');
				expect(row).not.toContain('border-color: rgba(255, 255, 255');
			});

			it('leaves the theme look alone when no Settings Focus was picked', () => {
				expect(iconRule({settings: '#ff0000'})).toContain('background: rgba(255, 0, 0, 0.22)');
			});
		});
	});
});


describe('the settings switch on a focused row', () => {
	const linesFor = (themeId, accents) => buildThemeOverrideCss(resolveThemeById(themeId), {accents}).split('\n');
	const find = (lines, needle) => lines.find((line) => line.includes(needle));
	const hexOf = (rule, property) => {
		const [, r, g, b] = rule.match(new RegExp(property + ': rgb\\((\\d+), (\\d+), (\\d+)\\)')) || [];
		return `#${[r, g, b].map((v) => Number(v).toString(16).padStart(2, '0')).join('')}`;
	};

	it('is inked against the fill of the row, dark on the white one Glass gives it', () => {
		const lines = linesFor('glass');
		expect(find(lines, '.listItem:focus .toggleTrack {')).toContain('border-color: rgba(0, 0, 0');
		expect(find(lines, '.listItem:focus .toggleThumb {')).toContain('background: rgba(0, 0, 0');
	});

	it('is inked light on a dark row, as the theme draws it', () => {
		const lines = linesFor('moonfin');
		const fill = find(lines, '.listItem:focus .toggleTrack {');
		expect(fill).toBeDefined();
		expect(fill).toContain('border-color: rgba(');
	});

	it('keeps the filled switch away from the row, whatever accent was picked', () => {
		['#ffffff', '#f5f5f5', '#fffde7'].forEach((pick) => {
			const lines = linesFor('glass', {settings: pick});
			const on = find(lines, '.listItem:focus .toggleOn {');
			expect(contrastRatio(hexOf(on, 'background'), '#ffffff')).toBeGreaterThanOrEqual(MIN_BUTTON_CONTRAST);
			// and the thumb on it reads against the fill
			const thumb = find(lines, '.listItem:focus .toggleOn .toggleThumb {');
			expect(thumb).toBeDefined();
		});
	});

	it('keeps an accent that already reads on the row as it is', () => {
		const lines = linesFor('glass', {settings: '#2e7d32'});
		expect(find(lines, '.listItem:focus .toggleOn {')).toContain('rgb(46, 125, 50)');
	});

	it('does the same on the sync cards, which carry a switch too', () => {
		const lines = linesFor('glass');
		expect(find(lines, '.syncCard:focus .toggleTrack {')).toContain('border-color: rgba(0, 0, 0');
	});
});
