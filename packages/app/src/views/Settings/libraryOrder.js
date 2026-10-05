import {isGameLibrary} from '../../utils/gameLibrary';

const ICON_BY_COLLECTION_TYPE = {
	movies: 'movie',
	tvshows: 'tv',
	music: 'music_note',
	books: 'menu_book',
	audiobooks: 'menu_book',
	livetv: 'live_tv',
	homevideos: 'photo_library',
	photos: 'photo_library',
	boxsets: 'collections_bookmark',
	playlists: 'playlist_play'
};

export const libraryOrderIcon = (library) => {
	if (isGameLibrary(library.Id, library.CollectionType, library.Name)) return 'sports_esports';
	return ICON_BY_COLLECTION_TYPE[(library.CollectionType || '').toLowerCase()] || 'video_library';
};

// Each server keeps the order of its own libraries, so with several servers a library only
// moves among the ones from its server. A single server is one group.
const serverOf = (library) => library?._serverUrl || '';

export const isFirstOfServer = (libraries, index) =>
	index === 0 || serverOf(libraries[index - 1]) !== serverOf(libraries[index]);

export const isLastOfServer = (libraries, index) =>
	index === libraries.length - 1 || serverOf(libraries[index + 1]) !== serverOf(libraries[index]);

// The list with one library moved to newIndex, or null when that would leave its server.
export const moveLibrary = (libraries, index, newIndex) => {
	if (newIndex < 0 || newIndex >= libraries.length || index === newIndex) return null;
	if (serverOf(libraries[index]) !== serverOf(libraries[newIndex])) return null;
	const next = [...libraries];
	next.splice(newIndex, 0, next.splice(index, 1)[0]);
	return next;
};

// What each server is told, keyed by server url (empty for a single server): the ids of its
// own libraries in the order on screen.
export const orderedViewsByServer = (libraries) => libraries.reduce((orders, library) => {
	const key = serverOf(library);
	(orders[key] = orders[key] || []).push(library.Id);
	return orders;
}, {});
