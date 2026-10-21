import {useCallback} from 'react';
import Spottable from '@enact/spotlight/Spottable';
import {trackRuntimeLabel} from '../../components/DetailTrackList/trackRows';

import css from './MusicLibrary.module.less';

const SpottableDiv = Spottable('div');

// Songs as one-line rows: the track number or the album art, the title with `subtitleFor`'s line
// under it when there is one, and the length at the end. `activeId` marks the song an album was
// left on.
const MusicTrackList = ({tracks, numbered = false, subtitleFor, artFor, activeId, firstSpotlightId, onPlay}) => {
	const handleClick = useCallback((e) => {
		const track = tracks[parseInt(e.currentTarget.dataset.index, 10)];
		if (track) onPlay(track);
	}, [tracks, onPlay]);

	return (
		<div>
			{tracks.map((track, index) => {
				const subtitle = subtitleFor?.(track);
				const art = artFor?.(track);
				const length = trackRuntimeLabel(track.RunTimeTicks, true);
				return (
					<SpottableDiv
						key={track.Id}
						className={track.Id === activeId ? `${css.track} ${css.trackActive}` : css.track}
						data-index={index}
						spotlightId={index === 0 ? firstSpotlightId : undefined}
						onClick={handleClick}
					>
						{numbered
							? <span className={css.trackNumber}>{track.IndexNumber ?? index + 1}</span>
							: art
								? <img className={css.trackArt} src={art} alt="" loading="lazy" />
								: <span className={css.trackArt} />}
						<span className={css.trackText}>
							<span className={css.trackTitle}>{track.Name}</span>
							{subtitle && <span className={css.trackSubtitle}>{subtitle}</span>}
						</span>
						{length && <span className={css.trackLength}>{length}</span>}
					</SpottableDiv>
				);
			})}
		</div>
	);
};

export default MusicTrackList;
