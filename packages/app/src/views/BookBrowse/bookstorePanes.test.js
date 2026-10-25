import {readMore, sortById} from './bookstorePanes';

const library = {Id: 'lib', CollectionType: 'books'};
const epub = (id) => ({Id: id, Type: 'Book', Name: id, Path: `/b/${id}.epub`});
const comic = (id) => ({Id: id, Type: 'Book', Name: id, Path: `/c/${id}.cbz`});
const page = (items, total) => ({Items: items, TotalRecordCount: total});

const titles = (api, scope = 'all') => ({api, library, pane: 'titles', scope, sort: sortById('dateAdded'), untyped: false});

describe('readMore', () => {
	it('asks for the scope newest first', async () => {
		const audiobook = {Id: 'a', Type: 'AudioBook'};
		const api = {getItems: jest.fn().mockResolvedValue(page([audiobook], 1))};
		const result = await readMore(titles(api, 'audiobooks'), 0, []);
		expect(api.getItems.mock.calls[0][0]).toMatchObject({ParentId: 'lib', IncludeItemTypes: 'AudioBook', SortBy: 'DateCreated,SortName', SortOrder: 'Descending', StartIndex: 0, Limit: 60});
		expect(result).toEqual({added: [audiobook], fetched: 1, hasMore: false});
	});

	it('reads on past a page the scope keeps nothing of', async () => {
		const api = {getItems: jest.fn()
			.mockResolvedValueOnce(page([comic('c1'), comic('c2')], 4))
			.mockResolvedValueOnce(page([epub('e1'), comic('c3')], 4))};
		const result = await readMore(titles(api, 'books'), 0, []);
		expect(api.getItems).toHaveBeenCalledTimes(2);
		expect(api.getItems.mock.calls[1][0].StartIndex).toBe(2);
		expect(result).toEqual({added: [epub('e1')], fetched: 4, hasMore: false});
	});

	it('goes untyped once the typed query comes back empty, and stays that way', async () => {
		const ctx = titles({getItems: jest.fn()
			.mockResolvedValueOnce(page([], 0))
			.mockResolvedValueOnce(page([epub('a'), {Id: 'f', Type: 'Folder'}], 90))
			.mockResolvedValueOnce(page([epub('b')], 90))});
		const first = await readMore(ctx, 0, []);
		expect(ctx.api.getItems.mock.calls[1][0]).toMatchObject({ExcludeItemTypes: 'Folder,CollectionFolder,UserView'});
		expect(ctx.api.getItems.mock.calls[1][0].IncludeItemTypes).toBeUndefined();
		expect(first.added).toEqual([epub('a')]);
		await readMore(ctx, first.fetched, first.added);
		expect(ctx.api.getItems.mock.calls[2][0]).toMatchObject({StartIndex: 2, ExcludeItemTypes: 'Folder,CollectionFolder,UserView'});
	});

	it('leaves out what the list already shows', async () => {
		const api = {getItems: jest.fn().mockResolvedValue(page([epub('a'), epub('b')], 9))};
		const result = await readMore(titles(api), 2, [epub('a')]);
		expect(result.added).toEqual([epub('b')]);
	});

	it('follows the last page of artists with the authors only named on the titles', async () => {
		const api = {getArtists: jest.fn().mockResolvedValue(page([{Id: 'a1', Name: 'Simon Vance'}], 1))};
		const ctx = {api, library, pane: 'authors', titles: [{People: [{Name: 'Frank Herbert', Type: 'Author'}, {Name: 'simon vance', Type: 'Author'}]}]};
		const result = await readMore(ctx, 0, []);
		expect(result.added.map((author) => author.Name)).toEqual(['Simon Vance', 'Frank Herbert']);
		expect(result.hasMore).toBe(false);
	});
});
