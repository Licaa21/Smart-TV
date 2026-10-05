import {useCallback, useEffect, useRef, useState} from 'react';
import $L from '@enact/i18n/$L';
import Button from '@enact/sandstone/Button';
import Spotlight from '@enact/spotlight';

import LoadingSpinner from '../../components/LoadingSpinner';
import {isFirstOfServer, isLastOfServer, libraryOrderIcon} from './libraryOrder';
import {materialIconPath} from './materialIconMap';
import {renderSettingsIcon} from './settingsIcons';
import {SectionTitle} from './settingsRows';
import {SpottableDiv} from './settingsSpottables';
import SettingsView from './SettingsView';
import useLibraryOrder from './useLibraryOrder';

import css from './Settings.module.less';

const rowId = (library) => `library-order-${library.Id}`;

const Arrow = ({name}) => (
	<svg className={css.libraryOrderArrow} viewBox='0 -960 960 960' fill='currentColor' aria-hidden='true' focusable='false'>
		<path d={materialIconPath(name)} />
	</svg>
);

const LibraryOrderRow = ({library, index, isFirst, isLast, hidden, showServerName, onMove}) => {
	const handleLeft = useCallback((ev) => {
		if (isFirst) return;
		ev.preventDefault();
		ev.stopPropagation();
		onMove(index, index - 1, library);
	}, [isFirst, index, library, onMove]);

	const handleRight = useCallback((ev) => {
		if (isLast) return;
		ev.preventDefault();
		ev.stopPropagation();
		onMove(index, index + 1, library);
	}, [isLast, index, library, onMove]);

	return (
		<SpottableDiv
			className={css.listItem}
			spotlightId={rowId(library)}
			onSpotlightLeft={handleLeft}
			onSpotlightRight={handleRight}
		>
			{renderSettingsIcon(libraryOrderIcon(library))}
			<div className={css.listItemBody}>
				<div className={css.listItemHeading}>
					{library.Name}
					{showServerName && library._serverName ? ` (${library._serverName})` : ''}
				</div>
				{hidden && <div className={css.listItemCaption}>{$L('Hidden')}</div>}
			</div>
			<div className={`${css.listItemTrailing} ${css.libraryOrderArrows}`}>
				{!isFirst && <Arrow name='arrow_left' />}
				{!isLast && <Arrow name='arrow_right' />}
			</div>
		</SpottableDiv>
	);
};

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

	// The row is put back in the list at its new place, which drops the focus it had.
	const handleMove = useCallback((index, newIndex, library) => {
		if (move(index, newIndex)) window.requestAnimationFrame(() => Spotlight.focus(rowId(library)));
	}, [move]);

	const handleToastEnd = useCallback(() => setDismissedFailures(saveFailures), [saveFailures]);

	let body;
	if (loading) {
		body = <div className={css.viewSpinner}><LoadingSpinner /></div>;
	} else if (loadFailed) {
		body = (
			<div className={css.libraryOrderMessage}>
				<div>{$L('Failed to load libraries')}</div>
				<Button size='small' spotlightId='library-order-retry' onClick={retry}>{$L('Retry')}</Button>
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
				onMove={handleMove}
			/>
		));
	}

	return (
		<SettingsView spotlightId='library-order-view'>
			<SectionTitle>{$L('Library Order')}</SectionTitle>
			<div className={css.viewDescription}>
				{$L('Your libraries appear in this order on My Media, the recently added rows and the navigation bar. The order is saved to your server account, so other apps you sign in to use it too.')}
				<div className={css.libraryOrderHint}>{$L('Press left or right to move the highlighted library.')}</div>
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
