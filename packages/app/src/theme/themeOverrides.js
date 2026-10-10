// The build inlines every var(--theme-x, fallback) to its fallback for the older
// engines, so the stylesheets ship with Moonfin's colors baked in no matter which
// theme is active. This module rebuilds the themed parts of those stylesheets at
// runtime with literal colors from the resolved theme and injects them after the
// bundled CSS. Class names come from the same CSS module objects the components
// use, which keeps the selectors valid under production hashing, and plain
// injected CSS parses fine on every engine we ship to.
//
// Only the parts a theme owns are emitted. Fixed colors, like the detail
// backdrop scrim or the sidebar avatar gradient, stay in the stylesheets.

import {
	blendOver,
	contrastRatio,
	ensureVisible,
	DEFAULT_ERROR_COLOR,
	inkOn,
	MIN_BUTTON_CONTRAST,
	isValidHexColor,
	radiusToCss,
	readableInk,
	shadowToCss,
	toCssColor,
	toCssColorWithAlpha,
	toRgbTriplet
} from './themeSpec';
import {resolveOverlayColor} from './overlayColors';
import {ACCENT_RULES, MODULES as ACCENT_MODULES} from './accentRules.generated';

import appCss from '../App/App.module.less';
import sidebarCss from '../components/Sidebar/Sidebar.module.less';
import navBarCss from '../components/NavBar/NavBar.module.less';
import settingsCss from '../views/Settings/Settings.module.less';
import panelCss from '../components/SettingsPanel/SettingsPanel.module.less';
import achievementsCss from '../views/Settings/achievements/Achievements.module.less';
import searchCss from '../views/Search/Search.module.less';
import detailsCss from '../views/Details/Details.module.less';
import trackOptionCss from '../components/TrackOptionRow/TrackOptionRow.module.less';
import modernDetailCss from '../views/Details/ModernDetailContent.module.less';
import modernFileInfoCss from '../views/Details/ModernFileInformation.module.less';
import spotlightCss from '../views/Details/spotlight/SpotlightDetailContent.module.less';
import spotlightCardCss from '../views/Details/spotlight/SpotlightSummaryCard.module.less';
import spotlightModalCss from '../views/Details/spotlight/SpotlightSectionModal.module.less';
import spotlightGridCss from '../views/Details/spotlight/SpotlightGrids.module.less';
import nouveauCardsCss from '../views/Details/nouveau/cards/NouveauCards.module.less';
import nouveauFooterCss from '../views/Details/nouveau/footer/NouveauDetailsFooter.module.less';
import nouveauSectionsCss from '../views/Details/nouveau/sections/NouveauSections.module.less';
import trackListCss from '../components/DetailTrackList/DetailTrackList.module.less';
import overviewCss from '../views/Details/ExpandableOverview.module.less';
import tabBarCss from '../components/DetailsTabBar/DetailsTabBar.module.less';
import backdropCss from '../components/BackdropLayer/BackdropLayer.module.less';
import browseCss from '../views/Browse/Browse.module.less';
import mediaCardCss from '../components/MediaCard/MediaCard.module.less';
import modernCardCss from '../components/MediaCard/ModernMediaCard.module.less';
import mediaRowCss from '../components/MediaRow/MediaRow.module.less';
import modernRowCss from '../components/MediaRow/ModernMediaRow.module.less';
import ratingsCss from '../components/RatingsRow/RatingsRow.module.less';
import itemMenuCss from '../components/ItemContextMenu/ItemContextMenu.module.less';
import skeletonCss from '../components/Skeleton/Skeleton.module.less';

const STYLE_ELEMENT_ID = 'moonfin-theme-overrides';

const hexAlpha = (hex) => Number.parseInt(hex.slice(1, 3), 16) / 255;

const bumpRadius = (radius, extra) => radiusToCss({
	topLeft: radius.topLeft + extra,
	topRight: radius.topRight + extra,
	bottomRight: radius.bottomRight + extra,
	bottomLeft: radius.bottomLeft + extra
});

// Splits a selector list on the commas that separate selectors, leaving the ones inside
// parentheses alone.
const splitSelectors = (list) => {
	const parts = [];
	let depth = 0;
	let start = 0;
	for (let i = 0; i < list.length; i += 1) {
		const ch = list[i];
		if (ch === '(') depth += 1;
		else if (ch === ')') depth -= 1;
		else if (ch === ',' && depth === 0) {
			parts.push(list.slice(start, i).trim());
			start = i + 1;
		}
	}
	parts.push(list.slice(start).trim());
	return parts.filter(Boolean);
};

const DARK_INK = 'rgba(0, 0, 0, 0.92)';

// How opaque an accent fill is when a declaration lays one behind text, or null for a
// declaration that is not a fill of that kind. A faint tint leaves the text on the dark
// surface underneath it, so only a fill that is mostly accent counts.
const accentFillOf = (prop, value) => {
	if (!/^background(-color)?$/.test(prop)) return null;
	const text = value.trim();
	if (/^\{accent\}( !important)?$/.test(text)) return {alpha: 1};
	const tint = /^rgba\(\{rgb\}, ([\d.]+)\)( !important)?$/.exec(text);
	return tint && Number(tint[1]) >= 0.5 ? {alpha: Number(tint[1])} : null;
};

// Replays every stylesheet declaration that reads the accent for one surface, with the color
// that surface was given. Each selector gets a rule of its own, because an older engine
// throws out a whole list when one selector in it, such as :focus-within, is unknown to it.
const buildAccentRules = (surfaceId, color, prefix, surface) => {
	const list = ACCENT_RULES[surfaceId];
	if (!list || !isValidHexColor(color)) return [];
	const css = toCssColor(color);
	const rgb = toRgbTriplet(color);
	const grouped = new Map();
	for (const [file, at, selector, prop, value] of list) {
		const fill = accentFillOf(prop, value);
		// White text on a light pick would vanish, so a rule that lays the accent behind text
		// also names dark ink for it. Dark picks keep the text the stylesheet already has.
		const needsInk = fill && contrastRatio(blendOver(color, surface, fill.alpha), '#FFFFFFFF') < MIN_BUTTON_CONTRAST;
		const moduleClasses = ACCENT_MODULES[file];
		let known = Boolean(moduleClasses);
		const local = selector.replace(/\.\{([^}]+)\}/g, (match, name) => {
			const hashed = moduleClasses && moduleClasses[name];
			if (!hashed) known = false;
			return `.${hashed ? String(hashed).split(' ')[0] : name}`;
		});
		if (!known) continue;
		const resolved = value.replace(/\{accent\}/g, css).replace(/\{rgb\}/g, rgb);
		for (const part of splitSelectors(local)) {
			const key = `${at}\u0000${part}`;
			const entry = grouped.get(key) || {at, part, decls: []};
			entry.decls.push(`${prop}: ${resolved};`);
			if (needsInk) {
				entry.decls.push(`color: ${DARK_INK};`);
				// The label is usually a child with a color of its own, and a pseudo element
				// has no children to reach.
				if (!/::?(before|after)$/.test(part)) {
					const inner = `${part} *`;
					const innerKey = `${at}\u0000${inner}`;
					if (!grouped.has(innerKey)) grouped.set(innerKey, {at, part: inner, decls: [`color: ${DARK_INK};`]});
				}
			}
			grouped.set(key, entry);
		}
	}
	return [...grouped.values()].map(({at, part, decls}) => {
		const rule = `${prefix} ${part} { ${decls.join(' ')} }`;
		return at ? `${at} { ${rule} }` : rule;
	});
};

export const buildThemeOverrideCss = (theme, options = {}) => {
	const c = theme.colors;
	const b = theme.borders;

	const onSurfaceRgb = toRgbTriplet(c.onSurface);
	const scrimRgb = toRgbTriplet(c.scrim);
	const surfaceRgb = toRgbTriplet(c.surface);
	const os = (a) => `rgba(${onSurfaceRgb}, ${a})`;
	const scrim = (a) => `rgba(${scrimRgb}, ${a})`;
	const surfaceA = (a) => `rgba(${surfaceRgb}, ${a})`;

	const background = toCssColor(c.background);
	const onBackground = toCssColor(c.onBackground);
	const surface = toCssColor(c.surface);
	const surfaceVariant = toCssColor(c.surfaceVariant);
	const onSurface = toCssColor(c.onSurface);
	const onAccent = toCssColor(c.onAccent);

	// Each surface takes the accent it was given, or the theme's own when it was given none,
	// which leaves every rule below exactly as it was before surfaces could differ. Text on a
	// picked color keeps the theme's ink where that still reads and flips where it does not.
	//
	// A pick that would disappear into the surfaces it is drawn on, black on the dark screens or
	// white on a light one, is nudged just far enough to be seen, so no choice can leave text or
	// a control invisible.
	const surfaces = [c.background, c.surface];
	const seen = (hex) => ensureVisible(hex, surfaces);
	const picked = {};
	Object.keys(options.accents || {}).forEach((id) => {
		if (isValidHexColor(options.accents[id])) picked[id] = seen(options.accents[id]);
	});
	const makeAccent = (id) => {
		const value = picked[id] || c.accent;
		const rgb = toRgbTriplet(value);
		const ink = picked[id] ? readableInk(value, c.onAccent) : onAccent;
		return {css: toCssColor(value), hex: value, on: ink, a: (alpha) => `rgba(${rgb}, ${alpha})`};
	};
	const navAccent = makeAccent('navigation');
	const settingsAccent = makeAccent('settings');
	const achievementsAccent = makeAccent('achievements');
	const detailsAccent = makeAccent('details');
	const homeAccent = makeAccent('home');
	const buttonNormal = toCssColor(c.buttonNormal);
	const buttonFocused = toCssColor(c.buttonFocused);
	const buttonActive = toCssColor(c.buttonActive);
	const onButtonNormal = toCssColor(c.onButtonNormal);
	const onButtonFocused = toCssColor(c.onButtonFocused);
	const inputBackground = toCssColor(c.inputBackground);
	const inputFocused = toCssColor(c.inputFocused);
	const inputBorder = toCssColor(c.inputBorder);
	const rangeTrack = toCssColor(c.rangeTrack);
	const rangeProgress = toCssColor(c.rangeProgress);
	const badgeUnplayed = toCssColor(c.badgeUnplayed);
	const badgeWatched = toCssColor(c.badgeWatched);
	const onBadge = toCssColor(c.onBadge);
	// The circle counting the unplayed episodes of a series is a badge color of the theme, which no
	// accent reaches on its own. A surface that was given an accent draws it in that color instead,
	// with ink chosen to read on it, so the circle matches the rest of the surface.
	const countBadge = (accent, id) => (picked[id]
		? `background: ${accent.css}; color: ${accent.on}; border-color: ${accent.on};`
		: `background: ${badgeUnplayed}; color: ${onBadge}; border-color: ${onBadge};`);
	const recordingActive = toCssColor(c.recordingActive);
	const error = toCssColor(c.error || DEFAULT_ERROR_COLOR);
	const statusAvailable = toCssColor(theme.semantic.statusAvailable);
	const statusRequested = toCssColor(theme.semantic.statusRequested);
	const statusPending = toCssColor(theme.semantic.statusPending);

	const focusColor = isValidHexColor(options.focusBorderColor)
		? toCssColor(seen(options.focusBorderColor))
		: toCssColor(b.focusBorder.color);
	const focusGlow = b.focusGlow.length ? b.focusGlow.map(shadowToCss).join(', ') : null;
	const glowOr = (fallback) => focusGlow || fallback;
	const textGlow = theme.textGlow.length ? theme.textGlow.map(shadowToCss).join(', ') : 'none';

	const cardRadius = radiusToCss(b.cardRadius);
	const chipRadius = radiusToCss(b.chipRadius);
	const chipBackground = toCssColor(b.chipBackground);
	const chipBorder = `${b.chipBorder.width}px solid ${toCssColor(b.chipBorder.color)}`;
	// A theme with an invisible card border still gets a faint tile outline.
	const tileBorderColor = hexAlpha(b.cardBorder.color) === 0
		? os(0.16)
		: toCssColorWithAlpha(b.cardBorder.color, 0.55);

	// The glow a tile falls back to when the theme carries none of its own, a 14 blur at 0.5
	// spread in the settings units
	const tileGlow = glowOr(`0 0 28.7px 0.83px ${settingsAccent.a(0.22)}`);
	const focusInk = inkOn(c.buttonFocused);
	// A focused settings row fills with the theme's focused button colour, and its text turns to
	// that colour's ink, strong for the title and softer for the lines under it
	const invertedStrong = `rgba(${focusInk}, 0.87)`;
	const invertedSoft = `rgba(${focusInk}, 0.54)`;
	// The sidebar and nav fill with onSurface, which is a colour of its own.
	const onSurfaceInk = `rgba(${inkOn(c.onSurface)}, 0.92)`;
	// A theme names the colour it wants on a focused button, but some name one that
	// cant be read against their own fill, white on a bright cyan being the worst
	// of them. The named colour is kept where it holds up and dropped where it does
	// not, which also leaves an imported theme legible whatever it asks for.
	const buttonInk = contrastRatio(c.buttonFocused, c.onButtonFocused) >= MIN_BUTTON_CONTRAST
		? onButtonFocused
		: `rgba(${focusInk}, 0.92)`;

	// The fill of a focused row or button comes from the theme's button color, which no surface
	// accent reaches. A surface that was given an accent takes it for that fill too, with ink chosen
	// to read on it, so a white pick gives white rows with dark text and not the theme's blue ones.
	const focusStyle = (id) => {
		const hex = picked[id];
		if (!hex) {
			return {
				fill: buttonFocused, fillHex: c.buttonFocused, strong: invertedStrong, soft: invertedSoft, button: buttonFocused, buttonInk,
				active: buttonActive, activeInk: toCssColor(c.onButtonNormal), bar: rangeProgress
			};
		}
		const ink = inkOn(hex);
		return {
			fill: toCssColor(hex),
			fillHex: hex,
			strong: `rgba(${ink}, 0.96)`,
			soft: `rgba(${ink}, 0.78)`,
			button: toCssColor(hex),
			buttonInk: readableInk(hex, c.onButtonFocused),
			active: toCssColor(hex),
			activeInk: readableInk(hex, c.onButtonNormal),
			bar: toCssColor(hex)
		};
	};
	const settingsFocus = focusStyle('settingsFocus');
	const detailsFocus = focusStyle('details');

	// The toggle's "on" fill, the toggle's thumb once on, and the radio dot all draw from the
	// Settings accent - same as any other accent-colored mark - but they sit on this row's own
	// fill, which is a *different*, separately-pickable accent (Settings Focus). Pick the two
	// the same, or just close, and the mark reads fine resting but all but disappears once the
	// row focuses. Only matters once Settings Focus is actually picked away from the theme's
	// own default fill - that default is the theme author's own choice to balance against the
	// theme's own accent, not something to second-guess here. Nudged just enough to stay visible
	// against both the resting list-item fill and the focused one when it is picked, left
	// untouched otherwise - the same approach every other accent already gets against the
	// surfaces it is drawn on.
	const settingsMarkHex = picked.settingsFocus
		? ensureVisible(settingsAccent.hex, [c.surface, settingsFocus.fillHex])
		: settingsAccent.hex;
	const settingsMark = toCssColor(settingsMarkHex);
	const settingsMarkInk = readableInk(settingsMarkHex, c.onAccent);
	const settingsMarkA = (alpha) => `rgba(${toRgbTriplet(settingsMarkHex)}, ${alpha})`;
	// The icon box of a focused row is a tint of the Settings accent over the row's own fill. When the
	// two are the same or close, white on white say, the box and its outline vanish, and the glyph
	// with them if it took its color from the accent. The box takes the nudged mark color, and the
	// glyph is inked against what the box really ends up as, so it reads whatever the picks are.
	const focusedBoxFill = picked.settingsFocus ? blendOver(settingsMarkHex, settingsFocus.fillHex, 0.22) : null;
	const focusedIconInk = focusedBoxFill ? `rgba(${inkOn(focusedBoxFill)}, 0.92)` : settingsFocus.soft;

	const rules = [];
	// Doubling the attribute keeps these rules winning ties against stylesheets
	// injected after this one, whatever order the head ends up in.
	const prefix = `html[data-theme-id='${theme.id}'][data-theme-id]`;
	const rule = (selector, body) => {
		rules.push(`${selector.split(',').map((part) => `${prefix} ${part.trim()}`).join(', ')} { ${body} }`);
	};
	rules.push(`${prefix} { background: ${background}; color: ${onBackground}; }`);

	// The stylesheets' own accent declarations, for each surface that was given a color. They
	// come first so the hand-written rules below still win where the two meet.
	Object.keys(picked).forEach((surfaceId) => {
		buildAccentRules(surfaceId, picked[surfaceId], prefix, c.surface).forEach((line) => rules.push(line));
	});

	// App shell
	rule(`body, #root, .${appCss.app}, .${appCss.panelLoader}`, `background: ${background}; color: ${onBackground};`);
	rule(`.${appCss.loading}`, `background: linear-gradient(135deg, ${background} 0%, ${surface} 50%, ${surfaceVariant} 100%);`);
	if (theme.fontFamily) {
		// Neon Pulse keeps its display face for titles and sets body copy in the
		// condensed companion.
		const isNeon = theme.id === 'neon_pulse';
		const bodyFont = isNeon ? 'NeonPulseBody' : theme.fontFamily;
		const spacing = isNeon ? ' letter-spacing: 0.6px;' : '';
		// The Enact theme wrapper names a font on itself, so the family has to land
		// there as well or nothing inside the app inherits it. Buttons and fields
		// need naming too, since form controls take the browser's face instead of
		// the one they sit in.
		rule(
			'body, #root, .sandstone-theme, button, input, select, textarea',
			`font-family: '${bodyFont}', sans-serif;${spacing}`
		);
	}

	// Nav items rest at 60 percent of the surface text color, and the focused one
	// fills solid with dark content on top.
	rule(`.${sidebarCss.sidebarItem}, .${sidebarCss.libraryItem}, .${navBarCss.navBtn}`, `color: ${os(0.6)};`);
	if (theme.navColorCycle.length) {
		const cycle = theme.navColorCycle;
		for (let slot = 1; slot <= 16; slot += 1) {
			rule(`[data-nav-slot='${slot}']`, `color: ${toCssColor(cycle[(slot - 1) % cycle.length])};`);
		}
	}
	rule(`.${sidebarCss.sidebarItem}:hover, .${sidebarCss.libraryItem}:hover, .${navBarCss.navBtn}:hover`, `color: ${onSurface}; background: ${os(0.14)};`);
	rule(`.${sidebarCss.sidebarItem}:focus, .${sidebarCss.libraryItem}:focus, .${navBarCss.navBtn}:focus`, `color: ${onSurfaceInk}; background: ${onSurface}; border-color: transparent; box-shadow: ${glowOr('none')};`);
	rule(`.${sidebarCss.active}`, `color: ${onSurface}; background: ${navAccent.a(0.24)};`);
	rule(`.${navBarCss.active}`, `color: ${onSurface}; background: ${navAccent.a(0.28)};`);
	rule(`.${navBarCss.navPill}`, `border: ${b.navBorder ? `${b.navBorder.width}px solid ${toCssColor(b.navBorder.color)}` : 'none'};`);

	// Under a theme with a face of its own the settings rows stay in Roboto, and only the title,
	// section headers, value chips and search take the theme's face. A clean screen swaps that face
	// for its own, and Neon Pulse's title keeps its colour and glow either way.
	if (theme.fontFamily) {
		const isNeon = theme.id === 'neon_pulse';
		const bodyFace = isNeon ? 'NeonPulseBody' : theme.fontFamily;
		const notClean = `.${settingsCss.viewContainer}:not(.${settingsCss.cleanType})`;
		rule(
			`.${settingsCss.viewContainer}, .${settingsCss.viewContainer} button, .${settingsCss.viewContainer} input, .${settingsCss.dialogBarrier}`,
			`font-family: 'Roboto', sans-serif; letter-spacing: normal;`
		);
		rule(`${notClean} .${settingsCss.appBarTitle}`, `font-family: '${theme.fontFamily}', sans-serif;`);
		rule(
			`${notClean} .${settingsCss.sectionTitle}, ${notClean} .${settingsCss.valueBubble}, .${settingsCss.searchInput}, .${settingsCss.searchInput} input`,
			`font-family: '${bodyFace}', sans-serif;${isNeon ? ' letter-spacing: 0.6px;' : ''}`
		);
		if (isNeon) {
			rule(`.${settingsCss.appBarTitle}`, `font-weight: 700; letter-spacing: 0.4px; color: ${settingsAccent.css}; text-shadow: ${textGlow};`);
		}
	}

	// The pixel face runs far larger than a normal one, so settings text shrinks to 60 percent
	// under a pixel theme. Sizes here are in rem so a 720p set scales them too.
	if (theme.isPixel) {
		const rem = (dp) => `${(dp * 1.66957 / 24).toFixed(4)}rem`;
		const dpRem = (dp) => rem(dp * 0.6);
		const sizes = {
			appBarTitle: 22, sectionTitle: 12, listItemHeading: 14, listItemCaption: 12, listItemDescriptionSmall: 11,
			valueBubble: 11, searchInput: 14, dialogTitle: 14, aboutVersion: 14, input: 14, editorHint: 12,
			editorLead: 14, settingsButton: 14, syncSubtle: 12, syncStatusTitle: 16,
			syncSwitchLabel: 11, syncChip: 11, syncCaption: 12, syncTransferTitle: 14, syncResetButton: 14, syncMessage: 12
		};
		Object.keys(sizes).forEach((name) => {
			rule(`.${settingsCss[name]}`, `font-size: ${dpRem(sizes[name])};`);
		});
		rule(`.${settingsCss.searchInput} input`, `font-size: ${dpRem(14)};`);
		// Smaller text keeps the line positions full size text has, so a two-line row moves its
		// lines down
		rule(`.${settingsCss.bodyTwoLine}`, `padding-top: ${rem(25)};`);
		rule(`.${settingsCss.bodyTwoLine} .${settingsCss.listItemCaption}`, `margin-top: ${rem(10.85)};`);
	}

	// Settings
	const settingsFocusInk = inkOn(settingsFocus.fillHex);
	const tileFocus = `background: ${settingsFocus.fill}; border-color: ${settingsMarkA(0.72)}; box-shadow: ${tileGlow};`;
	rule(`.${panelCss.panel}`, `background: ${background}; border-left: ${b.navBorder ? `${b.navBorder.width}px solid ${toCssColor(b.navBorder.color)}` : '0'};`);
	rule(`.${panelCss.scrim}`, `background: ${scrim(0.54)};`);
	rule(`.${settingsCss.page}, .${settingsCss.viewContainer}, .${settingsCss.appBar}`, `background-color: ${background};`);
	rule(`.${settingsCss.appBarScrolled}`, `background-image: linear-gradient(${settingsAccent.a(0.08)}, ${settingsAccent.a(0.08)});`);
	rule(`.${settingsCss.appBarTitle}, .${settingsCss.dialogTitle}`, `color: ${onSurface};`);
	rule(`.${settingsCss.sectionTitle}`, `color: ${settingsAccent.css};`);
	rule(`.${settingsCss.listItem}, .${settingsCss.themeCard}`, `background: ${surfaceA(0.82)}; border-color: ${tileBorderColor};`);
	rule(`.${settingsCss.listItem}:focus, .${settingsCss.themeCard}:focus`, tileFocus);
	rule(`.${settingsCss.listItemSelected}, .${settingsCss.themeCardSelected}`, `border-color: ${settingsMark};`);
	rule(`.${settingsCss.listItemCaption}, .${settingsCss.chevronIcon}, .${settingsCss.checkIcon}, .${settingsCss.listItemIconPlain}, .${settingsCss.reorderHint}`, `color: ${os(0.7)};`);
	// A switch or a picker writes its description at full strength, so this follows the caption rule
	rule(`.${settingsCss.listItemHeading}, .${settingsCss.listItemDescription}`, `color: ${onSurface};`);
	rule(`.${settingsCss.themeCardName}, .${settingsCss.playbackTimeRow}`, `color: ${onSurface};`);
	// The focused tile fills with the light button color, so its content flips dark.
	rule(`.${settingsCss.listItem}:focus .${settingsCss.listItemHeading}`, `color: ${settingsFocus.strong};`);
	rule([settingsCss.listItemCaption, settingsCss.chevronIcon, settingsCss.checkIcon, settingsCss.listItemIconPlain, settingsCss.reorderHint]
		.map((name) => `.${settingsCss.listItem}:focus .${name}`).join(', '), `color: ${settingsFocus.soft};`);
	rule(`.${settingsCss.listItem}:focus .${settingsCss.listItemDescription}`, `color: ${settingsFocus.strong};`);
	// The theme cards fill the same way the rows do, so their text flips with them
	rule(`.${settingsCss.themeCard}:focus .${settingsCss.themeCardName}`, `color: ${settingsFocus.strong};`);
	rule(`.${settingsCss.themeCard}:focus .${settingsCss.themeCardDescription}`, `color: ${settingsFocus.soft};`);
	rule(`.${settingsCss.listItemIcon}`, `background: ${settingsAccent.a(0.14)}; border-color: ${settingsAccent.a(0.42)}; color: ${os(0.78)};`);
	rule(`.${settingsCss.listItemIconStrong}`, `color: ${onSurface};`);
	rule(`.${settingsCss.reorderHintOff}, .${settingsCss.listItem}:focus .${settingsCss.reorderHintOff}`, `color: ${os(0.38)};`);
	rule(`.${settingsCss.reorderLock}`, `color: ${os(0.6)};`);
	rule(`.${settingsCss.listItem}:focus .${settingsCss.reorderLock}`, `color: rgba(${settingsFocusInk}, 0.32);`);
	// A plain tile has no card, and only tints with the accent when it has the focus
	rule(`.${settingsCss.listItemPlain}`, `background: transparent; border-color: transparent;`);
	rule(`.${settingsCss.listItemPlain}:focus`, `background: ${settingsAccent.a(0.18)}; border-color: transparent; box-shadow: none;`);
	rule(`.${settingsCss.listItemPlain} .${settingsCss.listItemIconPlain}, .${settingsCss.listItemPlain}:focus .${settingsCss.listItemIconPlain}, .${settingsCss.listItemPlain} .${settingsCss.reorderHint}, .${settingsCss.listItemPlain}:focus .${settingsCss.reorderHint}, .${settingsCss.plainCheckbox}`, `color: ${onSurface};`);
	rule(`.${settingsCss.plainCheckboxOn}`, `color: ${settingsMark};`);
	// Plain tiles keep the stock dark type's text colours whatever the theme
	rule(`.${settingsCss.listItemPlain} .${settingsCss.listItemHeading}, .${settingsCss.listItemPlain}:focus .${settingsCss.listItemHeading}`, `color: #e6e0e9;`);
	rule(`.${settingsCss.listItemPlain} .${settingsCss.listItemCaption}, .${settingsCss.listItemPlain}:focus .${settingsCss.listItemCaption}`, `color: #cac4d0;`);
	rule(`.${settingsCss.colorCircle}`, `border: ${chipBorder};`);
	rule(`.${settingsCss.subtitlePreview}`, `background: linear-gradient(to bottom right, ${surfaceVariant}, ${scrim(0.8)});`);
	rule(`.${settingsCss.listItem}:focus .${settingsCss.listItemIcon}`, `background: ${settingsMarkA(0.22)}; border-color: ${settingsMarkA(0.64)}; color: ${focusedIconInk};`);
	rule(`.${settingsCss.valueBubble}`, `background: ${settingsAccent.a(0.1)}; border-color: ${settingsAccent.a(0.35)}; color: ${settingsAccent.css};`);
	rule(`.${settingsCss.listItem}:focus .${settingsCss.valueBubble}`, `background: rgba(${settingsFocusInk}, 0.12); border-color: rgba(${settingsFocusInk}, 0.35); color: ${settingsFocus.strong};`);
	// The switch keeps its colours on a focused row
	rule(`.${settingsCss.toggleTrack}`, `background: ${surfaceVariant}; border-color: ${onSurface};`);
	rule(`.${settingsCss.toggleOn}`, `background: ${settingsMark}; border-color: ${settingsMark};`);
	rule(`.${settingsCss.toggleThumb}`, `background: ${onSurface};`);
	rule(`.${settingsCss.toggleOn} .${settingsCss.toggleThumb}`, `background: ${settingsMarkInk};`);
	rule(`.${settingsCss.sliderInactive}`, `background: ${rangeTrack};`);
	rule(`.${settingsCss.sliderActive}`, `background: ${rangeProgress};`);
	rule(`.${settingsCss.sliderThumb}`, `background: ${toCssColor(c.rangeThumb)};`);
	rule(`.${settingsCss.sliderTick}`, `background: ${os(0.38)};`);
	rule(`.${settingsCss.divider}`, `background: ${os(0.12)};`);
	rule(`.${settingsCss.dialog}`, `background: ${surface};`);
	rule(`.${settingsCss.aboutVersion}`, `color: ${onSurface};`);
	rule(`.${settingsCss.aboutDivider}`, `background: ${onSurface};`);
	rule(`.${settingsCss.input}, .${settingsCss.searchInput}`, `background: ${surfaceVariant}; color: ${onSurface};`);
	rule(`.${settingsCss.input}:focus, .${settingsCss.input}[data-focused], .${settingsCss.searchInput}:focus, .${settingsCss.searchInput}[data-focused]`, `background: ${buttonFocused}; color: ${onButtonFocused};`);
	rule(`.${settingsCss.input}:focus input, .${settingsCss.input}[data-focused] input, .${settingsCss.searchInput}:focus input, .${settingsCss.searchInput}[data-focused] input`, `color: ${onButtonFocused};`);
	rule(`.${settingsCss.searchIcon}`, `color: ${os(0.7)};`);
	rule(`.${settingsCss.searchInput}:focus ~ .${settingsCss.searchIcon}, .${settingsCss.searchInput}[data-focused] ~ .${settingsCss.searchIcon}`, `color: ${onButtonFocused};`);
	rule(`.${settingsCss.input} input::-webkit-input-placeholder, .${settingsCss.searchInput} input::-webkit-input-placeholder`, `color: ${os(0.55)};`);
	rule(`.${settingsCss.input} input::placeholder, .${settingsCss.searchInput} input::placeholder`, `color: ${os(0.55)};`);
	// An achievement row carries its own figures on the end, so they follow the tile rather than
	// keeping a resting colour nobody can read once it lights up.
	rule(`.${achievementsCss.points}, .${achievementsCss.progressText}`, `color: ${os(0.7)};`);
	rule(`.${achievementsCss.boardValue}, .${achievementsCss.rankGutter}`, `color: ${onSurface};`);
	rule(`.${achievementsCss.reward}`, `color: ${achievementsAccent.css};`);
	rule(`.${settingsCss.listItem}:focus .${achievementsCss.points}, .${settingsCss.listItem}:focus .${achievementsCss.progressText}`, `color: ${settingsFocus.soft};`);
	rule(`.${settingsCss.listItem}:focus .${achievementsCss.boardValue}, .${settingsCss.listItem}:focus .${achievementsCss.rankGutter}, .${settingsCss.listItem}:focus .${achievementsCss.reward}`, `color: ${settingsFocus.strong};`);
	rule(`.${settingsCss.actionButton}`, `background: ${buttonNormal}; color: ${onButtonNormal}; border-color: ${tileBorderColor};`);
	rule(`.${settingsCss.actionButton}:focus`, `background: ${settingsFocus.button}; border-color: ${focusColor}; color: ${settingsFocus.buttonInk};`);
	rule(`.${settingsCss.dangerButton}:focus`, `background: ${recordingActive} !important; border-color: ${recordingActive} !important; color: #fff;`);
	// The editors' buttons, Save filled and the rest as text, focus the way the rows do
	rule(`.${settingsCss.settingsButton}`, `color: ${settingsAccent.css};`);
	rule(`.${settingsCss.settingsButtonPrimary}`, `background: ${buttonNormal}; color: ${onButtonNormal};`);
	rule(`.${settingsCss.settingsButton}:focus`, `${tileFocus} color: ${settingsFocus.strong};`);
	// Low tier sets skip the glow, which this sheet would otherwise put back over the stylesheet
	rules.push(`${[settingsCss.listItem, settingsCss.syncCard, settingsCss.settingsButton]
		.map((name) => `${prefix}.perf-low .${name}:focus`).join(', ')} { box-shadow: none; }`);
	// The Settings Sync cards fill and focus the way the settings rows do
	rule(`.${settingsCss.syncCard}, .${settingsCss.syncTransferCard}`, `background: ${surface}; border-color: ${tileBorderColor};`);
	rule(`.${settingsCss.syncTransferCard}`, `border-color: transparent;`);
	rule(`.${settingsCss.syncTransferButton}`, `background: ${buttonNormal}; border-color: transparent;`);
	rule(`.${settingsCss.syncResetButton}`, `background: transparent; border-color: transparent; color: ${error};`);
	rule(`.${settingsCss.syncCardSelected}`, `background: ${settingsMarkA(0.14)}; border-color: ${settingsMark};`);
	rule(`.${settingsCss.syncCard}:focus`, tileFocus);
	rule(`.${settingsCss.syncStatusTitle}, .${settingsCss.syncProfileTitle}, .${settingsCss.syncTransferTitle}`, `color: ${onSurface};`);
	rule(`.${settingsCss.syncSubtle}, .${settingsCss.syncSwitchLabel}, .${settingsCss.syncCaption}, .${settingsCss.syncMessage}, .${settingsCss.syncProfileIcon}`, `color: ${os(0.7)};`);
	rule(`.${settingsCss.syncProfileIconActive}, .${settingsCss.syncTransferIcon}`, `color: ${settingsMark};`);
	rule(`.${settingsCss.syncChip}`, `background: ${chipBackground}; border: ${chipBorder}; color: ${onSurface};`);
	rule(`.${settingsCss.syncCard}:focus .${settingsCss.syncStatusTitle}, .${settingsCss.syncCard}:focus .${settingsCss.syncProfileTitle}, .${settingsCss.syncCard}:focus .${settingsCss.syncTransferTitle}`, `color: ${settingsFocus.strong};`);
	rule(`.${settingsCss.syncCard}:focus .${settingsCss.syncSubtle}, .${settingsCss.syncCard}:focus .${settingsCss.syncSwitchLabel}`, `color: rgba(${settingsFocusInk}, 0.7);`);
	rule(`.${settingsCss.syncCard}:focus .${settingsCss.syncProfileIcon}, .${settingsCss.syncCard}:focus .${settingsCss.syncTransferIcon}`, `color: ${settingsFocus.soft};`);
	rule(`.${settingsCss.syncCard}:focus .${settingsCss.syncChip}`, `background: rgba(${settingsFocusInk}, 0.06); border-color: rgba(${settingsFocusInk}, 0.2); color: ${settingsFocus.strong};`);
	rule(`.${settingsCss.syncCard}:focus .${settingsCss.listItemIcon}`, `background: ${settingsMarkA(0.22)}; border-color: ${settingsMarkA(0.64)}; color: ${focusedIconInk};`);
	rule(`.${settingsCss.editorHint}, .${settingsCss.editorLead}`, `color: ${onSurface};`);
	rule(`.${settingsCss.statusMessage}, .${settingsCss.authHint}, .${settingsCss.viewDescription}, .${settingsCss.viewCaption}, .${settingsCss.themeCardDescription}, .${settingsCss.themeStoreMessage}`, `color: ${os(0.7)};`);
	rule(`.${settingsCss.statusError}`, `color: ${error};`);
	rule(`.${settingsCss.loadingMessage}, .${settingsCss.integrationSpec}`, `color: ${os(0.45)};`);
	rule(`.${settingsCss.themeCardCheck}, .${settingsCss.themeStoreCardAction}`, `color: ${settingsMark};`);
	rule(`.${settingsCss.playbackTimePreview}`, `background: ${surface};`);
	rule(`.${settingsCss.playbackTimeBar}`, `background: ${rangeTrack};`);
	rule(`.${settingsCss.playbackTimeBarFill}`, `background: ${settingsFocus.bar};`);

	// Search input
	rule(`.${searchCss.searchInputWrapper}`, `background: ${inputBackground}; border-color: ${inputBorder};`);
	rule(`.${searchCss.searchInputFocused}`, `background: ${inputFocused}; border-color: ${focusColor}; box-shadow: ${glowOr('none')};`);

	// Detail screens, classic layout
	rule(`.${detailsCss.posterBadgeWatched}, .${detailsCss.watchedIndicator}`, `background: ${badgeWatched}; border-color: ${onBadge};`);
	rule(`.${detailsCss.posterBadgeWatched} svg, .${detailsCss.watchedIndicator} svg`, `fill: ${onBadge}; stroke: ${onBadge};`);
	rule(`.${detailsCss.posterBadgeFavorite} svg, .${detailsCss.favoriteBadge} svg`, `fill: ${onBadge}; stroke: ${onBadge};`);
	rule(`.${detailsCss.posterBadgeFavorite}, .${detailsCss.favoriteBadge}`, `background: ${recordingActive}; border-color: ${onBadge};`);
	rule(`.${detailsCss.seriesName}, .${detailsCss.tagline}`, `color: ${os(0.7)};`);
	rule(`.${detailsCss.episodeNumber}`, `color: ${os(0.9)}; background: ${os(0.15)};`);
	rule(`.${detailsCss.title}, .${detailsCss.sectionTitle}, .${detailsCss.seasonDetailTitle}, .${detailsCss.trackModalTitle}`, `color: ${onBackground};`);
	rule(`.${detailsCss.infoItem}`, `color: ${os(0.9)};`);
	rule(`.${detailsCss.infoTextItems} > .${detailsCss.infoItem} + .${detailsCss.infoItem}::before`, `color: ${os(0.5)};`);
	rule(`.${detailsCss.badgeRating}`, `background: ${os(0.15)}; color: ${os(0.9)};`);
	rule(`.${detailsCss.overview}`, `color: ${os(0.8)};`);
	rule(`.${detailsCss.btnAction}`, `background: ${buttonNormal};`);
	rule(`.${detailsCss.btnIcon}`, `color: ${onButtonNormal};`);
	rule(`.${detailsCss.btnWrapper}:focus .${detailsCss.btnAction}`, `background: ${detailsFocus.button}; border-color: ${focusColor};`);
	rule(`.${detailsCss.btnWrapper}:focus .${detailsCss.btnAction} .${detailsCss.btnIcon}`, `color: ${detailsFocus.buttonInk}; fill: ${detailsFocus.buttonInk};`);
	rule(`.${detailsCss.favorited}, .${detailsCss.btnWrapper}:focus .${detailsCss.btnAction} .${detailsCss.favorited}`, `color: ${recordingActive}; fill: ${recordingActive};`);
	rule(`.${detailsCss.watched}, .${detailsCss.btnWrapper}:focus .${detailsCss.btnAction} .${detailsCss.watched}`, `color: ${detailsAccent.css}; fill: ${detailsAccent.css};`);
	rule(`.${detailsCss.btnDetail}`, `color: ${os(0.5)};`);
	rule(`.${detailsCss.btnWrapper}:focus .${detailsCss.btnDetail}`, `color: ${onBackground};`);
	rule(`.${detailsCss.btnLabel}, .${detailsCss.seasonName}, .${detailsCss.seasonEpTitle}, .${detailsCss.castName}, .${detailsCss.trackName}, .${detailsCss.trackTitle}`, `color: ${onSurface};`);
	rule(`.${detailsCss.seasonCard}:focus .${detailsCss.seasonPosterWrapper}`, `border-color: ${focusColor};`);
	rule(`.${detailsCss.unplayedCount}`, countBadge(detailsAccent, 'details'));
	rule(`.${detailsCss.nextUpCard}`, `background: ${os(0.06)};`);
	rule(`.${detailsCss.nextUpCard}:focus, .${detailsCss.episodeCard}:focus, .${detailsCss.castCard}:focus .${detailsCss.castImageWrapper}`, `border-color: ${focusColor};`);
	rule(`.${detailsCss.chapterCard}:focus, .${detailsCss.extraCard}:focus`, `border-color: ${detailsAccent.a(0.5)};`);
	rule(`.${detailsCss.episodeCurrent}`, `border-color: ${detailsAccent.a(0.4)}; background: ${detailsAccent.a(0.08)};`);
	rule(`.${detailsCss.nextUpThumb}, .${detailsCss.nextUpThumbPlaceholder}, .${detailsCss.episodeThumb}, .${detailsCss.episodeThumbPlaceholder}, .${detailsCss.chapterThumb}, .${detailsCss.extraThumb}, .${detailsCss.chapterThumbPlaceholder}, .${detailsCss.extraThumbPlaceholder}, .${detailsCss.seasonEpThumb}, .${detailsCss.seasonEpThumbPlaceholder}`, `background: ${surface};`);
	rule(`.${detailsCss.episodeProgressBar}`, `background: ${detailsAccent.css};`);
	rule(`.${detailsCss.tmdbIcon}`, `color: ${statusPending};`);
	rule(`.${detailsCss.seasonDetailCount}`, `color: ${os(0.5)};`);
	rule(`.${detailsCss.seasonEp}`, `background: ${os(0.04)};`);
	rule(`.${detailsCss.seasonEp}:focus`, `background: ${os(0.08)}; border-color: ${focusColor};`);
	rule(`.${detailsCss.seasonEpCheck}`, `color: ${detailsAccent.css};`);
	rule(`.${detailsCss.trackItem}`, `background: ${os(0.08)}; border-color: ${os(0.15)};`);
	rule(`.${detailsCss.trackItem}:focus`, `background: ${detailsAccent.a(0.3)}; border-color: ${focusColor}; box-shadow: ${glowOr(`0 4px 15px ${detailsAccent.a(0.4)}`)};`);
	rule(`.${trackOptionCss.trackOption}:focus`, `background: ${detailsAccent.a(0.3)};`);
	rule(`.${trackOptionCss.trackOption}.${trackOptionCss.selected} .${trackOptionCss.trackIndicator}`, `color: ${detailsAccent.css};`);
	rule(`.${trackOptionCss.trackName}`, `color: ${onSurface};`);
	rule(`.${trackOptionCss.trackDivider}`, `background: ${os(0.08)};`);
	rule(`.${detailsCss.trackPlayed} svg`, `fill: ${detailsAccent.css};`);
	rule(`.${detailsCss.actionBtn}`, `background: ${os(0.1)}; border-color: ${os(0.2)}; color: ${onBackground};`);
	rule(`.${detailsCss.actionBtn}:hover, .${detailsCss.actionBtn}:focus`, `background: ${detailsAccent.a(0.3)}; border-color: ${focusColor};`);
	rule(`.${detailsCss.toast}`, `background: ${surfaceA(0.9)}; color: ${onBackground}; border-color: ${os(0.12)};`);

	// Detail screens, modern layout
	rule(`.${modernDetailCss.metaRow}, .${modernDetailCss.techSize}`, `color: ${os(0.75)};`);
	rule(`.${modernDetailCss.actionPrimary}`, `background-color: ${detailsAccent.css}; color: ${detailsAccent.on};`);
	rule(`.${modernDetailCss.actionBtn}:focus`, `background: ${detailsFocus.button}; border-color: ${focusColor}; color: ${detailsFocus.buttonInk};`);
	rule(`.${modernDetailCss.overflowList} .${modernDetailCss.actionBtn}:focus`, `background: ${os(0.1)}; border-color: ${focusColor}; color: ${onBackground};`);
	rule(`.${modernDetailCss.upNextCard}`, `background-color: ${surfaceA(0.82)};`);
	rule(`.${modernDetailCss.upNextCard}:focus`, `border-color: ${focusColor};`);
	rule(`.${modernDetailCss.upNextLabel}`, `color: ${detailsAccent.css};`);
	rule(`.${modernDetailCss.upNextProgress} > div`, `background: ${detailsAccent.css};`);
	rule(`.${modernDetailCss.sectionHeading}`, `color: ${onBackground};`);
	rule(`.${modernDetailCss.episodeWatched}`, `background: ${badgeWatched}; border-color: ${onBadge};`);
	rule(`.${modernDetailCss.episodeWatched} svg`, `fill: ${onBadge}; stroke: ${onBadge};`);
	rule(`.${tabBarCss.tabBar}`, `background: ${os(0.08)};`);
	rule(`.${modernFileInfoCss.trackActive}`, `border-color: ${detailsAccent.css};`);
	rule(`.${modernFileInfoCss.showAll}, .${modernFileInfoCss.retry}, .${modernFileInfoCss.reasonHint}`, `color: ${detailsAccent.css};`);
	rule(`.${modernFileInfoCss.showAll}:focus, .${modernFileInfoCss.retry}:focus`, `border-color: ${focusColor};`);

	// Detail screens, spotlight layout
	rule(`.${spotlightCss.metaRow}, .${spotlightCss.techSize}`, `color: ${os(0.75)};`);
	rule(`.${spotlightCss.tagline}`, `color: ${detailsAccent.css};`);
	rule(`.${spotlightCss.personAvatar}`, `border-color: ${focusColor};`);
	rule(`.${spotlightCardCss.card}:focus`, `border-color: ${focusColor};`);
	rule(`.${spotlightModalCss.panel}`, `background: ${surfaceA(0.96)}; border-color: ${os(0.12)};`);
	rule(`.${spotlightModalCss.headerTitle}, .${spotlightModalCss.sectionTitle}`, `color: ${onBackground};`);
	rule(`.${spotlightModalCss.sectionCount}`, `background: ${os(0.08)}; color: ${os(0.7)};`);
	rule(`.${spotlightGridCss.personCard}:focus, .${spotlightGridCss.studioCard}:focus, .${spotlightGridCss.chapterCard}:focus`, `border-color: ${focusColor};`);
	rule(`.${spotlightGridCss.personName}, .${spotlightGridCss.studioName}, .${spotlightGridCss.chapterName}`, `color: ${onBackground};`);
	rule(`.${trackListCss.trackRow}:focus`, `background: ${detailsFocus.button}; border-color: ${focusColor};`);
	rule(`.${trackListCss.trackTitle}, .${trackListCss.discHeading}`, `color: ${onBackground};`);

	// Detail screens, nouveau layout
	rule(`.${nouveauCardsCss.card}:focus, .${nouveauCardsCss.landscapeDetails}:focus, .${nouveauCardsCss.person}:focus .${nouveauCardsCss.avatar}`, `border-color: ${focusColor};`);
	rule(`.${nouveauCardsCss.progressFill}, .${nouveauCardsCss.nextUp}`, `background: ${detailsAccent.css};`);
	rule(`.${nouveauSectionsCss.sortButton}:focus`, `border-color: ${focusColor};`);
	rule(`.${nouveauFooterCss.trackActive} .${nouveauFooterCss.trackDot}`, `background: ${detailsAccent.css};`);
	rule(`.${nouveauFooterCss.capabilityRetry}`, `color: ${detailsAccent.css};`);
	rule(`.${nouveauFooterCss.capabilityRetry}:focus`, `border-color: ${focusColor};`);
	rule(`.${modernDetailCss.overflowPanel}`, `background: ${surfaceA(0.97)}; border-color: ${os(0.12)};`);
	rule(`.${modernDetailCss.overflowTitle}`, `color: ${onBackground};`);
	rule(`.${itemMenuCss.panel}`, `background: ${surfaceA(0.97)}; border-color: ${os(0.12)};`);
	rule(`.${itemMenuCss.title}, .${itemMenuCss.row}, .${itemMenuCss.button}`, `color: ${onBackground};`);
	rule(`.${itemMenuCss.row}:focus, .${itemMenuCss.button}:focus`, `background: ${os(0.1)}; border-color: ${focusColor};`);
	rule(`.${tabBarCss.tab}`, `color: ${os(0.75)};`);
	rule(`.${tabBarCss.tabActive}`, `background: ${detailsAccent.css}; color: ${detailsAccent.on};`);
	rule(`.${tabBarCss.tab}:focus`, `border-color: ${focusColor};`);
	rule(`.${overviewCss.spottable}:focus`, `border-color: ${focusColor};`);
	rule(`.${overviewCss.readMoreBtn}`, `color: ${detailsAccent.css};`);

	// Home screen chrome
	rule(`.${browseCss.page}`, `background: ${background};`);
	rule(`.${browseCss.ayaFrame}`, `background: ${background};`);
	rule(`.${browseCss.ayaFocusRing}`, `border-color: ${focusColor}; box-shadow: ${glowOr(`0 0 18px 1px ${homeAccent.a(0.3)}`)};`);
	rule(`.${browseCss.ayaTitle}`, `color: ${onSurface}; text-shadow: 0 0 20px ${scrim(0.72)};`);
	rule(`.${browseCss.ayaIndicator}`, `background: ${os(0.3)};`);
	rule(`.${browseCss.ayaIndicatorActive}`, `background: ${onSurface};`);
	rule(`.${backdropCss.globalBackdropOverlay}`, `background: ${toCssColor(c.scrim)};`);
	rule(`.${browseCss.featuredGradient}`, `background: -webkit-linear-gradient(top, ${scrim(0.3)} 0%, ${scrim(0.1)} 40%, ${scrim(0.8)} 100%); background: linear-gradient(to bottom, ${scrim(0.3)} 0%, ${scrim(0.1)} 40%, ${scrim(0.8)} 100%);`);
	rule(`.${browseCss.detailPlaceholder} p, .${browseCss.empty}`, `color: ${os(0.7)};`);
	// The card takes the media bar's own overlay color at three quarters of its
	// opacity, outlined with the theme's card border.
	const mediaBarFill = toCssColorWithAlpha(
		resolveOverlayColor(options.mediaBarOverlayColor),
		((options.mediaBarOverlayOpacity ?? 50) / 100) * 0.75
	);
	rule(`.${browseCss.featuredInfoBox}`, `background-color: ${mediaBarFill}; background-image: none; border: ${b.cardBorder.width}px solid ${toCssColor(b.cardBorder.color)}; border-radius: 16px;`);
	rule(`.${browseCss.trailerActive} .${browseCss.featuredInfoBox}`, `background-color: transparent; background-image: none;`);
	rule(`.${browseCss.featuredTitle}, .${browseCss.makdTitle}, .${browseCss.galleryVerticalTitle}, .${browseCss.galleryActiveTitle}, .${browseCss.galleryCreditValue}, .${browseCss.bannerTitle}`, `color: ${onBackground};`);
	rule(`.${browseCss.metaItem}`, `color: ${os(0.9)};`);
	rule(`.${browseCss.metaItem}:not(:last-child)::after`, `color: ${os(0.5)};`);
	rule(`.${browseCss.metaBadge}`, `border-color: ${os(0.4)};`);
	rule(`.${browseCss.featuredOverview}, .${browseCss.galleryOverview}`, `color: ${os(0.9)};`);
	rule(`.${browseCss.carouselNav}`, `color: ${onBackground};`);
	rule(`.${browseCss.carouselNav}:focus`, `background: ${scrim(0.85)};`);
	rule(`.${browseCss.featuredIndicators}, .${browseCss.makdDots}`, `background: ${scrim(0.55)};`);
	rule(`.${browseCss.indicatorDot}`, `background: ${os(0.5)};`);
	rule(`.${browseCss.indicatorDot}.${browseCss.active}`, `background: ${onSurface};`);
	rule(`.${browseCss.makdOverview}`, `color: ${os(0.95)};`);
	rule(`.${browseCss.makdDot}`, `background: ${os(0.35)};`);
	rule(`.${browseCss.makdDotActive}`, `background: ${focusColor};`);
	rule(`.${browseCss.galleryIndex}`, `color: ${os(0.85)};`);
	rule(`.${browseCss.galleryActiveRight}`, `background: ${scrim(0.55)}; border-color: ${os(0.12)};`);
	rule(`.${browseCss.galleryPill}`, `color: ${onBackground}; background: ${scrim(0.35)};`);
	rule(`.${browseCss.galleryPillOutlined}`, `background: transparent; border-color: ${os(0.55)};`);
	rule(`.${browseCss.galleryCreditLabel}`, `color: ${homeAccent.css};`);
	rule(`.${browseCss.galleryShimmer} span`, `background: ${os(0.1)};`);
	rule(`.${skeletonCss.box}`, `background-color: ${theme.isGlass ? 'rgba(255, 255, 255, 0.16)' : os(0.14)};`);
	rule(`.${browseCss.bannerCard}:focus`, `border-color: ${focusColor}; box-shadow: ${glowOr(`0 0 18px ${homeAccent.a(0.4)}`)};`);
	rule(`.${browseCss.bannerGradient}`, `background: linear-gradient(to right, ${scrim(0.9)}, ${scrim(0)});`);
	rule(`.${browseCss.bannerMeta}`, `color: ${os(0.75)};`);
	rule(`.${browseCss.bannerDot}`, `background: ${os(0.4)};`);
	rule(`.${browseCss.bannerDotActive}`, `background: ${onBackground};`);

	// The classic info band above the rows
	rule(`.${browseCss.detailTitle}`, `color: ${onBackground};`);
	rule(`.${browseCss.infoText}`, `color: ${os(0.8)};`);
	rule(`.${browseCss.infoDot}`, `color: ${os(0.5)};`);
	rule(`.${browseCss.infoBadge}`, `background: ${chipBackground}; border: ${chipBorder}; border-radius: ${chipRadius}; color: ${os(0.8)};`);
	rule(`.${browseCss.detailSummary}`, `color: ${os(0.85)};`);

	// Cards, both row styles
	for (const cardCss of [mediaCardCss, modernCardCss]) {
		rule(`.${cardCss.image}, .${cardCss.placeholder}, .${cardCss.imageContainer}, .${cardCss.genreOverlay}`, `border-radius: ${cardRadius};`);
		rule(`.${cardCss.image}, .${cardCss.placeholder}`, `border: ${b.cardBorder.width}px solid ${toCssColor(b.cardBorder.color)};`);
		rule(`.${cardCss.card}:focus .${cardCss.image}`, `border-color: ${focusColor}; border-width: 4px; box-shadow: ${glowOr('0 8px 24px rgba(0, 0, 0, 0.6)')};`);
		rule(`.${cardCss.placeholder}`, `background: linear-gradient(135deg, ${homeAccent.a(0.25)} 0%, ${homeAccent.a(0.05)} 50%, transparent 100%), ${surfaceVariant};`);
		rule(`.${cardCss.placeholderTitle}`, `color: ${onSurface};`);
		rule(`.${cardCss.title}`, `color: ${theme.id === 'neon_pulse' ? homeAccent.css : onSurface};`);
		rule(`.${cardCss.progressBar}`, `background: ${scrim(0.54)};`);
		rule(`.${cardCss.progress}`, `background: ${homeAccent.css};`);
		rule(`.${cardCss.watchedBadge}`, `background: ${badgeWatched}; border-color: ${onBadge};`);
		rule(`.${cardCss.watchedBadge} svg`, `fill: ${onBadge}; stroke: ${onBadge};`);
		rule(`.${cardCss.unplayedCount}`, countBadge(homeAccent, 'home'));
		rule(`.${cardCss.favoriteBadge}`, `background: ${recordingActive}; border-color: ${onBadge};`);
		rule(`.${cardCss.favoriteBadge} svg`, `fill: ${onBadge}; stroke: ${onBadge};`);
		rule(`.${cardCss.serverBadge}`, `background: ${surface}; color: ${onSurface};`);
		rule(`.${cardCss.seerr5}`, `background: ${onSurface}; border-color: ${statusAvailable};`);
		rule(`.${cardCss.seerr4}`, `background: ${statusAvailable};`);
		rule(`.${cardCss.seerr3}`, `border-color: ${statusRequested};`);
		rule(`.${cardCss.seerr2}`, `background: ${onSurface}; border-color: ${statusPending};`);
		rule(`.${cardCss.seerrMissing}`, `background: ${homeAccent.css};`);
		rule(`.${cardCss.seerrMissing} svg`, `fill: ${onBadge};`);
	}
	rule(`.${mediaCardCss.seriesName}`, `color: ${onSurface};`);
	rule(`.${mediaCardCss.episodeInfo}, .${modernCardCss.secondaryTitle}`, `color: ${theme.id === 'neon_pulse' ? onSurface : os(0.6)};`);
	rule(`.${modernCardCss.placeholderIcon}`, `color: ${os(0.45)};`);
	rule(`.${modernCardCss.overview}`, `color: ${theme.id === 'neon_pulse' ? onSurface : os(0.7)};`);
	rule(`.${modernCardCss.platformWebos} .${modernCardCss.image}`, `border-radius: ${bumpRadius(b.cardRadius, 2)};`);

	// Row shells
	rule(`.${mediaRowCss.title}, .${modernRowCss.title}`, `color: ${onSurface}; text-shadow: ${textGlow};`);
	rule(`.${mediaRowCss.subtitle}, .${modernRowCss.subtitle}`, `color: ${os(0.5)};`);
	rule(`.${mediaRowCss.seeAll}`, `background: ${os(0.08)}; color: ${os(0.7)};`);
	rule(`.${mediaRowCss.seeAll}:focus`, `border-color: ${homeAccent.css}; background: ${homeAccent.a(0.22)}; color: ${onSurface}; box-shadow: 0 0 14px 1px ${homeAccent.a(0.45)};`);
	rule(`.${mediaRowCss.seeAllChevron}`, `color: ${homeAccent.css};`);

	// Ratings
	rule(`.${ratingsCss.ratingItem}, .${ratingsCss.ratingCompactBadge}`, `background: ${scrim(0.45)};`);
	rule(`.${ratingsCss.ratingItemPlain}`, `background: transparent;`);
	rule(`.${ratingsCss.ratingValue}, .${ratingsCss.ratingName}, .${ratingsCss.ratingNameCompact}`, `color: ${onSurface};`);
	rule(`.${ratingsCss.ratingValueCompact}`, `color: ${onBackground};`);

	// Pixel themes square off every fixed radius.
	if (theme.isPixel) {
		rule([
			`.${sidebarCss.sidebarItem}`, `.${sidebarCss.libraryItem}`, `.${sidebarCss.userBtn}`,
			`.${navBarCss.navPill}`, `.${navBarCss.navBtn}`,
			`.${settingsCss.listItem}`, `.${settingsCss.listItemIcon}`, `.${settingsCss.valueBubble}`, `.${settingsCss.dialog}`, `.${panelCss.panel}`, `.${settingsCss.pageAlone}`,
			`.${settingsCss.themeCard}`, `.${settingsCss.themeCardStripe}`, `.${settingsCss.input}`,
			`.${settingsCss.actionButton}`, `.${settingsCss.settingsButtonPrimary}`, `.${settingsCss.playbackTimePreview}`, `.${searchCss.searchInputWrapper}`,
			`.${settingsCss.syncCard}`, `.${settingsCss.syncTransferCard}`, `.${settingsCss.syncChip}`,
			`.${detailsCss.poster}`, `.${detailsCss.btnAction}`, `.${detailsCss.nextUpCard}`,
			`.${detailsCss.episodeCard}`, `.${detailsCss.chapterCard}`, `.${detailsCss.extraCard}`,
			`.${detailsCss.seasonPosterWrapper}`, `.${detailsCss.episodeNumber}`, `.${detailsCss.badge}`,
			`.${detailsCss.trackItem}`, `.${detailsCss.actionBtn}`, `.${detailsCss.toast}`, `.${detailsCss.seasonEp}`,
			`.${modernDetailCss.actionBtn}`, `.${modernDetailCss.upNextCard}`,
			`.${tabBarCss.tabBar}`, `.${tabBarCss.tab}`, `.${overviewCss.spottable}`,
			`.${browseCss.featuredInfoBox}`, `.${browseCss.bannerCard}`, `.${browseCss.galleryActiveRight}`,
			`.${browseCss.galleryPill}`, `.${browseCss.makdDots}`, `.${browseCss.featuredIndicators}`
		].join(', '), 'border-radius: 0;');
	}

	return rules.join('\n');
};

// Creates or refreshes the injected style element. Appending on every call also
// moves it back to the end of the head.
// The stylesheet that is in the page, so an unchanged theme is not written and parsed again. Writing
// it and moving the element restyles the whole document, and the app asks whenever any one of the
// settings it is built from is touched.
let appliedCss = null;

export const applyThemeOverrides = (theme, options) => {
	if (typeof document === 'undefined') return;
	const css = buildThemeOverrideCss(theme, options);
	let element = document.getElementById(STYLE_ELEMENT_ID);
	if (element && css === appliedCss) return;
	if (!element) {
		element = document.createElement('style');
		element.id = STYLE_ELEMENT_ID;
		appliedCss = null;
	}
	element.textContent = css;
	appliedCss = css;
	document.head.appendChild(element);
};
