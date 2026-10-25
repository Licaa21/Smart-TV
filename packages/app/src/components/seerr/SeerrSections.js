import {Fragment, memo, useCallback, useMemo, useRef, useState, useEffect} from 'react';
import $L from '@enact/i18n/$L';
import {createPortal} from 'react-dom';
import Spotlight from '@enact/spotlight';

import seerrApi from '../../services/seerrApi';
import {buildMediaFacts} from '../../utils/seerrMediaFacts';
import {LastFocusedContainer, SpottableDiv, safeFocus} from './seerrFocus';
import {ModalContainer} from '../../utils/spotlightContainers';
import {KEYS} from '../../utils/keys';
import {registerSeerrTagsDialog, unregisterSeerrTagsDialog} from '../../utils/seerrTagsDialogBack';

import css from './SeerrSections.module.less';

// The parts of a title that only Seerr knows: what it is filed under, the production facts the
// library has no field for, and the collection it belongs to. Shared by both detail styles so
// the Seerr block reads the same whichever one the viewer picked.

const Chip = memo(({entry, onSelect}) => {
	const handleClick = useCallback(() => onSelect(entry), [entry, onSelect]);
	return <SpottableDiv className={css.chip} onClick={handleClick}>{entry.name}</SpottableDiv>;
});

export const seerrChipCount = (details) => (
	(details?.genres?.length || 0) + (details?.networks?.length || 0) + (details?.keywords?.length || 0)
);

export const hasSeerrChips = (details) => seerrChipCount(details) > 0;

const TagsSection = memo(({title, entries, onSelect, prefix}) => {
	if (!entries?.length) return null;
	return (
		<div className={css.tagsSection}>
			<h3 className={css.tagsSectionTitle}>{title}</h3>
			<div className={css.chipList}>
				{entries.map((entry) => (
					<Chip key={`${prefix}-${entry.id}`} entry={entry} onSelect={onSelect} />
				))}
			</div>
		</div>
	);
});

// Genres, networks and keywords each lead into Seerr browse rather than the library, which is
// why they stay separate from the library's own genres even though they look alike.
const SeerrTagsDialog = memo(({details, mediaType, seerrNav, onClose}) => {
	const handleGenre = useCallback((genre) => {
		onClose();
		seerrNav?.onSelectGenre?.(genre.id, genre.name, mediaType);
	}, [onClose, seerrNav, mediaType]);

	const handleNetwork = useCallback((network) => {
		onClose();
		seerrNav?.onSelectNetwork?.(network.id, network.name);
	}, [onClose, seerrNav]);

	const handleKeyword = useCallback((keyword) => {
		onClose();
		seerrNav?.onSelectKeyword?.(keyword, mediaType);
	}, [onClose, seerrNav, mediaType]);

	useEffect(() => {
		const t = setTimeout(() => Spotlight.focus('seerr-tags-close'), 100);
		registerSeerrTagsDialog(onClose);
		return () => {
			clearTimeout(t);
			unregisterSeerrTagsDialog(onClose);
		};
	}, [onClose]);

	const sectionsRef = useRef(null);

	// The way out sits off to the side of the chips rather than above any one of them,
	// so pressing down on it is pointed at the first chip rather than left to geometry.
	const handleCloseKeyDown = useCallback((ev) => {
		if (ev.keyCode !== KEYS.DOWN) return;
		const first = sectionsRef.current?.querySelector('.spottable');
		if (!first) return;
		ev.preventDefault();
		ev.stopPropagation();
		Spotlight.focus(first);
	}, []);

	// Sits on document.body rather than among the detail screen's rows, which move focus
	// from row to row on a 5-way press and would carry it straight out of the dialog.
	const dialog = (
		<div className={css.tagsBackdrop} onClick={onClose}>
			<ModalContainer className={css.tagsPanel} spotlightId="seerr-tags-dialog">
				<div className={css.tagsHeader}>
					<h2 className={css.tagsTitle}>{$L('Genres and Tags')}</h2>
					<SpottableDiv
						className={`${css.chip} ${css.tagsClose}`}
						spotlightId="seerr-tags-close"
						onClick={onClose}
						onKeyDown={handleCloseKeyDown}
					>
						{$L('Close')}
					</SpottableDiv>
				</div>
				<div className={css.tagsSections} ref={sectionsRef}>
					{/* One container across all three, so 5-way crosses from a genre to a
					    network the same way it moves between two genres. */}
					<LastFocusedContainer>
						<TagsSection title={$L('Genres')} entries={details?.genres} onSelect={handleGenre} prefix="genre" />
						<TagsSection title={$L('Networks')} entries={details?.networks} onSelect={handleNetwork} prefix="network" />
						<TagsSection title={$L('Tags')} entries={details?.keywords} onSelect={handleKeyword} prefix="keyword" />
					</LastFocusedContainer>
				</div>
			</ModalContainer>
		</div>
	);

	return typeof document !== 'undefined' && document.body ? createPortal(dialog, document.body) : dialog;
});

// One chip rather than a row of them. A title can be filed under dozens of
// things, and listing them all here leaves no room for anything else.
export const SeerrChips = memo(({details, mediaType, seerrNav}) => {
	const [open, setOpen] = useState(false);
	const handleOpen = useCallback(() => setOpen(true), []);
	// The dialog is closed off to 5-way, so focus has to be handed back by name once
	// it has gone.
	const handleClose = useCallback(() => {
		setOpen(false);
		setTimeout(() => safeFocus('seerr-tags-chip'), 100);
	}, []);

	if (!hasSeerrChips(details)) return null;

	return (
		<>
			<SpottableDiv className={css.chip} spotlightId="seerr-tags-chip" onClick={handleOpen}>
				{$L('Genres and Tags')}
			</SpottableDiv>
			{open && (
				<SeerrTagsDialog details={details} mediaType={mediaType} seerrNav={seerrNav} onClose={handleClose} />
			)}
		</>
	);
});

const FACTS_PER_LINE = 3;

export const SeerrFacts = memo(({details, mediaType}) => {
	const lines = useMemo(() => {
		const facts = buildMediaFacts(details, mediaType);
		const grouped = [];
		for (let i = 0; i < facts.length; i += FACTS_PER_LINE) {
			grouped.push(facts.slice(i, i + FACTS_PER_LINE));
		}
		return grouped;
	}, [details, mediaType]);

	if (lines.length === 0) return null;

	return (
		<SpottableDiv className={css.facts}>
			{lines.map((line, lineIndex) => (
				<div key={line[0].label} className={css.factLine}>
					{/* Every line is filled out to three, so a short last line keeps the
					    column widths the lines above it set. */}
					{Array.from({length: FACTS_PER_LINE}, (_, column) => (
						<Fragment key={line[column] ? line[column].label : `pad-${lineIndex}-${column}`}>
							{column > 0 && <div className={css.factSeparator} />}
							<div className={css.fact}>
								{line[column] && (
									<>
										<span className={css.factLabel}>{line[column].label}</span>
										<span className={css.factValue}>{line[column].value}</span>
									</>
								)}
							</div>
						</Fragment>
					))}
				</div>
			))}
		</SpottableDiv>
	);
});

export const SeerrStreaming = memo(({providers}) => {
	if (!providers?.length) return null;

	return (
		<div className={css.streaming}>
			<span className={css.factLabel}>{$L('Streaming on')}</span>
			<div className={css.streamingProviders}>
				{providers.map((provider) => (
					<div key={provider.id} className={css.streamingProvider}>
						<img className={css.streamingLogo} src={seerrApi.getImageUrl(provider.logoPath, 'w92')} alt="" />
						<span className={css.streamingName}>{provider.name}</span>
					</div>
				))}
			</div>
		</div>
	);
});

export const SeerrCollectionBanner = memo(({collection, onOpen}) => {
	const handleClick = useCallback(() => {
		if (collection?.id != null) onOpen?.(collection.id);
	}, [collection, onOpen]);

	if (!collection || !onOpen) return null;

	const backdrop = collection.backdropPath
		? {backgroundImage: `url(${seerrApi.getImageUrl(collection.backdropPath, 'w780')})`}
		: undefined;

	return (
		<SpottableDiv className={css.collectionBanner} onClick={handleClick} style={backdrop}>
			<div className={css.collectionBannerScrim} />
			<svg className={css.collectionBannerIcon} viewBox="0 0 24 24" aria-hidden="true">
				<path fill="currentColor" d="M17 3H7a2 2 0 0 0-2 2v16l7-3 7 3V5a2 2 0 0 0-2-2m0 15.1-5-2.15-5 2.15V5h10z" />
			</svg>
			<span className={css.collectionBannerText}>
				{$L('Part of {name}').replace('{name}', collection.name || '')}
			</span>
			<span className={css.collectionBannerCta}>{$L('View Collection')}</span>
			<svg className={css.collectionBannerChevron} viewBox="0 0 24 24" aria-hidden="true">
				<path fill="currentColor" d="M9.4 6 8 7.4l4.6 4.6L8 16.6 9.4 18l6-6z" />
			</svg>
		</SpottableDiv>
	);
});
