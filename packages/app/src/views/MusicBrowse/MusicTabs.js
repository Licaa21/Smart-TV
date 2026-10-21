import {useCallback, useState} from 'react';
import $L from '@enact/i18n/$L';
import DetailsTabBar from '../../components/DetailsTabBar';
import {MUSIC_FOCUS_IDS} from './musicFocus';
import {MUSIC_CATEGORIES} from './musicLibrary';

import css from './MusicLibrary.module.less';

const OVERVIEW = 'overview';
const TAB_LIST = [{id: OVERVIEW, label: $L('Overview')}, ...MUSIC_CATEGORIES.map(({id, label}) => ({id, label}))];

// The pill tabs. The arrows move the highlight along them without leaving the screen, Select
// or a click opens the grid the highlighted one names, and the highlight goes back to Overview,
// the screen they sit on, once focus leaves them.
const MusicTabs = ({onOpenGrid}) => {
	const [highlight, setHighlight] = useState(OVERVIEW);

	const handleActivate = useCallback((id) => {
		if (id !== OVERVIEW) onOpenGrid(id);
	}, [onOpenGrid]);

	// The new focus isn't known until the blur is over, so the check waits a tick.
	const handleBlur = useCallback((e) => {
		const tabs = e.currentTarget;
		window.setTimeout(() => {
			if (!tabs.contains(document.activeElement)) setHighlight(OVERVIEW);
		}, 0);
	}, []);

	return (
		<div className={css.tabs} onBlur={handleBlur}>
			<DetailsTabBar
				className={css.tabBar}
				tabs={TAB_LIST}
				activeId={highlight}
				onSelect={setHighlight}
				onActivate={handleActivate}
				spotlightId={MUSIC_FOCUS_IDS.tabs}
			/>
		</div>
	);
};

export default MusicTabs;
