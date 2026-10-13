import {useCallback, useMemo} from 'react';
import $L from '@enact/i18n/$L';

import {useSettings} from '../../context/SettingsContext';
import {ModalContainer} from '../../utils/spotlightContainers';
import TrackOptionRow, {TrackDivider} from '../../components/TrackOptionRow';
import useDetailPlaybackInfo from './useDetailPlaybackInfo';
import {buildPlaybackInfo} from './playbackInfoRows';

import css from './Details.module.less';

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

	const info = useMemo(
		() => (result ? buildPlaybackInfo(result, {audioStreamIndex, subtitleStreamIndex, settings}) : null),
		[result, audioStreamIndex, subtitleStreamIndex, settings]
	);

	return (
		<div className={`${css.trackModal} ${css.infoModal}`} onClick={onClose}>
			<ModalContainer className={`${css.trackModalPanel} ${css.infoPanel}`} onClick={stopPropagation} data-modal="playbackInfo" spotlightId="playbackInfo-modal">
				<h2 className={css.trackModalTitle}>{$L('Playback Info')}</h2>
				<div className={css.infoBody}>
					<div className={css.infoColumn}>
						{status === 'loading' && <div className={css.infoLine}>{$L('Checking Direct Play capability...')}</div>}
						{status === 'empty' && <div className={css.infoLine}>{$L('The server gave no playback information.')}</div>}
						{status === 'failed' && <div className={css.infoLine}>{$L('Failed to load')}</div>}
						{info && (
							<>
								<div className={`${css.infoVerdict} ${css[`info_${info.method}`]}`}>
									<span className={css.infoDot} />
									<div>
										<div className={css.infoMethod}>{info.title}</div>
										<div className={css.infoSummary}>{info.summary}</div>
									</div>
								</div>
								{info.reasons.length > 0 && <div className={css.infoGroupTitle}>{$L('Why')}</div>}
								{info.reasons.map((reason, i) => (
									<div key={i}>
										<div className={css.infoLine}>{reason.description}</div>
										{reason.hint && <div className={css.infoHint}>{reason.hint}</div>}
									</div>
								))}
							</>
						)}
					</div>
					{info && (
						<div className={css.infoColumn}>
							{info.sections.map((section) => (
								<div key={section.title} className={css.infoCard}>
									<div className={css.infoGroupTitle}>{section.title}</div>
									{section.lines.map((line, i) => <div key={i} className={css.infoLine}>{line}</div>)}
								</div>
							))}
						</div>
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
