import {isPickedRowShown, makePickedRow, pickedRowsFromLegacySections} from './pickedRows';

const on = {displayCollectionsRows: true, displayGenresRows: true, displayPlaylistsRows: true};

describe('makePickedRow', () => {
	test('builds the id the other clients give the same row', () => {
		const row = makePickedRow({source: 'genres', serverUrl: 'http://server:8096/', itemId: 'g1', name: 'Horror'}, true, 3);
		expect(row).toEqual({
			id: 'pluginDynamic:genres:http://server:8096:genre:g1',
			name: 'Horror',
			enabled: true,
			order: 3,
			source: 'genres',
			serverUrl: 'http://server:8096',
			itemId: 'g1'
		});
	});
});

describe('isPickedRowShown', () => {
	const collection = (serverUrl) => makePickedRow({source: 'collections', serverUrl, itemId: 'c1', name: 'C'}, true, 0);

	test('answers to the switch of the list it came from', () => {
		expect(isPickedRowShown(collection('http://server'), on, 'http://server')).toBe(true);
		expect(isPickedRowShown(collection('http://server'), {...on, displayCollectionsRows: false}, 'http://server')).toBe(false);
	});

	test('a server spelled with a trailing slash or other case is the same server', () => {
		expect(isPickedRowShown(collection('http://Server'), on, 'http://server/')).toBe(true);
	});

	test('another server only shows its collections, and only with multi-server libraries on', () => {
		const genre = makePickedRow({source: 'genres', serverUrl: 'http://other', itemId: 'g1', name: 'G'}, true, 0);
		expect(isPickedRowShown(collection('http://other'), on, 'http://server')).toBe(false);
		expect(isPickedRowShown(collection('http://other'), {...on, unifiedLibraryMode: true}, 'http://server')).toBe(true);
		expect(isPickedRowShown(genre, {...on, unifiedLibraryMode: true}, 'http://server')).toBe(false);
	});
});

describe('pickedRowsFromLegacySections', () => {
	test('the ones switched on become rows for the server they were picked on, in their order', () => {
		const rows = pickedRowsFromLegacySections([
			{id: 'genre:g1', name: 'Horror', enabled: true, order: 2, source: 'genres', specJson: '{"kind":"genre","genreId":"g1"}'},
			{id: 'collection:c1', name: 'Alien', enabled: true, order: 1, source: 'collections', specJson: '{"kind":"collection","collectionId":"c1"}'},
			{id: 'collection:c2', name: 'Off', enabled: false, order: 0, source: 'collections', specJson: '{"kind":"collection","collectionId":"c2"}'},
			{id: 'collection:c3', name: 'Broken', enabled: true, order: 3, source: 'collections', specJson: 'not json'}
		], 'http://server/', 10);

		expect(rows.map((row) => [row.id, row.order])).toEqual([
			['pluginDynamic:collections:http://server:collection:c1', 10],
			['pluginDynamic:genres:http://server:genre:g1', 11]
		]);
		expect(rows.every((row) => row.enabled)).toBe(true);
	});

	test('nothing stored is nothing to keep', () => {
		expect(pickedRowsFromLegacySections(undefined, 'http://server', 0)).toEqual([]);
	});
});
