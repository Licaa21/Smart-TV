import $L from '@enact/i18n/$L';

import {useSettings} from '../../../../context/SettingsContext';
import {transcodeReasonLabel} from '../../../../utils/directPlayReasons';
import {SpottableDiv} from '../../detailsSpottables';
import useDetailPlaybackInfo from '../../useDetailPlaybackInfo';

import css from './NouveauDetailsFooter.module.less';

// Whether the server would hand this file over as it is, and when it wouldn't, the reasons it gave.
const NouveauDirectPlay = ({api, item, itemId, serverType, mediaSourceId, audioStreamIndex, subtitleStreamIndex}) => {
	const {settings} = useSettings();
	const {status, result, retry} = useDetailPlaybackInfo({
		api, item, itemId, serverType, mediaSourceId, audioStreamIndex, subtitleStreamIndex, maxBitrate: settings.maxBitrate
	});

	if (status === 'empty') return null;

	if (status === 'loading') {
		return <div className={css.capabilityPending}>{$L('Checking Direct Play capability...')}</div>;
	}

	// A blank line reads as still loading and gives the remote nothing to select, so the failure
	// says so and carries the way to try again.
	if (status === 'failed') {
		return (
			<div className={css.capabilityRow}>
				<span className={css.capabilityPending}>{$L('Failed to load')}</span>
				<SpottableDiv className={css.capabilityRetry} onClick={retry}>{$L('Retry')}</SpottableDiv>
			</div>
		);
	}

	const direct = result.supportsDirectPlay;
	const reasons = direct ? [] : result.transcodeReasons;

	return (
		<>
			<div className={css.capabilityRow}>
				<span className={`${css.capabilityDot} ${direct ? css.capabilityYes : css.capabilityNo}`} />
				<span className={css.capabilityLabel}>{$L('Direct Play')}</span>
			</div>
			{reasons.length > 0 && (
				<div className={css.capabilityReasons}>{reasons.map(transcodeReasonLabel).join(' · ')}</div>
			)}
		</>
	);
};

export default NouveauDirectPlay;
