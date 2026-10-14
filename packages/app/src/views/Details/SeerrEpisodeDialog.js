import {useCallback, useEffect} from 'react';
import {createPortal} from 'react-dom';
import $L from '@enact/i18n/$L';
import Spotlight from '@enact/spotlight';

import {formatDuration} from '../../utils/helpers';
import {KEYS} from '../../utils/keys';
import {registerSeerrEpisodeDialog, unregisterSeerrEpisodeDialog} from '../../utils/seerrEpisodeDialogBack';
import {ModalContainer} from '../../utils/spotlightContainers';
import {SpottableDiv} from './detailsSpottables';

import css from './SeerrEpisodes.module.less';

const SCROLL_STEP = 58;

const stopClick = (ev) => ev.stopPropagation();

// What each fact says, left out when the episode has nothing for it.
const factsOf = (episode, airDate) => [
	[$L('Air date'), airDate],
	[$L('Runtime'), episode.RunTimeTicks ? formatDuration(episode.RunTimeTicks) : ''],
	[$L('Rating'), episode.CommunityRating ? `★ ${Number(episode.CommunityRating).toFixed(1)}${episode._voteCount ? ` (${episode._voteCount})` : ''}` : ''],
	[$L('Director'), (episode._directors || []).join(', ')],
	[$L('Writers'), (episode._writers || []).join(', ')],
	[$L('Guest stars'), (episode._guests || []).join(', ')]
].filter(([, value]) => value);

// One episode of a Seerr series in full, opened with OK on its card: the whole description and what
// is known about it. It sits on document.body, since the rows of the detail screen move focus from
// row to row on a 5-way press and would carry it straight out of the dialog.
const SeerrEpisodeDialog = ({episode, airDate, hideOverview, onClose}) => {
	useEffect(() => {
		const focusText = setTimeout(() => Spotlight.focus('seerr-episode-text') || Spotlight.focus('seerr-episode-close'), 100);
		registerSeerrEpisodeDialog(onClose);
		return () => {
			clearTimeout(focusText);
			unregisterSeerrEpisodeDialog(onClose);
		};
	}, [onClose]);

	// While there is more text under the box, up and down read it. Once it has run out the press is
	// Spotlight's again, which is what carries focus on to the way out.
	const handleTextKeyDown = useCallback((ev) => {
		if (ev.keyCode !== KEYS.UP && ev.keyCode !== KEYS.DOWN) return;
		const el = ev.currentTarget;
		const down = ev.keyCode === KEYS.DOWN;
		const room = down ? el.scrollHeight - el.clientHeight - el.scrollTop > 1 : el.scrollTop > 1;
		if (!room) return;
		el.scrollTop += down ? SCROLL_STEP : -SCROLL_STEP;
		ev.preventDefault();
		ev.stopPropagation();
	}, []);

	const facts = factsOf(episode, airDate);
	const season = episode.ParentIndexNumber;
	const label = season != null && episode.IndexNumber != null
		? `${$L('Season {number}').replace('{number}', season)} · ${$L('Episode')} ${episode.IndexNumber}`
		: '';
	const description = hideOverview ? '' : episode.Overview || $L('No description available.');

	return createPortal(
		<div className={css.dialogBackdrop} onClick={onClose}>
			<ModalContainer className={css.dialogPanel} spotlightId="seerr-episode-dialog" onClick={stopClick}>
				<div className={css.dialogHead}>
					<div className={css.dialogLabel}>{[episode.SeriesName, label].filter(Boolean).join(' · ')}</div>
					<h2 className={css.dialogTitle}>{episode.Name || `${$L('Episode')} ${episode.IndexNumber}`}</h2>
				</div>
				<div className={css.dialogBody}>
					<div className={css.dialogSide}>
						<div className={css.dialogStill}>
							{episode._externalPosterUrl ? <img src={episode._externalPosterUrl} alt="" /> : null}
						</div>
						{facts.map(([name, value]) => (
							<div key={name} className={css.fact}>
								<span className={css.factName}>{name}</span>
								<span className={css.factValue}>{value}</span>
							</div>
						))}
					</div>
					{description && (
						<SpottableDiv
							className={css.dialogText}
							spotlightId="seerr-episode-text"
							onKeyDown={handleTextKeyDown}
						>
							{description}
						</SpottableDiv>
					)}
				</div>
				<SpottableDiv className={css.dialogClose} spotlightId="seerr-episode-close" onClick={onClose}>{$L('Close')}</SpottableDiv>
			</ModalContainer>
		</div>,
		document.body
	);
};

export default SeerrEpisodeDialog;
