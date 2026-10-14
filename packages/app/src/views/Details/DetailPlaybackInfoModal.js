import {useCallback, useEffect, useMemo, useState} from 'react';
import $L from '@enact/i18n/$L';

import {useSettings} from '../../context/SettingsContext';
import {isTizen} from '../../platform';
import {getAudioStartPlan} from '../../services/playback';
import {iconViewBox} from '../../components/icons/iconViewBox';
import {ModalContainer} from '../../utils/spotlightContainers';
import TrackOptionRow, {TrackDivider} from '../../components/TrackOptionRow';
import {DETAIL_ICON_PATHS} from './detailIcons';
import useDetailPlaybackInfo from './useDetailPlaybackInfo';
import {buildPlaybackInfo} from './playbackInfoRows';

import css from './Details.module.less';

// A card's picture, by what it is about.
const SECTION_ICONS = {
	file: DETAIL_ICON_PATHS.version,
	video: DETAIL_ICON_PATHS.trailer,
	audio: DETAIL_ICON_PATHS.audio,
	subtitle: DETAIL_ICON_PATHS.subtitle
};

const CardHead = ({path, title}) => (
	<div className={css.infoCardHead}>
		<svg className={css.infoCardIcon} viewBox={iconViewBox(path)} fill="currentColor" aria-hidden="true">
			<path d={path} />
		</svg>
		<span className={css.infoGroupTitle}>{title}</span>
	</div>
);

// How the server would play the selected file with the selected tracks, behind the Playback Info
// button. It is only mounted while open, so the server is asked once per press and never for a
// screen where the button isn't used.
const DetailPlaybackInfoModal = ({api, item, mediaSource, audioStreamIndex, subtitleStreamIndex, onClose}) => {
	const {settings} = useSettings();
	const {status, result, retry} = useDetailPlaybackInfo({
		api,
		itemId: item.Id,
		serverType: item._serverType,
		mediaSourceId: mediaSource?.Id,
		audioStreamIndex,
		subtitleStreamIndex,
		maxBitrate: settings.maxBitrate
	});

	const stopPropagation = useCallback((e) => e.stopPropagation(), []);

	// What the app would do with the audio pick, which the server's own answer knows nothing about. Only the
	// Tizen player opens a file on one track, and Force Direct Play leaves the server out of it.
	const [audioStart, setAudioStart] = useState(null);
	useEffect(() => {
		let cancelled = false;
		setAudioStart(null);
		if (!result?.supportsDirectPlay || !isTizen() || settings.forceDirectPlay || audioStreamIndex == null) return undefined;
		getAudioStartPlan(mediaSource, audioStreamIndex)
			.then((plan) => { if (!cancelled) setAudioStart(plan); })
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	}, [result, mediaSource, audioStreamIndex, settings.forceDirectPlay]);

	const info = useMemo(
		() => (result ? buildPlaybackInfo(result, {audioStreamIndex, subtitleStreamIndex, settings, audioStart, tizen: isTizen()}) : null),
		[result, audioStreamIndex, subtitleStreamIndex, settings, audioStart]
	);

	const section = (id) => info?.sections.find((candidate) => candidate.id === id);
	const file = section('file');
	// With both, the reasons and the notes share a row and stack inside it, since side by side they would be too tall.
	const sideBySide = Boolean(info && info.reasons.length > 0 && info.notes.length > 0);
	// Video, audio and subtitle share a row, so one with nothing to say leaves the others wider.
	const tracks = ['video', 'audio', 'subtitle'].map(section).filter(Boolean);

	return (
		<div className={`${css.trackModal} ${css.infoModal}`} onClick={onClose}>
			<ModalContainer className={`${css.trackModalPanel} ${css.infoPanel}`} onClick={stopPropagation} data-modal="playbackInfo" spotlightId="playbackInfo-modal">
				<h2 className={css.trackModalTitle}>{$L('Playback Info')}</h2>
				<div className={css.infoBody}>
					{status === 'loading' && <div className={css.infoLine}>{$L('Checking Direct Play capability...')}</div>}
					{status === 'empty' && <div className={css.infoLine}>{$L('The server gave no playback information.')}</div>}
					{status === 'failed' && <div className={css.infoLine}>{$L('Failed to load')}</div>}
					{info && (
						<>
							<div className={`${css.infoVerdict} ${css[`info_${info.method}`]}`}>
								<span className={css.infoDot} />
								<div className={css.infoVerdictText}>
									<div className={css.infoMethod}>{info.title}</div>
									<div className={css.infoSummary}>{info.summary}</div>
								</div>
								{file && (
									<div className={css.infoChips}>
										{file.lines.map((line, i) => <span key={i} className={css.infoChip}>{line}</span>)}
									</div>
								)}
							</div>
							{(info.reasons.length > 0 || info.notes.length > 0) && (
								<div className={css.infoCols}>
									{info.reasons.length > 0 && (
										<div className={css.infoCard}>
											<CardHead path={DETAIL_ICON_PATHS.info} title={$L('Why')} />
											<div className={sideBySide ? css.infoStack : css.infoReasons}>
												{info.reasons.map((reason, i) => (
													<div key={i} className={css.infoReason}>
														<div className={css.infoLine}>{reason.description}</div>
														{reason.hint && <div className={css.infoHint}>{reason.hint}</div>}
													</div>
												))}
											</div>
										</div>
									)}
									{info.notes.length > 0 && (
										<div className={css.infoCard}>
											<CardHead path={DETAIL_ICON_PATHS.admin} title={$L('Settings that apply')} />
											<div className={sideBySide ? css.infoStack : css.infoReasons}>
												{info.notes.map((note) => (
													<div key={note.id} className={`${css.infoReason} ${css[`infoNote_${note.tone}`]}`}>
														<div className={css.infoNoteTitle}>{note.title}</div>
														<div className={css.infoHint}>{note.text}</div>
													</div>
												))}
											</div>
										</div>
									)}
								</div>
							)}
							{tracks.length > 0 && (
								<div className={css.infoCols}>
									{tracks.map((track) => (
										<div key={track.id} className={css.infoCard}>
											<CardHead path={SECTION_ICONS[track.id]} title={track.title} />
											{track.lines.map((line, i) => <div key={i} className={css.infoLine}>{line}</div>)}
										</div>
									))}
								</div>
							)}
						</>
					)}
				</div>
				<div className={css.trackList}>
					<TrackDivider />
					{(status === 'failed' || status === 'empty') && <TrackOptionRow label={$L('Retry')} onClick={retry} />}
					<TrackOptionRow label={$L('Close')} dimmed onClick={onClose} />
				</div>
			</ModalContainer>
		</div>
	);
};

export default DetailPlaybackInfoModal;
