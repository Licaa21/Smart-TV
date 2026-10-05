import $L from '@enact/i18n/$L';

import {formatDuration, getImageUrl} from '../../utils/helpers';
import {DETAIL_ICON_PATHS} from './detailIcons';
import {SpottableDiv, HorizontalContainer} from './detailsSpottables';
import {handleSeasonButtonKeyDown} from './detailsFocus';
import {PosterBadges} from './DetailBadges';

import css from './Details.module.less';

const PlaylistScreen = ({
	item,
	serverUrl,
	showsSection,
	posterUrl,
	genres,
	playlistItems,
	onPlay,
	onShuffle,
	onToggleFavorite,
	onItemSelect,
	onItemKeyDown,
	onFocusRow
}) => {
	const playlistItemCount = playlistItems.length;
	const totalDuration = playlistItems.reduce((sum, t) => sum + (t.RunTimeTicks || 0), 0);

	return (
		<>
			<div className={css.seasonDetailHeader}>
				{showsSection('poster') && posterUrl && (
					<div className={css.seasonDetailPoster}>
						<img src={posterUrl} alt="" />
						<PosterBadges userData={item.UserData} />
					</div>
				)}
				<div className={css.seasonDetailInfo}>
					<h1 className={css.seasonDetailTitle}>{item.Name}</h1>
					<span className={css.seasonDetailCount}>
						{playlistItemCount} {playlistItemCount !== 1 ? $L('Items') : $L('Item')}
						{totalDuration > 0 ? ` · ${formatDuration(totalDuration)}` : ''}
					</span>
					{genres.length > 0 && (
						<span className={css.seasonDetailCount}>{genres.join(', ')}</span>
					)}
					{item.Overview && <p className={css.overview}>{item.Overview}</p>}
				</div>
			</div>

			<HorizontalContainer className={css.actionButtons} onKeyDown={handleSeasonButtonKeyDown} onFocus={onFocusRow}>
				{playlistItems.length > 0 && (
					<SpottableDiv className={css.btnWrapper} onClick={onPlay} onFocus={onFocusRow} spotlightId="details-primary-btn">
						<div className={css.btnAction}>
							<span className={css.btnIcon}>▶</span>
						</div>
						<span className={css.btnLabel}>{$L('Play')}</span>
					</SpottableDiv>
				)}
				{playlistItems.length > 1 && (
					<SpottableDiv className={css.btnWrapper} onClick={onShuffle}>
						<div className={css.btnAction}>
							<svg className={css.btnIcon} viewBox="0 -960 960 960" fill="currentColor">
								<path d={DETAIL_ICON_PATHS.shuffle}/>
							</svg>
						</div>
						<span className={css.btnLabel}>{$L('Shuffle')}</span>
					</SpottableDiv>
				)}
				<SpottableDiv className={css.btnWrapper} onClick={onToggleFavorite} spotlightId="details-favorite-btn">
					<div className={css.btnAction}>
						<svg className={`${css.btnIcon} ${item.UserData?.IsFavorite ? css.favorited : ''}`} viewBox="0 -960 960 960" fill="currentColor">
							<path d={DETAIL_ICON_PATHS.favorite}/>
						</svg>
					</div>
					<span className={css.btnLabel}>{item.UserData?.IsFavorite ? $L('Favorited') : $L('Favorite')}</span>
				</SpottableDiv>
			</HorizontalContainer>

			<p className={css.playlistHint}>{$L('◀ ▶ to re-order · DEL to remove')}</p>

			<div className={`${css.trackList} ${css.playlistItemsList}`} onKeyDown={onItemKeyDown}>
				{playlistItems.map((plItem, idx) => {
					const plDuration = plItem.RunTimeTicks ? formatDuration(plItem.RunTimeTicks) : '';
					const plArtist = plItem.AlbumArtist || plItem.Artists?.[0] || '';
					const isAudio = plItem.MediaType === 'Audio';
					const thumbUrl = plItem.ImageTags?.Primary
						? getImageUrl(serverUrl, plItem.Id, 'Primary', {maxHeight: 80, quality: 80})
						: null;

					return (
						<SpottableDiv
							key={plItem.PlaylistItemId || plItem.Id}
							className={css.playlistItem}
							data-playlist-item-id={plItem.Id}
							data-playlist-index={idx}
							onClick={onItemSelect}
						>
							<span className={css.trackNumber}>{idx + 1}</span>
							{thumbUrl && (
								<div className={css.playlistItemThumb}>
									<img src={thumbUrl} alt="" />
								</div>
							)}
							<div className={css.trackInfo}>
								<span className={css.trackTitle}>{plItem.Name}</span>
								{plArtist && <span className={css.trackArtist}>{plArtist}</span>}
								{!isAudio && plItem.Type && <span className={css.trackArtist}>{plItem.Type}</span>}
							</div>
							<span className={css.trackDuration}>{plDuration}</span>
							<div className={css.playlistReorderArrows}>
								<span className={`${css.reorderArrow} ${idx === 0 ? css.reorderArrowDisabled : ''}`}>▲</span>
								<span className={`${css.reorderArrow} ${idx === playlistItems.length - 1 ? css.reorderArrowDisabled : ''}`}>▼</span>
							</div>
						</SpottableDiv>
					);
				})}
			</div>
		</>
	);
};

export default PlaylistScreen;
