import {useCallback, useMemo, useState} from 'react';
import Spotlight from '@enact/spotlight';

import TrackOptionRow, {TrackDivider} from '../TrackOptionRow';
import TrackFilterBar, {TRACK_FILTER_FOCUS_ID} from './TrackFilterBar';
import {channelKeyStep} from '../../utils/channelKeys';
import {filterTracks, needsTrackFilter, trackLanguages} from '../../utils/trackFilter';

import css from './TrackFilterBar.module.less';

// What the Audio and Subtitle pickers hold. A short list is drawn as it always was, the tracks, then the actions under
// a divider. A long one gets language chips and a search field with the actions beside them, and the tracks scroll on
// their own under them. Channel Up goes to the strip from anywhere in the list and Channel Down back to the chosen track.
//
// entries[i] = {language, text}, rows[i] is the row for that entry. leading is the row that always shows (None), and
// actions are {label, detail, spotlightId, onClick, dimmed}, the dimmed ones last.
const FilteredTrackList = ({modal, listClassName, leading, entries, rows, actions}) => {
	const [language, setLanguage] = useState('');
	const [query, setQuery] = useState('');
	const filtered = needsTrackFilter(entries.length);
	const languages = useMemo(() => (filtered ? trackLanguages(entries) : []), [filtered, entries]);
	const kept = useMemo(() => (filtered ? filterTracks(entries, {language, query}) : null), [filtered, entries, language, query]);

	const handleKeyDown = useCallback((e) => {
		if (!filtered) return;
		const step = channelKeyStep(e);
		if (!step) return;
		e.preventDefault();
		e.stopPropagation();
		if (step > 0) Spotlight.focus(TRACK_FILTER_FOCUS_ID);
		else if (!Spotlight.focus(`[data-modal="${modal}"] [data-selected="true"]`)) Spotlight.focus(`[data-modal="${modal}"] [data-index]`);
	}, [filtered, modal]);

	if (!filtered) {
		const plain = actions.filter((action) => !action.dimmed);
		const last = actions.filter((action) => action.dimmed);
		const actionRow = (action) => (
			<TrackOptionRow key={action.label} label={action.label} detail={action.detail} dimmed={action.dimmed} spotlightId={action.spotlightId} onClick={action.onClick} />
		);
		return (
			<div className={listClassName}>
				{leading}
				{rows}
				{plain.length > 0 && <TrackDivider />}
				{plain.map(actionRow)}
				{last.length > 0 && <TrackDivider />}
				{last.map(actionRow)}
			</div>
		);
	}

	return (
		<div onKeyDown={handleKeyDown}>
			<TrackFilterBar
				languages={languages}
				language={language}
				query={query}
				onLanguage={setLanguage}
				onQuery={setQuery}
				actions={actions}
			/>
			<div className={`${listClassName} ${css.scrollList}`}>
				{leading}
				{kept.map((position) => rows[position])}
			</div>
		</div>
	);
};

export default FilteredTrackList;
