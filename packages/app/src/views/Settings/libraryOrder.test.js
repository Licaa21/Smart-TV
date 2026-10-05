import {isFirstOfServer, isLastOfServer, libraryOrderIcon, moveLibrary, orderedViewsByServer} from './libraryOrder';

jest.mock('../../utils/gameLibrary', () => ({
	isGameLibrary: (id, collectionType, name) => /games/i.test(name || '')
}));

const lib = (Id, serverUrl) => ({Id, Name: Id, _serverUrl: serverUrl});
const ids = (libraries) => libraries.map((library) => library.Id);

describe('libraryOrderIcon', () => {
	test('follows the collection type, with a game library and anything unknown on their own icons', () => {
		expect(libraryOrderIcon({CollectionType: 'movies'})).toBe('movie');
		expect(libraryOrderIcon({CollectionType: 'TvShows'})).toBe('tv');
		expect(libraryOrderIcon({CollectionType: 'audiobooks'})).toBe('menu_book');
		expect(libraryOrderIcon({CollectionType: 'photos'})).toBe('photo_library');
		expect(libraryOrderIcon({CollectionType: 'boxsets'})).toBe('collections_bookmark');
		expect(libraryOrderIcon({CollectionType: 'playlists'})).toBe('playlist_play');
		expect(libraryOrderIcon({Name: 'Games', CollectionType: ''})).toBe('sports_esports');
		expect(libraryOrderIcon({Name: 'Mixed'})).toBe('video_library');
	});
});

describe('moving a library', () => {
	const single = [lib('a'), lib('b'), lib('c')];
	const two = [lib('a1', 'http://a'), lib('a2', 'http://a'), lib('b1', 'http://b'), lib('b2', 'http://b')];

	test('swaps it with its neighbour', () => {
		expect(ids(moveLibrary(single, 0, 1))).toEqual(['b', 'a', 'c']);
		expect(ids(moveLibrary(single, 2, 1))).toEqual(['a', 'c', 'b']);
	});

	test('goes nowhere past either end', () => {
		expect(moveLibrary(single, 0, -1)).toBe(null);
		expect(moveLibrary(single, 2, 3)).toBe(null);
	});

	test('with several servers stays among its own server\'s libraries', () => {
		expect(moveLibrary(two, 1, 2)).toBe(null);
		expect(ids(moveLibrary(two, 2, 3))).toEqual(['a1', 'a2', 'b2', 'b1']);
		expect([isFirstOfServer(two, 2), isLastOfServer(two, 1)]).toEqual([true, true]);
		expect([isFirstOfServer(two, 1), isLastOfServer(two, 2)]).toEqual([false, false]);
	});

	test('each server is told only its own libraries, in the order shown', () => {
		expect(orderedViewsByServer(two)).toEqual({'http://a': ['a1', 'a2'], 'http://b': ['b1', 'b2']});
		expect(orderedViewsByServer(single)).toEqual({'': ['a', 'b', 'c']});
	});
});
