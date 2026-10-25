import {ACCENT_KEYS, ACCENT_SURFACES, accentSignature, defaultAccentSwatch, pickedAccent, pickedAccents, themeAccentHex, effectiveAccent} from './accentSurfaces';
import {defaultSettings} from '../context/defaultSettings';
import {ACCENT_RULES} from './accentRules.generated';

describe('effectiveAccent', () => {
	it('gives Achievements the Settings pick until it has its own', () => {
		expect(effectiveAccent({accentSettings: '#ff8800'}, 'achievements')).toBe('#ff8800');
		expect(effectiveAccent({accentSettings: '#ff8800', accentAchievements: '#00ff00'}, 'achievements')).toBe('#00ff00');
		expect(effectiveAccent({accentSettings: '#ff8800'}, 'details')).toBe('');
		expect(effectiveAccent({}, 'achievements')).toBe('');
	});
});

describe('themeAccentHex', () => {
	it('drops the alpha of a theme color, which comes first', () => {
		expect(themeAccentHex({colors: {accent: '#FF00A4DC'}})).toBe('#00A4DC');
		expect(themeAccentHex({colors: {accent: '#80FF2E92'}})).toBe('#FF2E92');
	});

	it('takes a plain color as it is, and says nothing for a missing one', () => {
		expect(themeAccentHex({colors: {accent: '#00a4dc'}})).toBe('#00a4dc');
		expect(themeAccentHex({colors: {}})).toBe('');
		expect(themeAccentHex(null)).toBe('');
	});
});

describe('accent surfaces', () => {
	it('has a default setting, empty, for every surface', () => {
		ACCENT_KEYS.forEach((key) => expect(defaultSettings[key]).toBe(''));
	});

	it('gives every surface a distinct id and key', () => {
		expect(new Set(ACCENT_SURFACES.map((s) => s.id)).size).toBe(ACCENT_SURFACES.length);
		expect(new Set(ACCENT_KEYS).size).toBe(ACCENT_KEYS.length);
	});

	it('only generates rules for surfaces it knows about', () => {
		const ids = ACCENT_SURFACES.map((s) => s.id);
		Object.keys(ACCENT_RULES).forEach((id) => expect(ids).toContain(id));
	});

	it('reports no picks for untouched settings', () => {
		expect(pickedAccents(defaultSettings)).toEqual({});
		expect(pickedAccent(defaultSettings, 'player')).toBe('');
	});

	it('reports only the valid picks, by surface', () => {
		expect(pickedAccents({...defaultSettings, accentPlayer: '#ff0000', accentHome: 'nonsense'})).toEqual({player: '#ff0000'});
	});

	it('changes its signature when a pick changes and not otherwise', () => {
		const base = accentSignature(defaultSettings);
		expect(accentSignature({...defaultSettings, unrelated: 1})).toBe(base);
		expect(accentSignature({...defaultSettings, accentSkip: '#ff0000'})).not.toBe(base);
	});

	it('draws the Settings Focus swatch from the fill a focused row really has, not the accent', () => {
		const theme = {colors: {accent: '#FFFF2E92', buttonFocused: '#FF101010'}};
		const surface = ACCENT_SURFACES.find((s) => s.id === 'settingsFocus');
		expect(defaultAccentSwatch(surface, theme)).toBe('rgb(16, 16, 16)');
		expect(defaultAccentSwatch(surface, undefined)).toBeUndefined();
	});

	it('draws the default swatch from the theme only where the theme reaches', () => {
		const theme = {colors: {accent: '#FFFF2E92'}};
		const themed = ACCENT_SURFACES.find((s) => s.id === 'details');
		const fixed = ACCENT_SURFACES.find((s) => s.id === 'player');
		expect(defaultAccentSwatch(themed, theme)).toBe('rgb(255, 46, 146)');
		expect(defaultAccentSwatch(fixed, theme)).toBe('#00a4dc');
		expect(defaultAccentSwatch(themed, undefined)).toBeUndefined();
	});
});
