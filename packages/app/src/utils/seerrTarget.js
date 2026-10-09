// Which Seerr title a library item stands for.
//
// Only movies and series have a counterpart. An episode or a season resolves through its series
// page instead, where the per-season markers say what is actually available.
//
// The id has to come out as a number. Jellyfin keeps provider ids as strings, while Seerr puts
// this straight into a request body and turns away anything that isn't a number.

export const IDLE = {mediaId: null, mediaType: null};

// How a Seerr title reaches the detail screen when the library has nothing to open for it.
// External rows key some titles by IMDb id alone, so the stub can carry that instead of a
// TMDB id, along with the title for a search fallback.
export const seerrDetailStub = ({mediaId, mediaType, imdbId, title}) => ({
	Id: `seerr-${mediaType}-${mediaId ?? imdbId}`,
	Type: mediaType === 'tv' ? 'Series' : 'Movie',
	_seerrMediaId: mediaId ?? null,
	_seerrMediaType: mediaType,
	_seerrImdbId: imdbId || null,
	_seerrTitle: title || null
});

// A Seerr card, as the recommendation and discovery rows build them, is a title and not a library item. Opened as
// one the detail screen asks the server for an id it has never had and shows the card as if it were in the library.
// A title the library already holds opens as itself, and the rest as the Seerr stub. A library item that a Seerr
// card was resolved into is returned as it is.
export const seerrCardTarget = (item) => {
	if (!item?._seerr || !item._seerrRaw || item._resolvedFromExternal) return item;
	if (item._seerrLibraryId) return {Id: item._seerrLibraryId, Type: item.Type};
	return seerrDetailStub({
		mediaId: item._seerrRaw.mediaId,
		imdbId: item._seerrRaw.imdbId,
		mediaType: item._seerrRaw.mediaType === 'tv' ? 'tv' : 'movie',
		title: item.Name
	});
};

export const isSeerrOnlyItem = (item) => item?._seerrMediaId != null || item?._seerrImdbId != null;

// The search hit of the kind that was asked for. Seerr ranks a search by popularity across
// every kind of media, so the first hit for a film can easily be a series of the same name.
export const bestSearchMatch = (results, mediaType) => {
	if (!Array.isArray(results) || results.length === 0) return null;
	for (const result of results) {
		if (result.mediaType === mediaType) return result;
	}
	return results[0];
};

// Where a cast member opens. A Seerr only title carries TMDB people, who the library has no record
// of, so those open on the Seerr side instead.
export const personRouteFor = (person, seerrOnly) => {
	const id = person?.Id;
	if (!id) return null;

	if (seerrOnly) {
		const tmdbId = Number(id);
		if (Number.isFinite(tmdbId) && tmdbId > 0) {
			return {seerr: true, id: tmdbId, name: person.Name || null};
		}
	}

	return {seerr: false, id};
};

// Seerr hands back the media server's own id for a title it knows is already in
// the library. Opening that instead of the stand-in is what gives the screen its
// playback, ratings and everything else a synthetic item has none of.
export const libraryIdOf = (media) => media?.jellyfinMediaId || media?.jellyfinMediaId4k || null;

export const seerrTargetFor = (item) => {
	if (isSeerrOnlyItem(item)) {
		return {
			mediaId: item._seerrMediaId != null ? Number(item._seerrMediaId) : null,
			mediaType: item._seerrMediaType === 'tv' ? 'tv' : 'movie',
			imdbId: item._seerrImdbId || null,
			title: item._seerrTitle || null
		};
	}
	if (item?.Type !== 'Movie' && item?.Type !== 'Series') return IDLE;
	const tmdbId = Number(item.ProviderIds?.Tmdb);
	if (!Number.isFinite(tmdbId) || tmdbId <= 0) return IDLE;
	return {mediaId: tmdbId, mediaType: item.Type === 'Series' ? 'tv' : 'movie'};
};
