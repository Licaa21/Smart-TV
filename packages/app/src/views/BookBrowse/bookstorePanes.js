import $L from '@enact/i18n/$L';

import {combinedTypes, matchesScope, peopleAuthors, scopedTypes} from '../../utils/bookLibrary';
import {BOOK_FIELDS, UNTYPED_EXCLUDE} from './useBookLibrary';

const PANE_PAGE_SIZE = 60;

// The sorts the title grid offers, in menu order.
export const TITLE_SORTS = [
	{id: 'dateAdded', label: () => $L('Date Added'), sortBy: 'DateCreated,SortName', descending: true},
	{id: 'name', label: () => $L('Name'), sortBy: 'SortName', descending: false},
	{id: 'premiereDate', label: () => $L('Release Date'), sortBy: 'PremiereDate,SortName', descending: true},
	{id: 'datePlayed', label: () => $L('Last Played'), sortBy: 'DatePlayed,SortName', descending: true},
	{id: 'random', label: () => $L('Random'), sortBy: 'Random', descending: false}
];

export const sortById = (id) => TITLE_SORTS.find((sort) => sort.id === id) || TITLE_SORTS[0];

const pageOf = (result, start, keep) => {
	const raw = result?.Items || [];
	const total = result?.TotalRecordCount;
	return {
		items: raw.filter((item) => item.Id && (!keep || keep(item))),
		read: raw.length,
		hasMore: typeof total === 'number' ? start + raw.length < total : raw.length >= PANE_PAGE_SIZE
	};
};

const titlesPage = async (ctx, start, favorites) => {
	const types = favorites ? combinedTypes(ctx.library) : scopedTypes(ctx.library, ctx.scope);
	const request = () => ctx.api.getItems({
		ParentId: ctx.library.Id,
		...(ctx.untyped ? {ExcludeItemTypes: UNTYPED_EXCLUDE} : {IncludeItemTypes: types}),
		Recursive: true,
		...(favorites ? {Filters: 'IsFavorite'} : {}),
		SortBy: ctx.sort.sortBy,
		SortOrder: ctx.sort.descending ? 'Descending' : 'Ascending',
		StartIndex: start,
		Limit: PANE_PAGE_SIZE,
		Fields: BOOK_FIELDS,
		EnableImageTypes: 'Primary',
		ImageTypeLimit: 1
	});
	let result = await request();
	// A server that answers nothing when the query names book types gets every later page untyped too.
	if (start === 0 && !ctx.untyped && !result?.Items?.length) {
		ctx.untyped = true;
		result = await request();
	}
	const wanted = types.split(',');
	const page = pageOf(result, start, ctx.untyped ? (item) => wanted.includes(item.Type) : null);
	return favorites ? page : {...page, items: page.items.filter((item) => matchesScope(item, ctx.scope))};
};

// One page of a Bookstore pane. Series and collections arrive whole with the library.
const fetchPanePage = async (ctx, start, shown) => {
	switch (ctx.pane) {
		case 'titles':
			return titlesPage(ctx, start, false);
		case 'favorites':
			return titlesPage(ctx, start, true);
		case 'authors': {
			const page = pageOf(await ctx.api.getArtists({
				ParentId: ctx.library.Id,
				SortBy: 'SortName',
				SortOrder: 'Ascending',
				StartIndex: start,
				Limit: PANE_PAGE_SIZE,
				Fields: 'PrimaryImageAspectRatio,SortName'
			}), start);
			if (page.hasMore) return page;
			// An ebook's author only exists as a person on it, so those follow the artists.
			const names = shown.concat(page.items).map((author) => String(author.Name || '').toLowerCase());
			return {...page, items: page.items.concat(peopleAuthors(ctx.titles, names))};
		}
		case 'genres':
			return pageOf(await ctx.api.getMusicGenres({
				ParentId: ctx.library.Id,
				IncludeItemTypes: combinedTypes(ctx.library),
				StartIndex: start,
				Limit: PANE_PAGE_SIZE,
				Fields: 'ItemCounts,PrimaryImageAspectRatio'
			}), start);
		case 'series':
			return {items: ctx.series, read: ctx.series.length, hasMore: false};
		case 'collections':
			return {items: ctx.collections, read: ctx.collections.length, hasMore: false};
		default:
			return {items: [], read: 0, hasMore: false};
	}
};

// Reads pages until one adds something, since a page can hold nothing the pane keeps, like a page
// of comics in the books scope. A random sort reshuffles on every request, so pages can overlap.
export const readMore = async (ctx, start, shown) => {
	const ids = new Set(shown.map((item) => item.Id));
	const added = [];
	let fetched = start;
	let hasMore = true;
	while (!added.length && hasMore) {
		const page = await fetchPanePage(ctx, fetched, shown);
		fetched += page.read;
		hasMore = page.hasMore && page.read > 0;
		page.items.forEach((item) => {
			if (ids.has(item.Id)) return;
			ids.add(item.Id);
			added.push(item);
		});
	}
	return {added, fetched, hasMore};
};
