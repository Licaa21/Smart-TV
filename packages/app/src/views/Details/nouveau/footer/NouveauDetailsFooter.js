import {useCallback} from 'react';
import $L from '@enact/i18n/$L';

import {SpottableDiv} from '../../detailsSpottables';
import {SeerrChips, SeerrFacts} from '../../../../components/seerr/SeerrSections';
import NouveauDirectPlay from './NouveauDirectPlay';
import {fileName, fileSizeLine, trackRows, videoLines} from '../nouveauFooterFields';

import css from './NouveauDetailsFooter.module.less';

const Group = ({title, children}) => (
	<div className={css.group}>
		<h3 className={css.groupTitle}>{title}</h3>
		{children}
	</div>
);

const Tracks = ({rows}) => (
	<>
		{rows.map((row, index) => (
			<div key={index} className={`${css.track} ${row.active ? css.trackActive : ''}`}>
				<span className={css.trackDot} />
				<span>
					<span className={css.trackLabel}>{row.label}</span>
					{row.detail && <div className={css.trackDetail}>{row.detail}</div>}
				</span>
			</div>
		))}
	</>
);

// What the page closes on: who made the title, and what the file behind it actually is. Every group
// is left out rather than shown empty, since a server is silent about different things per file.
// Studios, the Seerr pieces and the media info each have a switch, and a hidden one reads as empty.
// With nothing left the footer draws nothing, and the focus walk steps past its stop.
const NouveauDetailsFooter = ({
	item, showsSection, mediaSource, effectiveApi, selectedAudioIndex, selectedSubtitleIndex,
	seerr, seerrNav, onSelectStudio
}) => {
	const fileSource = showsSection('mediaInfo') ? mediaSource : null;
	const streams = fileSource?.MediaStreams || [];
	const video = streams.find((stream) => stream.Type === 'Video');
	const audio = streams.filter((stream) => stream.Type === 'Audio');
	const subtitles = streams.filter((stream) => stream.Type === 'Subtitle');

	// The stored choice is a place in these lists, while a track knows itself by its own index, so
	// the one is turned into the other before anything is marked as being in use.
	const activeAudio = audio[selectedAudioIndex]?.Index;
	const activeSubtitle = selectedSubtitleIndex >= 0 ? subtitles[selectedSubtitleIndex]?.Index : undefined;

	const studios = showsSection('studios') ? (item.Studios || []).map((studio) => studio?.Name).filter(Boolean) : [];
	const name = fileName(fileSource);
	const sizeLine = fileSizeLine(fileSource);
	const videoDetails = videoLines(video);
	const showsChips = Boolean(seerr?.pieces?.chips);
	const showsFacts = Boolean(seerr?.pieces?.facts);

	const openStudio = useCallback((ev) => {
		const studio = ev.currentTarget.dataset.studioName;
		if (studio) onSelectStudio?.(studio);
	}, [onSelectStudio]);

	if (!studios.length && !showsChips && !showsFacts && !fileSource) return null;

	return (
		<div className={css.footer}>
			<h2 className={css.title}>{$L('Details')}</h2>
			<div className={css.groups}>
				{studios.length > 0 && (
					<Group title={$L('Studios')}>
						<div className={css.studios}>
							{studios.map((studio) => (
								<SpottableDiv
									key={studio}
									className={css.studio}
									data-studio-name={studio}
									onClick={openStudio}
								>
									{studio}
								</SpottableDiv>
							))}
						</div>
					</Group>
				)}
				{/* Both carry their own label, so neither is wrapped in a titled group. A library
				    item can have this as readily as a Seerr only one. */}
				{showsChips && <SeerrChips details={seerr.details} mediaType={seerr.mediaType} seerrNav={seerrNav} />}
				{showsFacts && <SeerrFacts details={seerr.details} mediaType={seerr.mediaType} />}
				{fileSource && (
					<Group title={$L('File Information')}>
						{name && <div className={css.fileName}>{name}</div>}
						{sizeLine && <div className={css.fileMeta}>{sizeLine}</div>}
						<NouveauDirectPlay
							api={effectiveApi}
							itemId={item.Id}
							serverType={item._serverType}
							mediaSourceId={fileSource.Id}
							audioStreamIndex={activeAudio}
							subtitleStreamIndex={activeSubtitle}
						/>
					</Group>
				)}
				{videoDetails.length > 0 && (
					<Group title={$L('Video')}>
						{videoDetails.map((line) => <div key={line} className={css.line}>{line}</div>)}
					</Group>
				)}
				{audio.length > 0 && (
					<Group title={$L('Audio')}>
						<Tracks rows={trackRows(audio, activeAudio)} />
					</Group>
				)}
				{subtitles.length > 0 && (
					<Group title={$L('Subtitles')}>
						<Tracks rows={trackRows(subtitles, activeSubtitle, {includeForced: true})} />
					</Group>
				)}
			</div>
		</div>
	);
};

export default NouveauDetailsFooter;
