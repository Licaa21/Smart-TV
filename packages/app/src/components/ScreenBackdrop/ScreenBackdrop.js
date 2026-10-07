import {memo, useMemo} from 'react';

import {useSettings} from '../../context/SettingsContext';
import * as seerrApi from '../../services/seerrApi';
import {getBackdropId, getImageUrl} from '../../utils/helpers';
import BackdropLayer from '../BackdropLayer';

import css from './ScreenBackdrop.module.less';

// The wide picture of a focused card, whether it is a library item or one Seerr found on TMDB. Nothing
// comes back for an item with no backdrop, and the layer then shows the plain page background.
export const backdropUrlFor = (item, serverUrl) => {
	if (!item) return '';
	if (item._externalBackdropUrl) return item._externalBackdropUrl;
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
		() => (settings.showHomeBackdrop === false ? '' : backdropUrlFor(item, serverUrl)),
		[item, serverUrl, settings.showHomeBackdrop]
	);
	return (
		<div className={css.host}>
			<BackdropLayer targetUrl={url} blurAmount={settings.backdropBlurHome} />
		</div>
	);
};

export default memo(ScreenBackdrop);
