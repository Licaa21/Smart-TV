// The collections, genres and playlists given a home row of their own. Each is a row in the home
// layout with the id the other clients build for it, so the layout reads the same everywhere.

export const PICK_SOURCES = {
	collections: {section: 'collection', gate: 'displayCollectionsRows'},
	genres: {section: 'genre', gate: 'displayGenresRows'},
	playlists: {section: 'playlist', gate: 'displayPlaylistsRows'}
};

export const isPickedRow = (row) => Boolean(row && PICK_SOURCES[row.source] && row.itemId);

const withoutTrailingSlash = (url) => String(url || '').trim().replace(/\/+$/, '');

// Clients spell the same server with and without a trailing slash
export const serverKey = (url) => withoutTrailingSlash(url).toLowerCase();

export const isSameServer = (a, b) => serverKey(a) === serverKey(b);

export const makePickedRow = ({source, serverUrl, itemId, name}, enabled, order) => {
	const server = withoutTrailingSlash(serverUrl);
	return {
		id: `pluginDynamic:${source}:${server}:${PICK_SOURCES[source].section}:${itemId}`,
		name,
		enabled,
		order,
		source,
		serverUrl: server,
		itemId
	};
};

// A Seerr discover slider given a home row. Its section is the slider's id and its item the
// slider's type, so a slider that was replaced by one of another type isn't mistaken for it.
export const makeSeerrSliderRow = ({serverUrl, sliderId, sliderType, name}, enabled, order) => {
	const server = withoutTrailingSlash(serverUrl);
	return {
		id: `pluginDynamic:seerr:${server}:${sliderId}:${sliderType}`,
		name,
		enabled,
		order,
		source: 'seerr',
		serverUrl: server,
		sliderId: String(sliderId),
		sliderType: String(sliderType)
	};
};

export const isSeerrSliderRow = (row) => Boolean(row && row.source === 'seerr' && row.sliderId);

// A picked row answers to the switch of the list it came from, and another server's collections
// only show while multi-server libraries is on
export const isPickedRowShown = (row, settings, currentServerUrl) => {
	if (!settings[PICK_SOURCES[row.source].gate]) return false;
	if (isSameServer(row.serverUrl, currentServerUrl)) return true;
	return row.source === 'collections' && settings.unifiedLibraryMode === true;
};

// The collections and genres this app used to keep in a list of their own, turned into rows for
// the server they were picked on. Only the ones switched on are worth keeping.
export const pickedRowsFromLegacySections = (sections, serverUrl, firstOrder) => (Array.isArray(sections) ? sections : [])
	.filter((section) => section?.enabled && PICK_SOURCES[section.source])
	.sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
	.map((section) => {
		try {
			const spec = JSON.parse(section.specJson);
			return {source: section.source, serverUrl, itemId: spec.collectionId || spec.genreId, name: section.name};
		} catch (e) {
			return null;
		}
	})
	.filter((pick) => pick?.itemId)
	.map((pick, index) => makePickedRow(pick, true, firstOrder + index));
