import {useCallback, useEffect, useRef} from 'react';
import {createPortal} from 'react-dom';
import $L from '@enact/i18n/$L';
import Spotlight from '@enact/spotlight';

import {keepFocusInView} from '../../utils/focusScroll';
import {formatDuration} from '../../utils/helpers';
import {KEYS} from '../../utils/keys';
import {registerSeerrEpisodeDialog, unregisterSeerrEpisodeDialog} from '../../utils/seerrEpisodeDialogBack';
import {ModalContainer} from '../../utils/spotlightContainers';
import {SpottableDiv} from './detailsSpottables';

import css from './SeerrEpisodes.module.less';

const SCROLL_STEP = 58;

const ICONS = {
	date: 'M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z',
	time: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z',
	star: 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
	back: 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z'
};

const stopClick = (ev) => ev.stopPropagation();

const Icon = ({name}) => (
	<svg className={css.dialogIcon} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
		<path d={ICONS[name]} />
	</svg>
);

// The three facts every episode has, as chips, each left out when the episode has nothing for it.
const chipsOf = (episode, airDate) => [
	airDate && {id: 'date', icon: 'date', text: airDate},
	episode.RunTimeTicks && {id: 'time', icon: 'time', text: formatDuration(episode.RunTimeTicks)},
	episode.CommunityRating && {
		id: 'rating',
		icon: 'star',
		text: `${Number(episode.CommunityRating).toFixed(1)}${episode._voteCount ? ` (${episode._voteCount})` : ''}`,
		accent: true
	}
].filter(Boolean);

// The people behind it, which only some answers carry.
const creditsOf = (episode) => [
	[$L('Director'), (episode._directors || []).join(', ')],
	[$L('Writers'), (episode._writers || []).join(', ')]
].filter(([, value]) => value);

// A guest star as a round photo and a name. One that has an id opens their page.
const initialsOf = (name) => String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');

const Star = ({star, first, onOpen}) => {
	const photo = star.photo ? <img src={star.photo} alt="" /> : <span className={css.castInitials}>{initialsOf(star.name)}</span>;
	const body = (
		<>
			<div className={css.castPhoto}>{photo}</div>
			<div className={css.castName}>{star.name}</div>
			{star.character && <div className={css.castRole}>{star.character}</div>}
		</>
	);
	if (!star.id) return <div className={css.cast}>{body}</div>;
	return (
		<SpottableDiv className={css.cast} data-person-id={star.id} data-person-name={star.name} data-selected={first ? 'true' : undefined} onClick={onOpen}>
			{body}
		</SpottableDiv>
	);
};

// One episode of a Seerr series in full, opened with OK on its card. Back closes it through the detail screen's
// back chain. With guest stars that have a page to open, focus moves into the dialog onto them, left and right
// move along them, and OK opens one. With none, nothing in it takes focus: focus stays on the card behind and
// the dialog takes every key itself, up and down reading a long description. It sits on document.body, outside
// the rows of the detail screen.
const SeerrEpisodeDialog = ({episode, airDate, hideOverview, onSelectPerson, initialPersonId = '', onClose}) => {
	const textRef = useRef(null);
	const stars = episode._guestStars || [];
	const focusable = Boolean(onSelectPerson) && stars.some((star) => star.id);
	const focusableRef = useRef(focusable);
	focusableRef.current = focusable;

	const handleOpenPerson = useCallback((ev) => {
		const {personId, personName} = ev.currentTarget.dataset;
		if (personId) onSelectPerson(personId, personName);
	}, [onSelectPerson]);

	useEffect(() => {
		registerSeerrEpisodeDialog(onClose);
		const handleKeyDown = (ev) => {
			if (ev.keyCode === KEYS.UP || ev.keyCode === KEYS.DOWN) {
				const el = textRef.current;
				if (el) el.scrollTop += ev.keyCode === KEYS.DOWN ? SCROLL_STEP : -SCROLL_STEP;
			} else if (focusableRef.current && (ev.keyCode === KEYS.LEFT || ev.keyCode === KEYS.RIGHT || ev.keyCode === KEYS.ENTER)) {
				// The guest stars take these.
				return;
			}
			ev.preventDefault();
			ev.stopPropagation();
		};
		window.addEventListener('keydown', handleKeyDown, true);
		// Asked twice, since a screen that opens the part holding the popup moves focus about on its own a moment after
		// it, and the second ask is the one that is left standing.
		const focusIn = () => Spotlight.focus('seerr-episode-dialog');
		const moveIn = focusableRef.current ? [window.setTimeout(focusIn, 50), window.setTimeout(focusIn, 250)] : [];
		return () => {
			window.removeEventListener('keydown', handleKeyDown, true);
			moveIn.forEach((timer) => window.clearTimeout(timer));
			unregisterSeerrEpisodeDialog(onClose);
		};
	}, [onClose]);

	const chips = chipsOf(episode, airDate);
	const credits = creditsOf(episode);
	const season = episode.ParentIndexNumber;
	const code = season != null && episode.IndexNumber != null ? `S${season}E${episode.IndexNumber}` : '';
	const description = hideOverview ? '' : episode.Overview || $L('No description available.');
	const still = episode._externalPosterUrl;

	return createPortal(
		<div className={css.dialogBackdrop} onClick={onClose}>
			<ModalContainer className={css.dialogPanel} spotlightId="seerr-episode-dialog" onClick={stopClick}>
				{/* The still again, large and soft, behind everything, so each episode has its own colors. */}
				{still && <div className={css.dialogArt} style={{backgroundImage: `url(${still})`}} />}
				<div className={css.dialogShade} />
				<div className={css.dialogContent}>
					<div className={css.dialogHead}>
						{code && <span className={css.dialogCode}>{code}</span>}
						{episode.SeriesName && <span className={css.dialogSeries}>{episode.SeriesName}</span>}
					</div>
					<h2 className={css.dialogTitle}>{episode.Name || `${$L('Episode')} ${episode.IndexNumber}`}</h2>
					<div className={css.dialogBody}>
						{still && (
							<div className={css.dialogStill}>
								<img src={still} alt="" />
							</div>
						)}
						<div className={css.dialogInfo}>
							{chips.length > 0 && (
								<div className={css.dialogChips}>
									{chips.map((chip) => (
										<span key={chip.id} className={chip.accent ? `${css.dialogChip} ${css.dialogChipAccent}` : css.dialogChip}>
											<Icon name={chip.icon} />
											{chip.text}
										</span>
									))}
								</div>
							)}
							{description && <div className={css.dialogText} ref={textRef}>{description}</div>}
							{stars.length > 0 && <div className={css.castHeading}>{$L('Guest stars')}</div>}
							{stars.length > 0 && (
								<div className={css.dialogCast} onFocus={keepFocusInView}>
									{stars.map((star, index) => <Star key={star.id || star.name} star={star} first={initialPersonId ? star.id === initialPersonId : index === 0} onOpen={handleOpenPerson} />)}
								</div>
							)}
							{credits.length > 0 && (
								<div className={css.dialogCredits}>
									{credits.map(([name, value]) => (
										<div key={name} className={css.credit}>
											<span className={css.creditName}>{name}</span>
											<span className={css.creditValue}>{value}</span>
										</div>
									))}
								</div>
							)}
						</div>
					</div>
					<div className={css.dialogHint}>
						<span className={css.dialogKey}><Icon name="back" /></span>
						{$L('Press Back to close')}
					</div>
				</div>
			</ModalContainer>
		</div>,
		document.body
	);
};

export default SeerrEpisodeDialog;
