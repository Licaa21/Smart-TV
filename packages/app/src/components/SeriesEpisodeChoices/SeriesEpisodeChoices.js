import $L from '@enact/i18n/$L';

import TrackOptionRow from '../TrackOptionRow';
import {SERIES_EPISODE_CHOICES} from '../../utils/liveTvGuide';

// The current choice holds focus when the list opens.
const SeriesEpisodeChoices = ({selected, onPick}) => SERIES_EPISODE_CHOICES.map((choice) => (
	<TrackOptionRow
		key={choice.key}
		className={choice.key === selected ? 'spottable-default' : undefined}
		label={$L(choice.label)}
		detail={$L(choice.detail)}
		selected={choice.key === selected}
		onClick={() => onPick(choice.key)} // eslint-disable-line react/jsx-no-bind
	/>
));

export default SeriesEpisodeChoices;
