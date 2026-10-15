// Servers do not agree on how to spell the collection type, so it is lowercased
// before it is compared.
export const isLiveTvLibrary = (library) =>
	String(library?.CollectionType || '').toLowerCase() === 'livetv';

// Both spellings turn up, so both count as a channel.
export const isLiveTvChannel = (item) => item?.Type === 'TvChannel' || item?.Type === 'LiveTvChannel';

export const isLiveTvProgram = (item) => (item?.Type === 'Program' || item?.Type === 'LiveTvProgram') && Boolean(item.ChannelId);

// A program has no stream of its own, so watching one means tuning its channel. The server fields
// come along so a home showing several servers tunes it on the right one.
export const channelForProgram = (program) => {
	const channel = {
		Id: program.ChannelId,
		Name: program.ChannelName,
		Type: 'TvChannel',
		ChannelNumber: program.ChannelNumber,
		ImageTags: program.ChannelPrimaryImageTag ? {Primary: program.ChannelPrimaryImageTag} : {}
	};
	for (const key of Object.keys(program)) {
		if (key.startsWith('_server')) channel[key] = program[key];
	}
	return channel;
};

// The guide has a button of its own, so the library list drops Live TV rather
// than offering a second way to the same screen.
//
// hideLiveTv drops it with no button standing in for it, for Kids Mode, where the guide is off
// limits and the tile would be the way in.
export const librariesForNav = (libraries, hasLiveTvButton, {hideLiveTv = false} = {}) => {
	const list = libraries || [];
	return (hasLiveTvButton || hideLiveTv) ? list.filter((library) => !isLiveTvLibrary(library)) : list;
};
