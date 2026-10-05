// Servers do not agree on how to spell the collection type, so it is lowercased
// before it is compared.
export const isLiveTvLibrary = (library) =>
	String(library?.CollectionType || '').toLowerCase() === 'livetv';

// Both spellings turn up, so both count as a channel.
export const isLiveTvChannel = (item) => item?.Type === 'TvChannel' || item?.Type === 'LiveTvChannel';

// The guide has a button of its own, so the library list drops Live TV rather
// than offering a second way to the same screen.
//
// hideLiveTv drops it with no button standing in for it, for Kids Mode, where the guide is off
// limits and the tile would be the way in.
export const librariesForNav = (libraries, hasLiveTvButton, {hideLiveTv = false} = {}) => {
	const list = libraries || [];
	return (hasLiveTvButton || hideLiveTv) ? list.filter((library) => !isLiveTvLibrary(library)) : list;
};
