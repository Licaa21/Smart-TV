import {useEffect, useState} from 'react';
import $L from '@enact/i18n/$L';

import css from './SubtitleFetchIndicator.module.less';

// A subtitle the server answers right away shouldn't flash the indicator.
export const useSubtitleFetchShown = (loading) => {
	const [shown, setShown] = useState(false);
	useEffect(() => {
		if (!loading) {
			setShown(false);
			return undefined;
		}
		const timer = setTimeout(() => setShown(true), 500);
		return () => clearTimeout(timer);
	}, [loading]);
	return shown;
};

// Sits above the seek bar while the controls are up. Once they hide it moves to the corner
// on its own backing, since the wait can outlast the controls by minutes.
const SubtitleFetchIndicator = ({standalone}) => (
	<div className={standalone ? `${css.indicator} ${css.standalone}` : css.indicator}>
		<span className={css.spinner} />
		<span>{$L('Fetching subtitles')}</span>
	</div>
);

export default SubtitleFetchIndicator;
