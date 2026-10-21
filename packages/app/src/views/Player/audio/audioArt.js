import {getImageUrl} from '../../../utils/helpers';

export const IconMusicNote = () => (
	<svg viewBox="0 -960 960 960" fill="currentColor" width="96" height="96">
		<path d="M400-120q-66 0-113-47t-47-113q0-66 47-113t113-47q23 0 42.5 5.5T480-418v-422h240v160H560v382q0 66-47 113t-113 47Z" />
	</svg>
);

// The mini player asks for the same url as the full one, so it comes out of the image cache.
export const artUrlFor = (item, serverUrl) => {
	const base = item?._serverUrl || serverUrl;
	if (item?.ImageTags?.Primary) return getImageUrl(base, item.Id, 'Primary', {maxHeight: 600, quality: 90});
	if (item?.AlbumId && item?.AlbumPrimaryImageTag) {
		return getImageUrl(base, item.AlbumId, 'Primary', {maxHeight: 600, quality: 90, tag: item.AlbumPrimaryImageTag});
	}
	return null;
};
