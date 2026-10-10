/* eslint-disable react/jsx-no-bind */
import {useCallback, useEffect, useRef, useState} from 'react';
import $L from '@enact/i18n/$L';
import Spotlight from '@enact/spotlight';

import LoadingSpinner from '../../components/LoadingSpinner';
import {isFirstOfServer, isLastOfServer, libraryOrderIcon} from './libraryOrder';
import {ReorderRow} from './settingsRows';
import SettingsView from './SettingsView';
import useLibraryOrder from './useLibraryOrder';

import css from './Settings.module.less';
import SettingsButton from './SettingsButton';

const rowId = (library) => `library-order-${library.Id}`;

const LibraryOrderRow = ({library, index, isFirst, isLast, hidden, showServerName, onMove}) => (
	<ReorderRow
		spotlightId={rowId(library)}
		title={`${library.Name}${showServerName && library._serverName ? ` (${library._serverName})` : ''}`}
		subtitle={hidden ? $L('Hidden') : null}
		icon={libraryOrderIcon(library)}
		plain
		isFirst={isFirst}
		isLast={isLast}
		onMove={(delta) => onMove(index, index + delta)}
	/>
);

// Left and right move the focused library, since up and down already move the focus.
const LibraryOrderView = ({api, unified, onLibrariesChanged}) => {
	const {libraries, hidden, loading, loadFailed, saveFailures, retry, move} = useLibraryOrder({api, unified, onLibrariesChanged});
	const [dismissedFailures, setDismissedFailures] = useState(0);
	const focusedFirstRef = useRef(false);

	// Nothing here can take focus while the list loads, so the first row asks for it once it shows.
	useEffect(() => {
		if (focusedFirstRef.current || !libraries?.length) return;
		focusedFirstRef.current = true;
		Spotlight.focus(rowId(libraries[0]));
	}, [libraries]);

	useEffect(() => {
		if (loadFailed) Spotlight.focus('library-order-retry');
	}, [loadFailed]);

	const handleToastEnd = useCallback(() => setDismissedFailures(saveFailures), [saveFailures]);

	let body;
	if (loading) {
		body = <div className={css.viewSpinner}><LoadingSpinner /></div>;
	} else if (loadFailed) {
		body = (
			<div className={css.libraryOrderMessage}>
				<div>{$L('Failed to load libraries')}</div>
				<SettingsButton spotlightId='library-order-retry' onClick={retry}>{$L('Retry')}</SettingsButton>
			</div>
		);
	} else if (!libraries?.length) {
		body = <div className={css.libraryOrderMessage}>{$L('No libraries found')}</div>;
	} else {
		body = libraries.map((library, index) => (
			<LibraryOrderRow
				key={`${library._serverUrl || 'local'}-${library.Id}`}
				library={library}
				index={index}
				isFirst={isFirstOfServer(libraries, index)}
				isLast={isLastOfServer(libraries, index)}
				hidden={hidden.has(library.Id)}
				showServerName={unified}
				onMove={move}
			/>
		));
	}

	return (
		<SettingsView spotlightId='library-order-view' title={$L('Library Order')} clean>
			<div className={css.editorHint}>
				{$L('Your libraries appear in this order on My Media, the recently added rows and the navigation bar. The order is saved to your server account, so other apps you sign in to use it too.')}
			</div>
			<div className={`${css.editorHint} ${css.editorHintLast} ${css.editorHintShort}`}>
				{$L('Press left or right to move the highlighted library.')}
			</div>
			{body}
			{saveFailures > dismissedFailures && (
				<div key={saveFailures} className={css.libraryOrderToast} onAnimationEnd={handleToastEnd}>
					{$L("Couldn't save the library order")}
				</div>
			)}
		</SettingsView>
	);
};

export default LibraryOrderView;
