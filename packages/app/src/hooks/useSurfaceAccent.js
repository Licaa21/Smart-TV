import {useSettings} from '../context/SettingsContext';
import {ACCENT_SURFACES, effectiveAccent, themeAccentHex} from '../theme/accentSurfaces';
import {ensureVisible} from '../theme/themeSpec';

/**
 * The accent a person picked for one surface, or `fallback` when they never picked one.
 *
 * A pick that would disappear into the surfaces, black on the dark screens, comes back lifted
 * just far enough to be seen. A surface the theme reaches, with nothing picked, wears the theme's own accent
 * rather than the fallback, so it does not stay cyan under a theme that is not.
 *
 * For the few places that paint an accent through an inline style rather than a stylesheet
 * class, where the stylesheet rules themeOverrides writes can't reach. The fallback is what
 * that place has always used, so nothing shifts until a color is chosen.
 *
 * @param {string} surfaceId - one of the ids in ACCENT_SURFACES
 * @param {string} fallback - the color to keep when there is no pick and the theme has none to give
 * @returns {string} a hex color
 */
const useSurfaceAccent = (surfaceId, fallback) => {
	const {settings, activeTheme} = useSettings();
	const picked = effectiveAccent(settings, surfaceId);
	// A pick that would vanish into the dark screens is nudged until it shows.
	if (picked) return ensureVisible(picked, [activeTheme?.colors?.background, activeTheme?.colors?.surface]);
	const themed = ACCENT_SURFACES.some((surface) => surface.id === surfaceId && surface.themed);
	return (themed && themeAccentHex(activeTheme)) || fallback;
};

// Only what was picked for the surface, or the surface it lives in, lifted to be seen, or '' when nothing was. For a place that
// keeps a color of its own, such as a rank's, until the person chooses one.
export const usePickedSurfaceAccent = (surfaceId) => {
	const {settings, activeTheme} = useSettings();
	const picked = effectiveAccent(settings, surfaceId);
	return picked ? ensureVisible(picked, [activeTheme?.colors?.background, activeTheme?.colors?.surface]) : '';
};

export default useSurfaceAccent;
