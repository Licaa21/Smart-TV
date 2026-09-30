import {useCallback, useEffect, useRef} from 'react';
import $L from '@enact/i18n/$L';
import Spotlight from '@enact/spotlight';

import {useSettings} from '../../context/SettingsContext';
import {getServerUrl} from '../../services/jellyfinApi';
import {getImageUrl} from '../../utils/helpers';
import {keepFocusInView} from '../../utils/focusScroll';
import {watchedPercent} from '../../utils/episodeBrowser';
import {ModalContainer} from '../../utils/spotlightContainers';
import {hidesMediaDescription} from '../Details/detailsMedia';
import {WatchedCheckIcon} from '../Details/DetailBadges';
import {SpottableButton, SpottableDiv} from './PlayerConstants';
import useSeriesEpisodes from './useSeriesEpisodes';

import css from './EpisodeBrowser.module.less';

const CURRENT_EPISODE_ID = 'episodes-current';
const stopPropagation = (e) => e.stopPropagation();

// "Season 2 · Episode 5", with a placeholder where the server has no number for it.
const episodeLine = (episode) => {
	const parts = [];
	if (episode.ParentIndexNumber != null) parts.push(`${$L('Season')} ${episode.ParentIndexNumber}`);
	parts.push(`${$L('Episode')} ${episode.IndexNumber ?? '?'}`);
	return parts.join(' · ');
};

const EpisodeRow = ({episode, serverUrl, isCurrent, hideOverview, onSelect}) => {
	const thumb = episode.ImageTags?.Primary
		? getImageUrl(episode._serverUrl || serverUrl, episode.Id, 'Primary', {maxWidth: 400, quality: 80})
		: null;
	const percent = watchedPercent(episode);
	const played = episode.UserData?.Played === true;

	return (
		<SpottableDiv
			className={`${css.episode} ${isCurrent ? css.episodeCurrent : ''}`}
			data-episode-id={episode.Id}
			data-selected={isCurrent ? 'true' : undefined}
			spotlightId={isCurrent ? CURRENT_EPISODE_ID : undefined}
			onClick={onSelect}
		>
			<div className={css.thumb}>
				{thumb ? (
					<img className={css.thumbImage} src={thumb} alt="" />
				) : (
					<div className={css.thumbPlaceholder}>
						<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM9.5 7.5l7 4.5-7 4.5z" /></svg>
					</div>
				)}
				{percent > 0 && (
					<div className={css.progressBar}>
						<div className={css.progress} style={{width: `${percent}%`}} />
					</div>
				)}
				{played && (
					<div className={css.watchedBadge}>
						<WatchedCheckIcon compact />
					</div>
				)}
			</div>
			<div className={css.body}>
				<span className={css.number}>{episodeLine(episode)}</span>
				<span className={css.title}>{episode.Name}</span>
				{episode.Overview && !hideOverview && <p className={css.overview}>{episode.Overview}</p>}
			</div>
		</SpottableDiv>
	);
};

/**
 * The Netflix style episode list over the video. The video keeps playing behind it, so this
 * only dims the picture and takes the remote. A season tab strip runs along the top and the
 * episodes of the selected season scroll underneath, each with its still, its season and
 * episode, its title, its description and how far through it you are.
 *
 * The header is the series logo, the same picture the player shows in its corner, because the
 * name the server holds can be in another language than the logo people know the show by. The
 * name only stands in where there is no logo or it would not load.
 *
 * Choosing an episode hands it to `onSelect`, which switches playback to it in place.
 */
const EpisodeBrowser = ({item, logoUrl, onLogoError, onSelect, onClose}) => {
	const {settings} = useSettings();
	const {seasons, selectedSeasonId, selectSeason, episodes, failed} = useSeriesEpisodes({item, enabled: true});
	const listRef = useRef(null);
	const focusedOnceRef = useRef(false);
	const serverUrl = item?._serverUrl || getServerUrl();

	// Once the season that is playing has loaded, the remote moves to the episode that is on.
	useEffect(() => {
		if (focusedOnceRef.current || !episodes || episodes.length === 0) return;
		focusedOnceRef.current = true;
		window.requestAnimationFrame(() => {
			const target = Spotlight.focus(CURRENT_EPISODE_ID) ? document.querySelector(`[data-episode-id="${item.Id}"]`) : null;
			if (!target) {
				const first = listRef.current?.querySelector('[data-episode-id]');
				if (first) Spotlight.focus(first);
				return;
			}
			// Focus doesn't scroll, so bring the row up under the season tabs.
			if (listRef.current) listRef.current.scrollTop = Math.max(0, target.offsetTop - 24);
		});
	}, [episodes, item.Id]);

	const handleSeason = useCallback((e) => {
		selectSeason(e.currentTarget.dataset.seasonId);
	}, [selectSeason]);

	const handleEpisode = useCallback((e) => {
		const id = e.currentTarget.dataset.episodeId;
		const episode = (episodes || []).find((candidate) => String(candidate.Id) === id);
		if (episode) onSelect(episode);
	}, [episodes, onSelect]);

	const currentSeasonId = String(selectedSeasonId);

	return (
		<div className={css.overlay} onClick={onClose}>
			<ModalContainer className={css.panel} onClick={stopPropagation} data-modal="episodes" spotlightId="episodes-modal">
				{logoUrl ? (
					<img className={css.logo} src={logoUrl} alt={item.SeriesName || ''} onError={onLogoError} />
				) : (
					<h2 className={css.seriesName}>{item.SeriesName}</h2>
				)}
				{seasons && seasons.length > 0 && (
					<div className={css.tabs} onFocus={keepFocusInView}>
						{seasons.map((season) => {
							const active = String(season.Id) === currentSeasonId;
							return (
								<SpottableButton
									key={season.Id}
									className={`${css.tab} ${active ? css.tabActive : ''}`}
									data-season-id={season.Id}
									onClick={handleSeason}
								>
									{season.Name}
								</SpottableButton>
							);
						})}
					</div>
				)}
				<div className={css.list} ref={listRef} onFocus={keepFocusInView}>
					{failed && <SpottableDiv className={css.message}>{$L('Failed to load')}</SpottableDiv>}
					{!failed && episodes === null && <SpottableDiv className={css.message}>{$L('Loading...')}</SpottableDiv>}
					{!failed && episodes && episodes.length === 0 && <SpottableDiv className={css.message}>{$L('Nothing here yet.')}</SpottableDiv>}
					{!failed && episodes && episodes.map((episode) => (
						<EpisodeRow
							key={episode.Id}
							episode={episode}
							serverUrl={serverUrl}
							isCurrent={String(episode.Id) === String(item.Id)}
							hideOverview={hidesMediaDescription(episode, settings)}
							onSelect={handleEpisode}
						/>
					))}
				</div>
				<p className={css.footer}>{$L('Press BACK to close')}</p>
			</ModalContainer>
		</div>
	);
};

export default EpisodeBrowser;
