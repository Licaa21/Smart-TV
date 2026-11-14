// The picture behind a details screen. It used to be asked for when the screen opened, so a screen drawn whole from a kept
// copy still waited a second or two on a black page for its backdrop to be fetched and decoded on the TV. The pictures of
// the screens that were kept are read ahead through the same held and decoded art the cards use (artPrefetch.js) and
// pinned there, so card art that keeps coming does not push them out, and the screen draws from memory when it opens.
import {getBackdropId, getImageUrl} from './helpers';
import {serverBlurredUrl} from './serverBlur';
import {artSource, decodeArt, hasArt, pinArt, prefetchArt} from '../components/MediaCard/artPrefetch';

// How far from focus the work is counted, so it never gets in front of what the viewer is looking at
const WARM_RANK = 12;

// The picture the screen asks the server for, before any blur. Seerr artwork arrives as a finished address.
export const detailsBackdropUrl = (item, serverUrl) => {
	if (!item) return null;
	if (item._externalBackdropUrl) return item._externalBackdropUrl;
	const backdropId = getBackdropId(item);
	return backdropId ? getImageUrl(serverUrl, backdropId, 'Backdrop', {maxWidth: 1920, quality: 90}) : null;
};

// What to put in an <img> for a backdrop address: the copy read ahead when there is one (in memory, decoded), else the
// address itself, as before. Every details style draws its backdrop through this.
export const heldBackdrop = (url) => {
	if (!url) return url;
	pinArt(url);
	return artSource(url) || url;
};

// Reads the picture of this title's screen ahead and decodes it once it is held. The styles of the details screen draw
// the full picture or the server's blurred copy of it, so both are read (the blurred one is a fifth of the size).
export const warmDetailsBackdrop = (item, serverUrl, settings) => {
	if (!item || item.Type === 'Person' || settings?.detailsBackdropEnabled === false) return false;
	const plain = detailsBackdropUrl(item, serverUrl);
	if (!plain) return false;
	const blurred = serverBlurredUrl(plain, settings?.backdropBlurDetail);
	[plain, blurred].filter(Boolean).forEach((url) => {
		pinArt(url);
		if (hasArt(url)) decodeArt(url, WARM_RANK);
		else prefetchArt(url, WARM_RANK, null, () => decodeArt(url, WARM_RANK));
	});
	return true;
};
