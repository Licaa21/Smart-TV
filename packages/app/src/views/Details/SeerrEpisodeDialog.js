import {useEffect, useRef} from 'react';
import {createPortal} from 'react-dom';
import $L from '@enact/i18n/$L';

import {formatDuration} from '../../utils/helpers';
import {KEYS} from '../../utils/keys';
import {registerSeerrEpisodeDialog, unregisterSeerrEpisodeDialog} from '../../utils/seerrEpisodeDialogBack';

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
// is known about it. Nothing in it takes focus. Focus stays on the card behind, so the dialog takes every key
// itself: up and down read a long description, and the rest do nothing until Back, which closes it through the
// detail screen's back chain. It sits on document.body, outside the rows of the detail screen.
const SeerrEpisodeDialog = ({episode, airDate, hideOverview, onClose}) => {
	const textRef = useRef(null);

	useEffect(() => {
		registerSeerrEpisodeDialog(onClose);
		const handleKeyDown = (ev) => {
			if (ev.keyCode === KEYS.UP || ev.keyCode === KEYS.DOWN) {
				const el = textRef.current;
				if (el) el.scrollTop += ev.keyCode === KEYS.DOWN ? SCROLL_STEP : -SCROLL_STEP;
			}
			ev.preventDefault();
			ev.stopPropagation();
		};
		window.addEventListener('keydown', handleKeyDown, true);
		return () => {
			window.removeEventListener('keydown', handleKeyDown, true);
			unregisterSeerrEpisodeDialog(onClose);
		};
	}, [onClose]);

	const facts = factsOf(episode, airDate);
	const season = episode.ParentIndexNumber;
	const label = season != null && episode.IndexNumber != null
		? `${$L('Season {number}').replace('{number}', season)} · ${$L('Episode')} ${episode.IndexNumber}`
		: '';
	const description = hideOverview ? '' : episode.Overview || $L('No description available.');

	return createPortal(
		<div className={css.dialogBackdrop} onClick={onClose}>
			<div className={css.dialogPanel} onClick={stopClick}>
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
						<div className={css.dialogText} ref={textRef}>{description}</div>
					)}
				</div>
				<div className={css.dialogHint}>{$L('Press Back to close')}</div>
			</div>
		</div>,
		document.body
	);
};

export default SeerrEpisodeDialog;
