import {useCallback} from 'react';
import $L from '@enact/i18n/$L';

import useItemMenuHold from '../../hooks/useItemMenuHold';
import {KEYS} from '../../utils/keys';
import {SpottableDiv, RowContainer} from '../../views/Details/detailsSpottables';
import {trackRowsFor, trackTitle, trackSecondLine, trackNumber} from './trackRows';

import css from './DetailTrackList.module.less';

// The delete key on a keyboard and the red button on a remote both remove a playlist entry.
const REMOVE_KEYS = [46, KEYS.RED];

// A list of tracks, used by the album, playlist and collection order cards. With `menuOptions`
// set, holding OK on a row opens the item menu with those options.
const DetailTrackList = ({
	tracks = [],
	isAudiobook = false,
	groupByDisc = false,
	isPlaylist = false,
	showAlbum = false,
	manage = false,
	menuOptions = null,
	onPlayTrack,
	onReorder,
	onRemove,
	firstSpotlightId
}) => {
	const trackAt = useCallback((target) => {
		const row = target.closest('[data-index]');
		return (row && tracks[parseInt(row.dataset.index, 10)]) || null;
	}, [tracks]);
	const menuHold = useItemMenuHold(trackAt, menuOptions);

	const handleClick = useCallback((ev) => {
		const track = trackAt(ev.currentTarget);
		if (track) onPlayTrack?.(track);
	}, [trackAt, onPlayTrack]);

	const handleKeyDown = useCallback((ev) => {
		if (!manage) return;
		const row = ev.target.closest('.spottable');
		const index = parseInt(row?.dataset.index, 10);
		if (isNaN(index)) return;

		if (ev.keyCode === KEYS.LEFT && index > 0) {
			ev.preventDefault();
			ev.stopPropagation();
			onReorder?.(index, -1);
		} else if (ev.keyCode === KEYS.RIGHT && index < tracks.length - 1) {
			ev.preventDefault();
			ev.stopPropagation();
			onReorder?.(index, 1);
		} else if (REMOVE_KEYS.includes(ev.keyCode)) {
			ev.preventDefault();
			ev.stopPropagation();
			onRemove?.(tracks[index]?.PlaylistItemId);
		}
	}, [manage, onReorder, onRemove, tracks]);

	if (!tracks.length) return null;

	return (
		<RowContainer className={css.trackList} onKeyDown={handleKeyDown} {...(menuOptions ? menuHold : {})}>
			{trackRowsFor(tracks, groupByDisc).map((row) => {
				if (row.kind === 'disc') {
					return <div key={row.key} className={css.discHeading}>{$L('Disc {number}').replace('{number}', row.disc)}</div>;
				}
				const {track, index} = row;
				const secondLine = trackSecondLine(track, {isAudiobook, showAlbum});
				return (
					<SpottableDiv
						key={row.key}
						className={css.trackRow}
						data-index={index}
						spotlightId={index === 0 ? firstSpotlightId : undefined}
						onClick={handleClick}
					>
						<span className={css.trackIndex}>{trackNumber(track, index, isPlaylist)}</span>
						<span className={css.trackText}>
							<span className={css.trackTitle}>{trackTitle(track)}</span>
							{secondLine && <span className={css.trackSubtitle}>{secondLine}</span>}
						</span>
					</SpottableDiv>
				);
			})}
		</RowContainer>
	);
};

export default DetailTrackList;
