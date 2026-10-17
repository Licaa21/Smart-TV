// A screen with no library of its own, a genre or a studio opened from Home or Seerr, is laid out by the library it
// stands for: the movies one, or the shows one when everything it lists is a series.
export const pickStyleLibrary = (libraries, wanted) => {
	const typed = (type) => (libraries || []).find((library) => library?.Id && library.CollectionType?.toLowerCase() === type);
	return typed(wanted) || typed(wanted === 'movies' ? 'tvshows' : 'movies') || null;
};

export const onlySeries = (items) => items.length > 0 && items.every((item) => item.Type === 'Series');
