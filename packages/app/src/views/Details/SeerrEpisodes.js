import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import $L from '@enact/i18n/$L';
import Spotlight from '@enact/spotlight';

import DetailsTabBar from '../../components/DetailsTabBar';
import {appLocale} from '../../utils/appLocale';
import {channelKeyStep} from '../../utils/channelKeys';
import {keepEpisodeDialog, takeEpisodeDialog} from '../../utils/episodeDialogReturn';
import {formatDuration} from '../../utils/helpers';
import {KEYS} from '../../utils/keys';
import {hidesMediaDescription} from './detailsMedia';
import {SpottableDiv} from './detailsSpottables';
import SeerrEpisodeDialog from './SeerrEpisodeDialog';
import {effectiveSeason, groupEpisodesBySeason, seasonOptions} from './nouveau/nouveauSeasons';
import NouveauRail from './nouveau/sections/NouveauRail';

import css from './SeerrEpisodes.module.less';

const CARD_WIDTH = 340;
const CARD_GAP = 24;

// What a viewer is told about when an episode airs, in the app's language.
const airDateText = (episode) => {
	if (!episode.PremiereDate) return '';
	const date = new Date(episode.PremiereDate);
	if (Number.isNaN(date.getTime())) return '';
	return date.toLocaleDateString(appLocale(), {year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC'});
};

// The card's heading, with the season in it since the cards of a season all start again at one: S2E3: Name.
const cardTitle = (episode) => {
	const number = episode.IndexNumber == null ? '' : `${episode.ParentIndexNumber == null ? '' : `S${episode.ParentIndexNumber}`}E${episode.IndexNumber}`;
	if (!number) return episode.Name || '';
	return episode.Name ? `${number}: ${episode.Name}` : number;
};

// A Seerr series' episodes, read only: season tabs over a row of cards showing the still, the number
// and name, when it airs and the description. Every style that has no row of its own for this draws
// it, so what an episode says reads the same in each.
const SeerrEpisodes = ({seasons = [], episodes = [], navbarPosition, spotlightId = 'seerr-episodes', onNavigateUp, settings, firstSpotlightId, onSelectPerson}) => {
	const [picked, setPicked] = useState(null);
	// The episode opened with OK, in full. Focus stays on its card while it is up.
	const [opened, setOpened] = useState(null);
	// The star in focus when the dialog is opened again on the way back from their page.
	const [restoredPerson, setRestoredPerson] = useState('');
	const rootRef = useRef(null);

	const groups = useMemo(() => groupEpisodesBySeason(episodes), [episodes]);
	const numbers = useMemo(() => [...groups.keys()], [groups]);
	const tabs = useMemo(() => seasonOptions(groups, seasons), [groups, seasons]);
	// Specials sort first, but a viewer opens a show on its first real season.
	const active = effectiveSeason(numbers, picked, numbers.find((number) => number > 0));
	// Held steady across renders so the rail does not rebuild its cards every time.
	const shown = useMemo(() => groups.get(active) || [], [groups, active]);

	const handleActivate = useCallback((id) => {
		setPicked(Number(id));
	}, []);

	// Channel up and down step through the seasons from the season bar or from the episodes. The episodes of a season are
	// drawn anew, so focus is put back where it was: on the episodes, the first one, or on the bar, the season in it.
	const handleChannelKey = useCallback((ev) => {
		const step = channelKeyStep(ev);
		if (!step || numbers.length < 2) return;
		ev.preventDefault();
		ev.stopPropagation();
		const at = numbers.indexOf(active);
		const next = numbers[Math.min(numbers.length - 1, Math.max(0, at + step))];
		if (next === active) return;
		const inEpisodes = Boolean(ev.target.closest && ev.target.closest('[data-episode-id]'));
		setPicked(next);
		window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
			const root = rootRef.current;
			if (!root) return;
			const target = inEpisodes ? root.querySelector('[data-episode-id]') : root.querySelector('[data-enter-from-above="true"]');
			if (target) Spotlight.focus(target);
		}));
	}, [numbers, active]);
	const handleOpen = useCallback((ev) => {
		const id = ev.currentTarget.dataset.episodeId;
		setOpened(shown.find((episode) => episode.Id === id) || null);
	}, [shown]);
	// Back from a guest star's page comes to the dialog it was opened from, on the same season and episode.
	useEffect(() => {
		const back = takeEpisodeDialog(episodes);
		if (!back) return;
		if (Number.isInteger(back.season)) setPicked(back.season);
		setRestoredPerson(back.personId || '');
		setOpened(back.episode);
	}, [episodes]);
	const handleClose = useCallback(() => {
		const closing = opened;
		setOpened(null);
		setRestoredPerson('');
		// The card it was opened from takes focus back.
		window.requestAnimationFrame(() => {
			const card = closing && rootRef.current && rootRef.current.querySelector(`[data-episode-id="${closing.Id}"]`);
			if (card) Spotlight.focus(card);
		});
	}, [opened]);
	// A guest star's page, kept with where the dialog stood so it can be brought back.
	const handleSelectPerson = useCallback((personId, personName) => {
		if (opened) keepEpisodeDialog({episodeId: opened.Id, season: active, personId});
		onSelectPerson?.(personId, personName);
	}, [opened, active, onSelectPerson]);

	// The rail keeps up and down for itself and hands them back, so leaving it is decided here: up to
	// the season tabs when there are some, and otherwise wherever the page puts focus.
	const hasTabs = tabs.length > 1;
	const handleUp = useCallback(() => {
		if (onNavigateUp) onNavigateUp();
		else if (!hasTabs || !Spotlight.focus(`${spotlightId}-season`)) Spotlight.move('up');
	}, [onNavigateUp, hasTabs, spotlightId]);
	const handleDown = useCallback(() => Spotlight.move('down'), []);

	// Down from the season bar goes to the episodes. The Classic page moves between its sections on
	// up and down, and would otherwise take this press and step past the episodes to the next one. The
	// card is found in the page rather than asked of the rail's container, which after a change of
	// season still remembers a card that is gone and refuses.
	const handleTabsKeyDown = useCallback((ev) => {
		if (ev.keyCode !== KEYS.DOWN) return;
		const first = rootRef.current && rootRef.current.querySelector('[data-episode-id]');
		if (first && Spotlight.focus(first)) {
			ev.preventDefault();
			ev.stopPropagation();
		}
	}, []);

	const renderEpisode = useCallback((episode, index) => {
		const meta = [
			airDateText(episode),
			episode.RunTimeTicks ? formatDuration(episode.RunTimeTicks) : '',
			episode.CommunityRating ? `\u2605 ${Number(episode.CommunityRating).toFixed(1)}` : ''
		].filter(Boolean).join(' \u00b7 ');
		// An episode that has not aired has no description yet, which is nothing to point out on every card.
		const unaired = episode.PremiereDate && new Date(episode.PremiereDate).getTime() > Date.now();
		return (
			// The first card is where the row is entered from the sections above and below it.
			<SpottableDiv
				className={css.card}
				style={{width: `${CARD_WIDTH}px`}}
				spotlightId={index === 0 ? firstSpotlightId : undefined}
				data-current={index === 0 ? 'true' : undefined}
				data-episode-id={episode.Id}
				onClick={handleOpen}
			>
				<div className={css.still}>
					{episode._externalPosterUrl ? <img src={episode._externalPosterUrl} alt="" /> : <div className={css.noStill} />}
				</div>
				<div className={css.title}>{cardTitle(episode)}</div>
				{meta && <div className={css.meta}>{meta}</div>}
				{!hidesMediaDescription(episode, settings) && (episode.Overview || !unaired) && (
					<div className={css.overview}>{episode.Overview || $L('No description available.')}</div>
				)}
			</SpottableDiv>
		);
	}, [handleOpen, firstSpotlightId, settings]);

	// The episodes arrive a season at a time, and whoever draws this waits for the first.
	if (!shown.length) return null;

	return (
		<div className={css.episodes} ref={rootRef} onKeyDown={handleChannelKey}>
			{hasTabs && (
				<div onKeyDown={handleTabsKeyDown}>
					<DetailsTabBar
						tabs={tabs}
						activeId={String(active)}
						expanded={false}
						onActivate={handleActivate}
						spotlightId={`${spotlightId}-seasons`}
						activeSpotlightId={`${spotlightId}-season`}
						className={css.seasonBar}
						entryFromAbove
					/>
				</div>
			)}
			{/* Keyed by season, so a new season opens at its first episode rather than where the last was scrolled to. */}
			<NouveauRail
				key={active}
				items={shown}
				gap={CARD_GAP}
				spotlightId={`${spotlightId}-rail`}
				navbarPosition={navbarPosition}
				onNavigateUp={handleUp}
				onNavigateDown={handleDown}
				renderItem={renderEpisode}
			/>
			{opened && (
				<SeerrEpisodeDialog
					episode={opened}
					airDate={airDateText(opened)}
					hideOverview={hidesMediaDescription(opened, settings)}
					onSelectPerson={onSelectPerson ? handleSelectPerson : undefined}
					initialPersonId={restoredPerson}
					onClose={handleClose}
				/>
			)}
		</div>
	);
};

export default SeerrEpisodes;
