import {forwardRef, memo, useImperativeHandle, useMemo, useState} from 'react';

import {useSettings} from '../../context/SettingsContext';
import * as seerrApi from '../../services/seerrApi';
import {getBackdropId, getImageUrl} from '../../utils/helpers';
import BackdropLayer from '../BackdropLayer';

import css from './ScreenBackdrop.module.less';

const isLegacyBuild = () => typeof document !== 'undefined' && document.documentElement.classList.contains('legacy');

// The wide picture of a focused card, whether it is a library item or one Seerr found on TMDB. Nothing
// comes back for an item with no backdrop, and the layer then shows the plain page background.
export const backdropUrlFor = (item, serverUrl) => {
	if (!item) return '';
	if (item._externalBackdropUrl) return item._externalBackdropUrl;
	// a genre card draws on one of its own titles
	if (item.Type === 'Genre' && item._representative) return backdropUrlFor(item._representative, serverUrl);
	const tmdbPath = item.backdrop_path || item.backdropPath || item.media?.backdropPath;
	if (tmdbPath) return seerrApi.getImageUrl(tmdbPath, 'w1280');
	const backdropId = getBackdropId(item);
	if (!backdropId) return '';
	return getImageUrl(item._serverUrl || serverUrl, backdropId, 'Backdrop', {maxWidth: 1280, quality: 80});
};

/**
 * The dimmed, blurred backdrop behind a screen's cards, the way Home draws it. It follows the same
 * Home backdrop switch and blur amount, so one pair of settings governs every screen that has one.
 * @param {Object} props
 * @param {Object|null} props.item - the focused card's item
 * @param {string} [props.serverUrl]
 */
const ScreenBackdrop = ({item, serverUrl}) => {
	const {settings} = useSettings();
	const url = useMemo(
		// Home and Favorites draw none on the legacy builds, and these screens follow them
		() => (settings.showHomeBackdrop === false || isLegacyBuild() ? '' : backdropUrlFor(item, serverUrl)),
		[item, serverUrl, settings.showHomeBackdrop]
	);
	return (
		<div className={css.host}>
			<BackdropLayer targetUrl={url} blurAmount={settings.backdropBlurHome} />
		</div>
	);
};

/**
 * The same backdrop for a screen whose rows must not re-render when focus moves. The focused item is held
 * here, so only this layer redraws, and the screen hands each focus to setItem through the ref.
 * @param {Object} props
 * @param {string} [props.serverUrl]
 * @param {boolean} [props.active] - false hides it, such as while a featured bar fills the screen
 */
export const FocusBackdrop = memo(forwardRef(({serverUrl, active = true}, ref) => {
	const {settings} = useSettings();
	const [item, setItem] = useState(null);
	useImperativeHandle(ref, () => ({setItem}), []);
	const url = useMemo(
		() => (!active || settings.showHomeBackdrop === false || isLegacyBuild() ? '' : backdropUrlFor(item, serverUrl)),
		[active, item, serverUrl, settings.showHomeBackdrop]
	);
	// With nothing to show it draws no scrim either, so it does not darken what a layer beneath it is showing
	return <BackdropLayer targetUrl={url} blurAmount={settings.backdropBlurHome} scrimWhenEmpty={false} />;
}));

export default memo(ScreenBackdrop);
