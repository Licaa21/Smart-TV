import {toAbsoluteImageUrl} from './helpers';

// The wide artwork a row asked for on a card that is not a library item, such as a TMDB, IMDb or Seerr title.
// Those carry a poster and a backdrop of their own and no Thumb, Banner or Logo, so a wide type takes the backdrop
// and the logo type has nothing to show.
export const externalArtwork = (item, imageType, serverUrl) => {
	if (!item || (imageType !== 'backdrop' && imageType !== 'thumb' && imageType !== 'banner')) return null;
	const providerIds = item.ProviderIds || {};
	const external = item._external || item._externalPosterUrl || providerIds.SeerrPoster || providerIds.SonarrPoster ||
		providerIds.RadarrPoster || providerIds.LidarrPoster || providerIds.ReadarrPoster;
	if (!external || !item._externalBackdropUrl) return null;
	return toAbsoluteImageUrl(item._externalBackdropUrl, serverUrl);
};
