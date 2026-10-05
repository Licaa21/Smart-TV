import {useEffect} from 'react';
import $L from '@enact/i18n/$L';
import Button from '@enact/sandstone/Button';
import Spotlight from '@enact/spotlight';

import css from './LiveFailedCard.module.less';

const RETRY_ID = 'live-retry-btn';

// Stays up until the viewer retries, tunes elsewhere or leaves, and Retry takes
// focus whenever it shows so OK retries.
const LiveFailedCard = ({channelName, onRetry}) => {
	useEffect(() => {
		window.requestAnimationFrame(() => Spotlight.focus(RETRY_ID));
	}, []);

	return (
		<div className={css.overlay}>
			<div className={css.card}>
				<p className={css.message}>{$L('Failed to play {name}').replace('{name}', channelName || '')}</p>
				<Button spotlightId={RETRY_ID} onClick={onRetry}>{$L('Retry')}</Button>
			</div>
		</div>
	);
};

export default LiveFailedCard;
